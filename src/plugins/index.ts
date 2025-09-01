import type { Plugin } from 'esbuild';
import type { BackbundleConfig } from '../types.js';
import { createAssetPathReplacerPlugin } from './asset-path-replacer.js';
import { createEsmCompatibilityPlugin } from './esm-compatibility.js';
import { createNodeBuiltinsPlugin } from './node-builtins.js';

/**
 * Get all built-in plugins for the configuration
 */
export function getBuiltinPlugins(config: BackbundleConfig): Plugin[] {
  const plugins: Plugin[] = [];

  // Add asset path replacement plugin if any asset copying is enabled
  const needsAssetPathReplacement =
    config.wasmPackages?.strategy === 'copy' ||
    config.binaryPackages?.strategy === 'copy' ||
    config.assetPackages?.strategy === 'copy';

  if (needsAssetPathReplacement) {
    plugins.push(createAssetPathReplacerPlugin(config));
  }

  // Add ESM compatibility plugin for ESM format
  if (config.format === 'esm') {
    plugins.push(createEsmCompatibilityPlugin());
  }

  // Add Node.js built-ins plugin
  plugins.push(createNodeBuiltinsPlugin());

  return plugins;
}

/**
 * Get all plugins for the configuration (built-in + user plugins)
 */
export function getAllPlugins(config: BackbundleConfig): Plugin[] {
  const builtinPlugins = getBuiltinPlugins(config);
  const userPlugins = config.esbuildOptions?.plugins || [];

  return [...builtinPlugins, ...userPlugins];
}

// Re-export individual plugins for direct use
export { createAssetPathReplacerPlugin } from './asset-path-replacer.js';
export { createEsmCompatibilityPlugin } from './esm-compatibility.js';
export { createNodeBuiltinsPlugin } from './node-builtins.js';

