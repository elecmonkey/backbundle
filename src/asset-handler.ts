import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { glob } from 'glob';
import { dirname, join, relative } from 'path';
import type { BackbundleConfig } from './types.js';

/**
 * Asset types that can be handled
 */
export type AssetType = 'wasm' | 'binary' | 'asset';

/**
 * Asset handling strategies
 */
export type AssetStrategy = 'copy' | 'external' | 'ignore' | 'inline';

/**
 * Asset handler for WASM, binary, and other asset files
 */
export class AssetHandler {
    private config: BackbundleConfig;
    private outputDir: string;

    constructor(config: BackbundleConfig, outputDir: string) {
        this.config = config;
        this.outputDir = outputDir;
    }

    /**
     * Detect WASM packages in node_modules
     */
    detectWasmPackages(): string[] {
        const wasmPackages: string[] = [];

        try {
            const nodeModulesPath = join(process.cwd(), 'node_modules');
            if (!existsSync(nodeModulesPath)) return wasmPackages;

            // Look for .wasm files in node_modules (supports both npm and pnpm structures)
            const wasmFiles = glob.sync([
                '**/*.wasm',
                '.pnpm/**/*.wasm'
            ], {
                cwd: nodeModulesPath,
                ignore: ['**/test/**', '**/tests/**', '**/example/**', '**/examples/**'],
                dot: true // Include hidden directories like .pnpm
            });

            // Extract package names from WASM file paths
            for (const wasmFile of wasmFiles) {
                const parts = wasmFile.split('/');
                let packageName: string;

                // Handle PNPM structure: .pnpm/package@version/node_modules/package/file.wasm
                if (parts[0] === '.pnpm' && parts.length >= 4) {
                    const pnpmPackageDir = parts[1]; // e.g., "json-packer-wasm@0.1.1"
                    packageName = pnpmPackageDir.split('@')[0]; // Extract package name before version
                    if (pnpmPackageDir.startsWith('@')) {
                        // Handle scoped packages like @scope/package@version
                        const atIndex = pnpmPackageDir.lastIndexOf('@');
                        packageName = pnpmPackageDir.substring(0, atIndex);
                    }
                } else {
                    // Handle standard npm structure: package/file.wasm
                    packageName = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
                }

                if (!wasmPackages.includes(packageName)) {
                    wasmPackages.push(packageName);
                }
            }
        } catch (error) {
            console.warn('Failed to detect WASM packages:', error);
        }

        return wasmPackages;
    }

    /**
     * Handle WASM packages based on configuration
     */
    handleWasmPackages(): string[] {
        const wasmConfig = this.config.wasmPackages;
        if (!wasmConfig || wasmConfig.strategy === 'ignore') return [];

        const detectedPackages = this.detectWasmPackages();
        const packagesToHandle = wasmConfig.packages || detectedPackages;
        const externals: string[] = [];

        for (const packageName of packagesToHandle) {
            const packagePath = join(process.cwd(), 'node_modules', packageName);
            if (!existsSync(packagePath)) continue;

            switch (wasmConfig.strategy) {
                case 'copy':
                    this.copyWasmFiles(packagePath, packageName, wasmConfig.preserveStructure);
                    break;
                case 'external':
                    externals.push(packageName);
                    break;
                case 'inline':
                    // WASM files typically cannot be inlined effectively, fall back to copy
                    this.copyWasmFiles(packagePath, packageName, wasmConfig.preserveStructure);
                    break;
            }
        }

        return externals;
    }

