/**
 * Backbundle - A specialized bundler for Node.js backend projects
 * 
 * Main entry point for the library API
 */

export { Bundler, bundle, detectEntryPoint, detectFramework } from './bundler.js';
export { NODE_BUILTINS, FRAMEWORK_PRESETS, getPreset, listPresets } from './presets.js';
export type { BackbundleConfig, BundleResult, FrameworkPreset } from './types.js';

/**
 * Default export for convenience
 */
export { bundle as default } from './bundler.js';
