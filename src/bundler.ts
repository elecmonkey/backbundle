import { build, type BuildOptions } from 'esbuild';
import { readFileSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import type { BackbundleConfig, BundleResult } from './types.js';
import { NODE_BUILTINS } from './presets.js';
import { handleBinaryPackages, generateBinaryInstructions } from './binary-handler.js';
import { AssetHandler } from './asset-handler.js';
import { getPlugins } from './plugins.js';

/**
 * Main bundler class for Backbundle
 */
export class Bundler {
  private config: BackbundleConfig;

  constructor(config: BackbundleConfig) {
    this.config = this.normalizeConfig(config);
  }

  /**
   * Normalize and validate the configuration
   */
  private normalizeConfig(config: BackbundleConfig): BackbundleConfig {
    return {
      platform: 'node',
      format: 'cjs',
      minify: true,
      sourcemap: false,
      target: 'node18',
      external: [],
      excludePackages: false,
      keepNames: false,
      treeShaking: true,
      ...config,
    };
  }

  /**
   * Build the esbuild options from the configuration
   */
  private buildEsbuildOptions(): BuildOptions {
    const { config } = this;
    const external = [...(config.external || [])];

    // Always exclude Node.js built-in modules
    external.push(...NODE_BUILTINS);

    // Add packages exclusion if enabled
    if (config.excludePackages) {
      // This will be handled by esbuild's packages option
    }

    // Get all plugins (including custom ones)
    const allPlugins = getPlugins(config);

    const esbuildOptions: BuildOptions = {
      entryPoints: [config.entry],
      outfile: config.output,
      bundle: true,
      platform: config.platform,
      format: config.format,
      minify: config.minify,
      sourcemap: config.sourcemap,
      target: config.target,
      external,
      keepNames: config.keepNames,
      treeShaking: config.treeShaking,
      logLevel: 'warning',
      metafile: true,
      // For ESM format, ensure proper handling of CommonJS packages
      ...(config.format === 'esm' && {
        mainFields: ['module', 'main'],
        banner: {
          js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`
        }
      }),
      // Apply merged configuration, but exclude plugins to avoid duplication
      ...{ ...config.esbuildOptions, plugins: undefined },
      // Add all plugins
      plugins: allPlugins,
    };

    // Handle packages exclusion
    if (config.excludePackages) {
      esbuildOptions.packages = 'external';
    }

    // Handle aliases
    if (config.alias) {
      esbuildOptions.alias = config.alias;
    }

    // Handle defines
    if (config.define) {
      esbuildOptions.define = config.define;
    }

    return esbuildOptions;
  }

  /**
   * Bundle the application
   */
  async bundle(): Promise<BundleResult> {
    const startTime = Date.now();

    try {
      // Handle binary packages and assets before building
      const nodeModulesPath = join(process.cwd(), 'node_modules');
      const outputDir = dirname(this.config.output);

      let binaryExternal: string[] = [];
      let assetExternal: string[] = [];
      let copiedFiles: string[] = [];

      if (existsSync(nodeModulesPath)) {
        // Handle binary packages
        if (this.config.binaryPackages) {
          const binaryResult = handleBinaryPackages(
            this.config,
            nodeModulesPath,
            outputDir
          );
          binaryExternal = binaryResult.external;
          copiedFiles.push(...binaryResult.copiedFiles);
        }

        // Handle WASM and asset packages
        const assetHandler = new AssetHandler(this.config, outputDir);
        assetExternal = assetHandler.getAllExternals();
      }

      // Merge all externals with existing external packages
      const originalExternal = [...(this.config.external || [])];
      this.config.external = [...originalExternal, ...binaryExternal, ...assetExternal];

      const esbuildOptions = this.buildEsbuildOptions();
      const result = await build(esbuildOptions);

      // Generate binary instructions if files were copied
      if (copiedFiles.length > 0) {
        const instructions = generateBinaryInstructions(
          copiedFiles,
          this.config.binaryPackages?.strategy
        );
        console.log('\n' + instructions);
      }

      const endTime = Date.now();
      const time = endTime - startTime;

      // Get output file size
      let size = 0;
      try {
        const stats = statSync(this.config.output);
        size = stats.size;
      } catch (error) {
        // File might not exist if there were errors
      }

      const bundleResult: BundleResult = {
        success: result.errors.length === 0,
        outputPath: this.config.output,
        size,
        time,
        errors: result.errors.map(error => error.text),
        warnings: result.warnings.map(warning => warning.text),
      };

      return bundleResult;
    } catch (error) {
      const endTime = Date.now();
      const time = endTime - startTime;

      return {
        success: false,
        outputPath: this.config.output,
        size: 0,
        time,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): BackbundleConfig {
    return { ...this.config };
  }

  /**
   * Update the configuration
   */
  updateConfig(updates: Partial<BackbundleConfig>): void {
    this.config = this.normalizeConfig({ ...this.config, ...updates });
  }
}

/**
 * Convenience function to bundle with a configuration
 */
export async function bundle(config: BackbundleConfig): Promise<BundleResult> {
  const bundler = new Bundler(config);
  return bundler.bundle();
}

/**
 * Detect the entry point automatically
 */
export function detectEntryPoint(baseDir: string = process.cwd()): string | null {
  const possibleEntries = [
    'src/main.ts',
    'src/main.js',
    'src/index.ts',
    'src/index.js',
    'src/app.ts',
    'src/app.js',
    'main.ts',
    'main.js',
    'index.ts',
    'index.js',
    'app.ts',
    'app.js'
  ];

  for (const entry of possibleEntries) {
    const fullPath = resolve(baseDir, entry);
    try {
      statSync(fullPath);
      return fullPath;
    } catch {
      // File doesn't exist, continue
    }
  }

  return null;
}

/**
 * Read package.json and try to detect the framework
 */
export function detectFramework(baseDir: string = process.cwd()): string | null {
  try {
    const packageJsonPath = resolve(baseDir, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (dependencies['@nestjs/core']) return 'nestjs';
    if (dependencies['express']) return 'express';
    if (dependencies['koa']) return 'koa';
    if (dependencies['fastify']) return 'fastify';

    return 'generic';
  } catch {
    return null;
  }
}
