import type { Plugin } from 'esbuild';
import { dirname } from 'path';
import type { BackbundleConfig } from '../types.js';

/**
 * Asset path replacement plugin
 * Replaces paths to assets (WASM, binary files, JSON, etc.) from node_modules to dist output
 */
export function createAssetPathReplacerPlugin(config: BackbundleConfig): Plugin {
  return {
    name: 'asset-path-replacer',
    setup(build) {
      const outputDir = dirname(config.output);

      build.onLoad({ filter: /\.(ts|js|tsx|jsx)$/ }, async (args) => {
        const fs = await import('fs');
        const contents = fs.readFileSync(args.path, 'utf8');
        let transformedContents = contents;
        let hasChanges = false;

        // WASM files
        if (config.wasmPackages?.strategy === 'copy') {
          const wasmOutputDir = config.wasmPackages.outputDir || 'assets/wasm';
          const wasmReplaced = transformedContents.replace(
            /(['"`])([^'"`]*\/node_modules\/([^/]+)\/[^'"`]*\.wasm)\1/g,
            (match, quote, fullPath, packageName) => {
              const wasmFileName = fullPath.split('/').pop();
              const newPath = `${quote}./${wasmOutputDir}/${packageName}/${wasmFileName}${quote}`;
              console.log(`🔄 Replacing WASM path: ${fullPath} → ./${wasmOutputDir}/${packageName}/${wasmFileName}`);
              hasChanges = true;
              return newPath;
            }
          );
          transformedContents = wasmReplaced;
        }

        // Binary files (.node)
        if (config.binaryPackages?.strategy === 'copy') {
          const binaryOutputDir = config.binaryPackages.outputDir || 'native';
          const binaryReplaced = transformedContents.replace(
            /(['"`])([^'"`]*\/node_modules\/([^/]+)\/[^'"`]*\.node)\1/g,
            (match, quote, fullPath, packageName) => {
              const binaryFileName = fullPath.split('/').pop();
              const newPath = `${quote}./${binaryOutputDir}/${packageName}/${binaryFileName}${quote}`;
              console.log(`🔄 Replacing binary path: ${fullPath} → ./${binaryOutputDir}/${packageName}/${binaryFileName}`);
              hasChanges = true;
              return newPath;
            }
          );
          transformedContents = binaryReplaced;
        }

        // Asset files (JSON, YAML, XML, TXT, etc.)
        if (config.assetPackages?.strategy === 'copy') {
          const assetOutputDir = config.assetPackages.outputDir || 'assets';
          const extensions = config.assetPackages.extensions || ['.json', '.txt', '.xml', '.yaml', '.yml'];

          for (const ext of extensions) {
            const escapedExt = ext.replace('.', '\\.');
            const pattern = `(['"\`])([^'"\`]*\\/node_modules\\/([^\\/]+)\\/[^'"\`]*\\${escapedExt})\\x01`;
            const regex = new RegExp(pattern.replace('\\x01', '\\1'), 'g');

            const assetReplaced = transformedContents.replace(
              regex,
              (match, quote, fullPath, packageName) => {
                const assetFileName = fullPath.split('/').pop();
                const newPath = `${quote}./${assetOutputDir}/${packageName}/${assetFileName}${quote}`;
                console.log(`🔄 Replacing asset path: ${fullPath} → ./${assetOutputDir}/${packageName}/${assetFileName}`);
                hasChanges = true;
                return newPath;
              }
            );
            transformedContents = assetReplaced;
          }
        }

        if (hasChanges) {
          return {
            contents: transformedContents,
            loader: args.path.endsWith('.ts') || args.path.endsWith('.tsx') ? 'ts' : 'js'
          };
        }

        return null;
      });
    }
  };
}
