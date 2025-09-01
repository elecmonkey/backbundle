/**
 * Backbundle - A specialized bundler for Node.js backend projects
 * 
 * Main entry point for the library API
 */

export { bundle, Bundler, detectEntryPoint, detectFramework } from './bundler.js';
export { FRAMEWORK_PRESETS, getPreset, listPresets, NODE_BUILTINS } from './presets.js';
export type { BackbundleConfig, BundleResult, FrameworkPreset } from './types.js';

/**
 * Default export for convenience
 */
export { bundle as default } from './bundler.js';
