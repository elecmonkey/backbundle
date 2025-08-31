import type { FrameworkPreset } from './types.js';

/**
 * Built-in Node.js modules that should be excluded from bundling
 */
export const NODE_BUILTINS = [
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns',
  'domain', 'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'punycode',
  'querystring', 'readline', 'stream', 'string_decoder', 'tls', 'tty', 'url',
  'util', 'v8', 'vm', 'zlib', 'async_hooks', 'http2', 'perf_hooks', 'trace_events',
  'inspector', 'worker_threads', 'fs/promises'
];

/**
 * Framework presets for common Node.js backend frameworks
 */
export const FRAMEWORK_PRESETS: FrameworkPreset[] = [
  {
    name: 'nestjs',
    description: 'NestJS framework with TypeScript support',
    config: {
      platform: 'node',
      format: 'esm',
      target: 'node18',
      external: [
        ...NODE_BUILTINS,
        'reflect-metadata'
      ],
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      keepNames: true,
      treeShaking: true,
      minify: false,
      binaryPackages: {
        strategy: 'copy'
      }
    }
  },
  {
    name: 'express',
    description: 'Express.js framework',
    config: {
      platform: 'node',
      format: 'esm',
      target: 'node18',
      external: NODE_BUILTINS,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      treeShaking: true,
      minify: false,
      binaryPackages: {
        strategy: 'copy'
      }
    }
  },
  {
    name: 'koa',
    description: 'Koa.js framework',
    config: {
      platform: 'node',
      format: 'esm',
      target: 'node18',
      external: NODE_BUILTINS,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      treeShaking: true,
      minify: false,
      binaryPackages: {
        strategy: 'copy'
      }
    }
  },
  {
    name: 'fastify',
    description: 'Fastify framework',
    config: {
      platform: 'node',
      format: 'esm',
      target: 'node18',
      external: NODE_BUILTINS,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      treeShaking: true,
      minify: false,
      binaryPackages: {
        strategy: 'copy'
      }
    }
  },
  {
    name: 'generic',
    description: 'Generic Node.js application',
    config: {
      platform: 'node',
      format: 'esm',
      target: 'node18',
      external: NODE_BUILTINS,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      treeShaking: true,
      minify: false,
      binaryPackages: {
        strategy: 'copy'
      }
    }
  }
];

/**
 * Get preset configuration by name
 */
export function getPreset(name: string): FrameworkPreset | undefined {
  return FRAMEWORK_PRESETS.find(preset => preset.name === name);
}

/**
 * List all available presets
 */
export function listPresets(): FrameworkPreset[] {
  return FRAMEWORK_PRESETS;
}
