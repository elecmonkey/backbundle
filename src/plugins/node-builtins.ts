import type { Plugin } from 'esbuild';

/**
 * Node.js built-ins plugin
 * Ensures Node.js built-in modules are properly handled in different environments
 */
export function createNodeBuiltinsPlugin(): Plugin {
  return {
    name: 'node-builtins',
    setup(build) {
      // This plugin can be extended to handle Node.js built-ins polyfills
      // for different target environments
    }
  };
}
