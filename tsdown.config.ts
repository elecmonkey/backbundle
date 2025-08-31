import { defineConfig } from 'tsdown'

export default defineConfig({
    // Entry files
    entry: ['src/index.ts', 'src/cli.ts'],

    // Output directory
    outDir: 'dist',

    // Clean output directory before build
    clean: true,

    // Output format
    format: ['esm'],

    // Generate TypeScript declaration files without source maps
    dts: {
        sourcemap: false
    },

    // Disable source maps
    sourcemap: false,

    // Target environment
    target: 'node18',
    platform: 'node',

    // External dependencies (not bundled)
    external: [
        'chalk',
        'commander',
        'esbuild',
        'fs-extra',
        'glob',
        'ora'
    ],

    // Enable tree shaking optimization
    treeshake: true,

    // Code minification
    minify: true
})