    /**
     * Copy WASM files from package to output directory
     */
    private copyWasmFiles(packagePath: string, packageName: string, preserveStructure = true): void {
        try {
            // First try standard npm structure
            let actualPackagePath = packagePath;

            if (!existsSync(packagePath)) {
                // Try PNPM structure
                const nodeModulesPath = join(process.cwd(), 'node_modules');
                const pnpmPath = join(nodeModulesPath, '.pnpm');

                if (existsSync(pnpmPath)) {
                    // Find the package in .pnpm directory - handle scoped packages
                    const searchPattern = packageName.includes('/')
                        ? `*${packageName.replace('/', '*')}*/node_modules/${packageName}`
                        : `${packageName}@*/node_modules/${packageName}`;

                    const pnpmDirs = glob.sync(searchPattern, {
                        cwd: pnpmPath,
                        dot: true
                    });

                    if (pnpmDirs.length > 0) {
                        actualPackagePath = join(pnpmPath, pnpmDirs[0]);
                    }
                }
            }

            if (!existsSync(actualPackagePath)) {
                console.warn(`⚠️ Package path not found: ${packageName} at ${actualPackagePath}`);
                return;
            }

            const wasmFiles = glob.sync(['*.wasm', '**/*.wasm'], { cwd: actualPackagePath });
            const outputBase = this.config.wasmPackages?.outputDir || 'assets/wasm';

            for (const wasmFile of wasmFiles) {
                const sourcePath = join(actualPackagePath, wasmFile);
                const targetPath = preserveStructure
                    ? join(this.outputDir, outputBase, packageName, wasmFile)
                    : join(this.outputDir, outputBase, `${packageName}-${wasmFile.replace(/\//g, '-')}`);

                // Ensure target directory exists
                mkdirSync(dirname(targetPath), { recursive: true });

                // Copy the WASM file
                copyFileSync(sourcePath, targetPath);
                console.log(`📦 Copied WASM: ${packageName}/${wasmFile} → ${relative(process.cwd(), targetPath)}`);
            }
        } catch (error) {
            console.warn(`Failed to copy WASM files for ${packageName}:`, error);
        }
    }

    /**
     * Handle asset packages (JSON, etc.)
     */
    handleAssetPackages(): string[] {
        const assetConfig = this.config.assetPackages;
        if (!assetConfig || assetConfig.strategy === 'ignore') return [];

        const externals: string[] = [];
        const packagesToHandle = assetConfig.packages || [];
        const extensions = assetConfig.extensions || ['.json', '.txt', '.xml', '.yaml', '.yml'];

        for (const packageName of packagesToHandle) {
            const packagePath = join(process.cwd(), 'node_modules', packageName);
            if (!existsSync(packagePath)) continue;

            switch (assetConfig.strategy) {
                case 'copy':
                    this.copyAssetFiles(packagePath, packageName, extensions, assetConfig.preserveStructure);
                    break;
                case 'external':
                    externals.push(packageName);
                    break;
                case 'inline':
                    // Assets can sometimes be inlined, but for now we copy them
                    this.copyAssetFiles(packagePath, packageName, extensions, assetConfig.preserveStructure);
                    break;
            }
        }

        return externals;
    }

    /**
     * Copy asset files from package to output directory
     */
    private copyAssetFiles(packagePath: string, packageName: string, extensions: string[], preserveStructure = true): void {
        try {
            const patterns = extensions.map(ext => `**/*${ext}`);
            const assetFiles = glob.sync(patterns, { cwd: packagePath });
            const outputBase = this.config.assetPackages?.outputDir || 'assets';

            for (const assetFile of assetFiles) {
                const sourcePath = join(packagePath, assetFile);
                const targetPath = preserveStructure
                    ? join(this.outputDir, outputBase, packageName, assetFile)
                    : join(this.outputDir, outputBase, `${packageName}-${assetFile.replace(/\//g, '-')}`);

                // Ensure target directory exists
                mkdirSync(dirname(targetPath), { recursive: true });

                // Copy the asset file
                copyFileSync(sourcePath, targetPath);
                console.log(`📄 Copied asset: ${packageName}/${assetFile} → ${relative(process.cwd(), targetPath)}`);
            }
        } catch (error) {
            console.warn(`Failed to copy asset files for ${packageName}:`, error);
        }
    }

    /**
     * Get all external packages that should be excluded from bundling
     */
    getAllExternals(): string[] {
        const wasmExternals = this.handleWasmPackages();
        const assetExternals = this.handleAssetPackages();

        return [...wasmExternals, ...assetExternals];
    }
}

/**
 * Utility function to detect if a package contains WASM files
 */
export function hasWasmFiles(packagePath: string): boolean {
    try {
        const wasmFiles = glob.sync('**/*.wasm', {
            cwd: packagePath,
            ignore: ['**/test/**', '**/tests/**']
        });
        return wasmFiles.length > 0;
    } catch {
        return false;
    }
}

/**
 * Utility function to get all WASM files in a package
 */
export function getWasmFiles(packagePath: string): string[] {
    try {
        return glob.sync('**/*.wasm', { cwd: packagePath });
    } catch {
        return [];
    }
}
