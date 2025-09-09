import type { Plugin } from 'esbuild';

/**
 * ESM compatibility plugin
 * - Adds createRequire polyfill for ESM format to handle CommonJS dependencies
 * - Polyfills __filename and __dirname in ESM bundles
 */
export function createEsmCompatibilityPlugin(): Plugin {
  return {
    name: 'esm-compatibility',
    setup(build) {
      const options = build.initialOptions;
      if (options.format !== 'esm') return;

      const existingBanner = options.banner?.js || '';
      const parts: string[] = [];

      // Add createRequire polyfill if not already present
      if (!/createRequire\s*\(/.test(existingBanner)) {
        parts.push(
          "import { createRequire } from 'module';",
          'const require = createRequire(import.meta.url);'
        );
      }

      // Add __filename and __dirname polyfills if not already present
      const needsFilename = !/__filename\b/.test(existingBanner);
      const needsDirname = !/__dirname\b/.test(existingBanner);
      if (needsFilename || needsDirname) {
        // Ensure helpers are imported once
        if (!/fileURLToPath\b/.test(existingBanner)) {
          parts.push("import { fileURLToPath } from 'url';");
        }
        if (!/\bdirname\b/.test(existingBanner)) {
          parts.push("import { dirname } from 'path';");
        }
        if (needsFilename) {
          parts.push('const __filename = fileURLToPath(import.meta.url);');
        }
        if (needsDirname) {
          // __dirname depends on __filename
          if (!needsFilename && !/__filename\b/.test(existingBanner)) {
            // If __filename is not defined anywhere, define it first
            parts.push('const __filename = fileURLToPath(import.meta.url);');
          }
          parts.push('const __dirname = dirname(__filename);');
        }
      }

      if (parts.length > 0) {
        const banner = parts.join('');
        options.banner = {
          ...options.banner,
          js: banner + existingBanner
        };
      }
    }
  };
}
