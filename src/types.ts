import type { BuildOptions } from 'esbuild';

/**
 * Configuration options for Backbundle
 */
export interface BackbundleConfig {
  /** Entry point file path */
  entry: string;

  /** Output file path */
  output: string;

  /** Framework preset to use */
  preset?: string;

  /** Output format, defaults to 'cjs' */
  format?: 'cjs' | 'esm' | 'iife';

  /** Whether to minify the code, defaults to true */
  minify?: boolean;

  /** Whether to generate source map, defaults to false */
  sourcemap?: boolean | 'inline' | 'external' | 'both';

  /** Node.js target version, defaults to 'node18' */
  target?: string;

  /** List of external dependencies */
  external?: string[];

  /** Whether to exclude all npm packages, defaults to false */
  excludePackages?: boolean;

  /** Custom aliases for module resolution */
  alias?: Record<string, string>;

  /** Environment variables replacement */
  define?: Record<string, string>;

  /** Whether to preserve function names, defaults to false */
  keepNames?: boolean;

  /** Whether to enable tree shaking, defaults to true */
  treeShaking?: boolean;

  /** Additional esbuild options */
  esbuildOptions?: Partial<BuildOptions>;

  /** Binary packages handling configuration */
  binaryPackages?: {
    /** Strategy for handling binary packages */
    strategy?: 'copy' | 'external' | 'ignore';

    /** List of packages to treat as binary */
    packages?: string[];

    /** Output directory for copied binaries */
    outputDir?: string;

    /** Whether to preserve directory structure */
    preserveStructure?: boolean;
  };

  /** WebAssembly modules handling configuration */
  wasmPackages?: {
    /** Strategy for handling WASM packages */
    strategy?: 'copy' | 'external' | 'ignore' | 'inline';

    /** List of packages to treat as WASM */
    packages?: string[];

    /** Output directory for copied WASM files */
    outputDir?: string;

    /** Whether to preserve directory structure */
    preserveStructure?: boolean;
  };

  /** Asset files handling configuration */
  assetPackages?: {
    /** Strategy for handling asset packages (JSON, etc.) */
    strategy?: 'copy' | 'external' | 'ignore' | 'inline';

    /** List of packages to treat as assets */
    packages?: string[];

    /** Output directory for copied assets */
    outputDir?: string;

    /** File extensions to treat as assets */
    extensions?: string[];

    /** Whether to preserve directory structure */
    preserveStructure?: boolean;
  };
}

/**
 * Result of the bundle operation
 */
export interface BundleResult {
  /** Whether the bundle was successful */
  success: boolean;

  /** Path to the output file */
  outputPath: string;

  /** Size of the output file in bytes */
  size: number;

  /** Time taken to build in milliseconds */
  time: number;

  /** List of errors if any */
  errors?: string[];

  /** List of warnings if any */
  warnings?: string[];
}

/**
 * Preset configurations for common frameworks
 */
export interface FrameworkPreset {
  /** Preset name */
  name: string;

  /** Default configuration for this framework */
  config: Partial<BackbundleConfig>;

  /** Description of the preset */
  description: string;
}
