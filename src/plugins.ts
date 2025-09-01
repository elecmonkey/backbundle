import type { Plugin } from 'esbuild';
import { dirname } from 'path';
import type { BackbundleConfig } from './types.js';

/**
 * Create WASM path replacement plugin
 */
export function createWasmPathReplacerPlugin(config: BackbundleConfig): Plugin {
  return {
    name: 'wasm-path-replacer',
    setup(build) {
      const outputDir = dirname(config.output);
      const wasmOutputDir = config.wasmPackages?.outputDir || 'assets/wasm';

      build.onLoad({ filter: /\.(ts|js)$/ }, async (args) => {
        const fs = await import('fs');
        const contents = fs.readFileSync(args.path, 'utf8');

        // Replace node_modules WASM paths with dist paths
        const transformedContents = contents.replace(
          /(['"`])([^'"`]*\/node_modules\/([^\/]+)\/[^'"`]*\.wasm)\1/g,
          (match, quote, fullPath, packageName) => {
            const wasmFileName = fullPath.split('/').pop();
            const newPath = `${quote}./${wasmOutputDir}/${packageName}/${wasmFileName}${quote}`;
            console.log(`🔄 Replacing WASM path: ${fullPath} → ./${wasmOutputDir}/${packageName}/${wasmFileName}`);
            return newPath;
          }
        );

        if (transformedContents !== contents) {
          return {
            contents: transformedContents,
            loader: args.path.endsWith('.ts') ? 'ts' : 'js'
          };
        }

        return null;
      });
    }
  };
}

/**
 * Create Node.js ESM compatibility plugin
 */
export function createEsmCompatibilityPlugin(): Plugin {
  return {
    name: 'esm-compatibility',
    setup(build) {
      // Add createRequire banner for ESM format
      const originalOptions = build.initialOptions;
      if (originalOptions.format === 'esm') {
        originalOptions.banner = {
          ...originalOptions.banner,
          js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);${originalOptions.banner?.js || ''}`
        };
      }
    }
  };
}

/**
 * Get all plugins for the configuration
 */
export function getPlugins(config: BackbundleConfig): Plugin[] {
  const plugins: Plugin[] = [];

  // Add WASM path replacement plugin if needed
  if (config.wasmPackages?.strategy === 'copy') {
    plugins.push(createWasmPathReplacerPlugin(config));
  }

  // Merge with existing plugins from config
  const existingPlugins = config.esbuildOptions?.plugins || [];
  plugins.push(...existingPlugins);

  return plugins;
}
