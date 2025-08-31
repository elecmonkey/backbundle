import { existsSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import type { BackbundleConfig } from './types.js';

/**
 * Common binary packages that need special handling
 */
const KNOWN_BINARY_PACKAGES = [
  // Database drivers
  'sqlite3',
  'better-sqlite3',
  'node-oracledb',
  'oracledb',
  'pg',
  'mysql',
  'mysql2',
  
  // Image processing
  'sharp',
  'canvas',
  'node-canvas',
  
  // Compression
  'node-zstd',
  'snappy',
  
  // Native modules
  'bcrypt',
  'argon2',
  'node-gyp',
  
  // Serialization
  'msgpack',
  'protobufjs',
  
  // System integration
  'node-pty',
  'node-ssh',
  'node-ffi',
  
  // Performance
  'cpu-features',
  're2',
];

/**
 * Detect if a package likely contains binary files
 */
export function isBinaryPackage(packageName: string, packagePath: string): boolean {
  // Check if it's in known binary packages list
  if (KNOWN_BINARY_PACKAGES.includes(packageName)) {
    return true;
  }
  
  // Check for common binary file patterns
  const patterns = [
    /\.node$/,
    /\.so$/,
    /\.dll$/,
    /\.dylib$/,
    /\.exe$/,
    /binding\.gyp$/,
    /prebuilds?\//,
    /build\/Release\//,
  ];
  
  try {
    const files = getAllFiles(packagePath);
    return files.some(file => patterns.some(pattern => pattern.test(file)));
  } catch {
    return false;
  }
}

/**
 * Get all files recursively from a directory
 */
function getAllFiles(dir: string, maxDepth: number = 3, currentDepth: number = 0): string[] {
  if (!existsSync(dir) || currentDepth > maxDepth) {
    return [];
  }
  
  const files: string[] = [];
  
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isFile()) {
        files.push(relative(dir, fullPath));
      } else if (stat.isDirectory() && currentDepth < maxDepth) {
        const subFiles = getAllFiles(fullPath, maxDepth, currentDepth + 1);
        files.push(...subFiles.map(f => join(item, f)));
      }
    }
  } catch {
    // Ignore errors
  }
  
  return files;
}

/**
 * Copy binary files from a package to output directory
 */
export function copyBinaryFiles(
  packageName: string,
  packagePath: string,
  outputPath: string,
  preserveStructure: boolean = true
): string[] {
  const copiedFiles: string[] = [];
  
  // Patterns for binary files we want to copy
  const binaryPatterns = [
    /\.node$/,
    /\.so(\.\d+)*$/,
    /\.dll$/,
    /\.dylib$/,
    /\.exe$/,
    /prebuilds?\//,
    /build\/Release\//,
  ];
  
  try {
    const files = getAllFiles(packagePath);
    
    for (const file of files) {
      if (binaryPatterns.some(pattern => pattern.test(file))) {
        const sourcePath = join(packagePath, file);
        
        let targetPath: string;
        if (preserveStructure) {
          targetPath = join(outputPath, 'node_modules', packageName, file);
        } else {
          targetPath = join(outputPath, 'binaries', packageName, file);
        }
        
        // Ensure target directory exists
        mkdirSync(dirname(targetPath), { recursive: true });
        
        // Copy the file
        copyFileSync(sourcePath, targetPath);
        copiedFiles.push(targetPath);
        
        console.log(`📦 Copied binary: ${packageName}/${file}`);
      }
    }
  } catch (error) {
    console.warn(`⚠️  Failed to copy binaries for ${packageName}:`, error);
  }
  
  return copiedFiles;
}

/**
 * Handle binary packages based on configuration
 */
export function handleBinaryPackages(
  config: BackbundleConfig,
  nodeModulesPath: string,
  outputDir: string
): {
  external: string[];
  copiedFiles: string[];
} {
  const binaryConfig = config.binaryPackages || {};
  const strategy = binaryConfig.strategy || 'external';
  const explicitPackages = binaryConfig.packages || [];
  const preserveStructure = binaryConfig.preserveStructure !== false;
  
  const external: string[] = [];
  const copiedFiles: string[] = [];
  
  // Get all packages to check
  const packagesToCheck = new Set(explicitPackages);
  
  // Auto-detect binary packages if not explicitly specified
  if (explicitPackages.length === 0) {
    try {
      const packages = readdirSync(nodeModulesPath);
      for (const pkg of packages) {
        if (pkg.startsWith('.')) continue;
        
        const packagePath = join(nodeModulesPath, pkg);
        if (statSync(packagePath).isDirectory() && isBinaryPackage(pkg, packagePath)) {
          packagesToCheck.add(pkg);
        }
      }
    } catch {
      // Ignore errors when reading node_modules
    }
  }
  
  // Process each binary package
  for (const packageName of packagesToCheck) {
    const packagePath = join(nodeModulesPath, packageName);
    
    if (!existsSync(packagePath)) {
      console.warn(`⚠️  Binary package not found: ${packageName}`);
      continue;
    }
    
    switch (strategy) {
      case 'copy':
        const copied = copyBinaryFiles(
          packageName,
          packagePath,
          outputDir,
          preserveStructure
        );
        copiedFiles.push(...copied);
        external.push(packageName);
        break;
        
      case 'external':
        external.push(packageName);
        console.log(`🔗 Marked as external: ${packageName}`);
        break;
        
      case 'ignore':
        console.log(`🚫 Ignoring binary package: ${packageName}`);
        break;
    }
  }
  
  return { external, copiedFiles };
}

/**
 * Generate runtime instructions for binary packages
 */
export function generateBinaryInstructions(
  copiedFiles: string[],
  strategy: string = 'external'
): string {
  if (copiedFiles.length === 0) {
    return '';
  }
  
  const instructions = [
    '# Binary Packages Handling',
    '',
    `Strategy used: ${strategy}`,
    `Files copied: ${copiedFiles.length}`,
    '',
    'The following binary files were processed:',
    ...copiedFiles.map(file => `  - ${file}`),
    '',
    '## Important Notes:',
    '1. Make sure to deploy these binary files alongside your bundle',
    '2. Verify that the target platform matches the binary architecture',
    '3. Consider using Docker for consistent deployment environments',
    ''
  ];
  
  return instructions.join('\n');
}
