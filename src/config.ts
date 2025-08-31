import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import type { BackbundleConfig } from './types.js';

/**
 * Possible configuration file names
 */
const CONFIG_FILES = [
  'backbundle.config.js',
  'backbundle.config.mjs',
  'backbundle.config.ts',
  'backbundle.config.json'
];

/**
 * Load configuration from file
 */
export async function loadConfig(configPath?: string, baseDir: string = process.cwd()): Promise<Partial<BackbundleConfig> | null> {
  let configFile: string | null = null;

  if (configPath) {
    // Use explicitly provided config path
    configFile = resolve(baseDir, configPath);
    if (!existsSync(configFile)) {
      throw new Error(`Configuration file not found: ${configFile}`);
    }
  } else {
    // Search for config files in order of preference
    for (const fileName of CONFIG_FILES) {
      const fullPath = resolve(baseDir, fileName);
      if (existsSync(fullPath)) {
        configFile = fullPath;
        break;
      }
    }
  }

  if (!configFile) {
    return null;
  }

  try {
    console.log(`📄 Loading config from: ${configFile}`);
    
    if (configFile.endsWith('.json')) {
      // Handle JSON config files
      const { readFileSync } = await import('fs');
      const content = readFileSync(configFile, 'utf-8');
      return JSON.parse(content);
    } else if (configFile.endsWith('.ts')) {
      // Handle TypeScript config files (requires tsx or ts-node)
      try {
        const { pathToFileURL } = await import('url');
        const tsx = await import('tsx/esm/api');
        tsx.register();
        const module = await import(pathToFileURL(configFile).href);
        return module.default || module;
      } catch (error) {
        throw new Error(`Failed to load TypeScript config file. Make sure tsx is installed: ${error}`);
      }
    } else {
      // Handle JavaScript config files (.js, .mjs)
      const fileUrl = pathToFileURL(configFile).href;
      const module = await import(fileUrl);
      return module.default || module;
    }
  } catch (error) {
    throw new Error(`Failed to load configuration from ${configFile}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Merge configuration with CLI options (CLI options take precedence)
 */
export function mergeConfig(
  fileConfig: Partial<BackbundleConfig> | null,
  cliConfig: Partial<BackbundleConfig>
): Partial<BackbundleConfig> {
  if (!fileConfig) {
    return cliConfig;
  }

  // CLI options override file config
  const merged = { ...fileConfig, ...cliConfig };

  // Special handling for arrays - merge instead of replace
  if (fileConfig.external && cliConfig.external) {
    merged.external = [...fileConfig.external, ...cliConfig.external];
  }

  return merged;
}
