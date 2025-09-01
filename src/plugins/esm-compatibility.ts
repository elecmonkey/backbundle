import type { Plugin } from 'esbuild';

/**
 * ESM compatibility plugin
 * Adds createRequire polyfill for ESM format to handle CommonJS dependencies
 */
export function createEsmCompatibilityPlugin(): Plugin {
  return {
    name: 'esm-compatibility',
    setup(build) {
      // Add createRequire banner for ESM format
      const options = build.initialOptions;
      if (options.format === 'esm') {
        options.banner = {
          ...options.banner,
          js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);${options.banner?.js || ''}`
        };
      }
    }
  };
}
