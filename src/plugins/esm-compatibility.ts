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
        const existingBanner = options.banner?.js || '';
        // Check if createRequire is already declared to avoid duplicates
        if (!existingBanner.includes('createRequire')) {
          const createRequireBanner = `import { createRequire } from 'module';const require = createRequire(import.meta.url);`;
          options.banner = {
            ...options.banner,
            js: createRequireBanner + existingBanner
          };
        }
      }
    }
  };
}
