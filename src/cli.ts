#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import ora from 'ora';
import { basename, dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { bundle, detectEntryPoint, detectFramework } from './bundler.js';
import { loadConfig, mergeConfig } from './config.js';
import { getPreset, listPresets } from './presets.js';
import type { BackbundleConfig } from './types.js';

interface CLIOptions {
  config?: string;
  input?: string;
  output?: string;
  preset?: string;
  format?: 'cjs' | 'esm' | 'iife';
  target?: string;
  minify?: boolean;
  sourcemap?: boolean | 'inline' | 'external' | 'both';
  external?: string[];
  excludePackages?: boolean;
  keepNames?: boolean;
  treeShaking?: boolean;
  define?: string[];
  alias?: string[];
  binaryStrategy?: 'copy' | 'external' | 'ignore';
  binaryPackages?: string[];
  binaryOutput?: string;
  wasmStrategy?: 'copy' | 'external' | 'ignore' | 'inline';
  wasmPackages?: string[];
  wasmOutput?: string;
  assetStrategy?: 'copy' | 'external' | 'ignore' | 'inline';
  assetPackages?: string[];
  assetOutput?: string;
  assetExtensions?: string[];
  watch?: boolean;
  analyze?: boolean;
}

function isPackageJson(obj: unknown): obj is { version: string } {
  return typeof obj === 'object' && obj !== null && 'version' in obj && typeof (obj as Record<string, unknown>).version === 'string';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJsonPath = resolve(__dirname, '../package.json');
const packageJsonRaw: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
if (!isPackageJson(packageJsonRaw)) {
  throw new Error('Invalid package.json format');
}
const packageJson = packageJsonRaw;

const program = new Command();

program
  .name('backbundle')
  .description('A specialized bundler for Node.js backend projects')
  .version(packageJson.version);

/**
 * Main build command
 */
program
  .command('build')
  .description('Bundle a Node.js backend application')
  .option('-c, --config <file>', 'Path to configuration file')
  .option('-i, --input <file>', 'Entry point file')
  .option('-o, --output <file>', 'Output file path')
  .option('-p, --preset <name>', 'Use a framework preset (nestjs, express, koa, fastify, generic)')
  .option('--format <format>', 'Output format (cjs, esm, iife)', 'cjs')
  .option('--target <target>', 'Target environment (e.g., node18)', 'node18')
  .option('--no-minify', 'Disable code minification')
  .option('--sourcemap [type]', 'Generate source maps (true, inline, external, both)')
  .option('--external <modules...>', 'External modules to exclude from bundle')
  .option('--exclude-packages', 'Exclude all npm packages from bundle')
  .option('--keep-names', 'Preserve function and class names')
  .option('--no-tree-shaking', 'Disable tree shaking')
  .option('--define <key=value...>', 'Define global constants')
  .option('--alias <key=value...>', 'Define import aliases')
  .option('--binary-strategy <strategy>', 'Binary packages handling strategy (copy, external, ignore)', 'external')
  .option('--binary-packages <packages...>', 'Explicitly specify binary packages')
  .option('--binary-output <dir>', 'Output directory for binary files')
  .option('--wasm-strategy <strategy>', 'WASM packages handling strategy (copy, external, ignore)', 'copy')
  .option('--wasm-packages <packages...>', 'Explicitly specify WASM packages')
  .option('--wasm-output <dir>', 'Output directory for WASM files')
  .option('--asset-strategy <strategy>', 'Asset packages handling strategy (copy, external, ignore)', 'copy')
  .option('--asset-packages <packages...>', 'Explicitly specify asset packages')
  .option('--asset-output <dir>', 'Output directory for asset files')
  .option('--asset-extensions <extensions...>', 'File extensions to treat as assets', ['.json', '.txt', '.xml', '.yaml', '.yml'])
  .option('--watch', 'Watch for file changes and rebuild')
  .option('--analyze', 'Show bundle analysis')
  .action(async (options: CLIOptions) => {
    try {
      const config = await buildConfig(options);

      if (options.watch) {
        console.log(chalk.blue('🔍 Starting watch mode...'));
        // Watch mode would be implemented here
        console.log(chalk.yellow('⚠️  Watch mode is not implemented yet'));
        return;
      }

      await runBuild(config, options.analyze);
    } catch (error) {
      console.error(chalk.red('❌ Build failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * List presets command
 */
program
  .command('presets')
  .description('List available framework presets')
  .action(() => {
    console.log(chalk.blue('\n📦 Available Framework Presets:\n'));

    const presets = listPresets();
    presets.forEach(preset => {
      console.log(chalk.green(`  ${preset.name}`));
      console.log(chalk.gray(`    ${preset.description}`));
      console.log();
    });
  });

/**
 * Build configuration from CLI options and config file
 */
async function buildConfig(options: CLIOptions): Promise<BackbundleConfig> {
  // Load configuration file first
  const fileConfig = await loadConfig(options.config);

  // Build CLI-based config
  const cliConfig: Partial<BackbundleConfig> = {};

  // Only set CLI values if they were explicitly provided
  if (options.input) cliConfig.entry = resolve(options.input);
  if (options.output) cliConfig.output = resolve(options.output);
  if (options.format !== 'cjs') cliConfig.format = options.format; // Only if not default
  if (options.target !== 'node18') cliConfig.target = options.target; // Only if not default
  if (options.minify === false) cliConfig.minify = false; // Only if explicitly disabled
  if (options.sourcemap) cliConfig.sourcemap = options.sourcemap;
  if (options.keepNames) cliConfig.keepNames = true;
  if (options.treeShaking === false) cliConfig.treeShaking = false; // Only if explicitly disabled
  if (options.excludePackages) cliConfig.excludePackages = true;
  if (options.preset) cliConfig.preset = options.preset;
  if (options.external) cliConfig.external = options.external;

  // Merge file config with CLI config (CLI takes precedence)
  let config = mergeConfig(fileConfig, cliConfig);

  // Handle entry point detection
  let entry = config.entry;
  if (!entry) {
    const detectedEntry = detectEntryPoint();
    if (!detectedEntry) {
      throw new Error('Could not detect entry point. Please specify with --input option or in config file.');
    }
    entry = detectedEntry;
    console.log(chalk.blue('🔍 Auto-detected entry point:'), chalk.cyan(entry));
    config.entry = entry;
  }

  // Handle framework/preset detection
  let preset = config.preset || options.preset;
  if (!preset) {
    const detectedFramework = detectFramework();
    if (detectedFramework) {
      preset = detectedFramework;
      console.log(chalk.blue('🔍 Auto-detected framework:'), chalk.cyan(preset));
    } else {
      // Default to generic preset when no framework is detected and no configuration is provided
      preset = 'generic';
      console.log(chalk.blue('🎯 No framework detected, using default:'), chalk.cyan(preset));
    }
  }

  // Generate output filename if not provided
  let output = config.output;
  if (!output) {
    const inputBasename = basename(config.entry!, extname(config.entry!));
    output = resolve(process.cwd(), 'dist', `${inputBasename}.js`);
    config.output = output;
  }

  // Ensure output directory exists
  const outputDir = dirname(config.output!);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Apply preset configuration
  if (preset) {
    const presetConfig = getPreset(preset);
    if (presetConfig) {
      // Merge preset with existing config, but don't override user settings
      config = { ...presetConfig.config, ...config };
      console.log(chalk.blue('🎯 Using preset:'), chalk.cyan(preset));
    } else {
      console.warn(chalk.yellow('⚠️  Unknown preset:'), preset);
    }
  }

  // Handle CLI defines
  if (options.define) {
    config.define = config.define || {};
    options.define.forEach((def: string) => {
      const [key, value] = def.split('=');
      if (key && value) {
        config.define![key] = value;
      }
    });
  }

  // Handle CLI aliases
  if (options.alias) {
    config.alias = config.alias || {};
    options.alias.forEach((alias: string) => {
      const [key, value] = alias.split('=');
      if (key && value) {
        config.alias![key] = value;
      }
    });
  }

  // Handle binary packages configuration
  if (options.binaryStrategy || options.binaryPackages || options.binaryOutput) {
    config.binaryPackages = config.binaryPackages || {};

    if (options.binaryStrategy) {
      config.binaryPackages.strategy = options.binaryStrategy;
    }

    if (options.binaryPackages) {
      config.binaryPackages.packages = options.binaryPackages;
    }

    if (options.binaryOutput) {
      config.binaryPackages.outputDir = options.binaryOutput;
    }
  }

  // Handle WASM packages configuration
  if (options.wasmStrategy || options.wasmPackages || options.wasmOutput) {
    config.wasmPackages = config.wasmPackages || {};

    if (options.wasmStrategy) {
      config.wasmPackages.strategy = options.wasmStrategy;
    }

    if (options.wasmPackages) {
      config.wasmPackages.packages = options.wasmPackages;
    }

    if (options.wasmOutput) {
      config.wasmPackages.outputDir = options.wasmOutput;
    }
  }

  // Handle asset packages configuration
  if (options.assetStrategy || options.assetPackages || options.assetOutput || options.assetExtensions) {
    config.assetPackages = config.assetPackages || {};

    if (options.assetStrategy) {
      config.assetPackages.strategy = options.assetStrategy;
    }

    if (options.assetPackages) {
      config.assetPackages.packages = options.assetPackages;
    }

    if (options.assetOutput) {
      config.assetPackages.outputDir = options.assetOutput;
    }

    if (options.assetExtensions) {
      config.assetPackages.extensions = options.assetExtensions;
    }
  }

  // Ensure all required fields are set with defaults
  const finalConfig: BackbundleConfig = {
    entry: config.entry!,
    output: config.output!,
    format: config.format || 'cjs',
    target: config.target || 'node18',
    minify: config.minify !== false,
    sourcemap: config.sourcemap || false,
    keepNames: config.keepNames || false,
    treeShaking: config.treeShaking !== false,
    excludePackages: config.excludePackages || false,
    external: config.external || [],
    define: config.define || {},
    alias: config.alias || {},
    esbuildOptions: config.esbuildOptions || {},
    binaryPackages: config.binaryPackages,
    wasmPackages: config.wasmPackages,
    assetPackages: config.assetPackages
  };

  return finalConfig;
}

/**
 * Run the build process
 */
async function runBuild(config: BackbundleConfig, analyze = false): Promise<void> {
  const spinner = ora('Building bundle...').start();

  try {
    const result = await bundle(config);

    if (result.success) {
      spinner.succeed(chalk.green('✅ Bundle created successfully!'));

      console.log(chalk.blue('\n📊 Build Summary:'));
      console.log(chalk.gray(`   Entry:  ${config.entry}`));
      console.log(chalk.gray(`   Output: ${result.outputPath}`));
      console.log(chalk.gray(`   Size:   ${formatBytes(result.size)}`));
      console.log(chalk.gray(`   Time:   ${result.time}ms`));

      if (result.warnings && result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        result.warnings.forEach(warning => {
          console.log(chalk.yellow(`   ${warning}`));
        });
      }

      if (analyze) {
        console.log(chalk.blue('\n📈 Bundle Analysis:'));
        console.log(chalk.gray('   Analysis feature coming soon...'));
      }
    } else {
      spinner.fail(chalk.red('❌ Build failed!'));

      if (result.errors && result.errors.length > 0) {
        console.log(chalk.red('\n🚨 Errors:'));
        result.errors.forEach(error => {
          console.log(chalk.red(`   ${error}`));
        });
      }

      process.exit(1);
    }
  } catch (error) {
    spinner.fail(chalk.red('❌ Build failed!'));
    throw error;
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Parse CLI arguments
program.parse();
