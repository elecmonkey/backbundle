#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resolve, dirname, basename, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { bundle, detectEntryPoint, detectFramework } from './bundler.js';
import { getPreset, listPresets } from './presets.js';
import type { BackbundleConfig } from './types.js';

const program = new Command();

program
  .name('backbundle')
  .description('A specialized bundler for Node.js backend projects')
  .version('1.0.0');

/**
 * Main build command
 */
program
  .command('build')
  .description('Bundle a Node.js backend application')
  .option('-i, --input <file>', 'Entry point file')
  .option('-o, --output <file>', 'Output file path')
  .option('-p, --preset <name>', 'Use a framework preset (nestjs, express, koa, fastify, generic)')
  .option('--platform <platform>', 'Target platform (node, browser, neutral)', 'node')
  .option('--format <format>', 'Output format (cjs, esm, iife)', 'cjs')
  .option('--target <target>', 'Target environment (e.g., node18)', 'node18')
  .option('--no-minify', 'Disable code minification')
  .option('--sourcemap [type]', 'Generate source maps (true, inline, external, both)')
  .option('--external <modules...>', 'External modules to exclude from bundle')
  .option('--exclude-packages', 'Exclude all npm packages from bundle')
  .option('--keep-names', 'Preserve function and class names')
  .option('--no-tree-shaking', 'Disable tree shaking')
  .option('--define <key=value...>', 'Define global constants')
  .option('--alias <key=value...>', 'Define import aliases')
  .option('--watch', 'Watch for file changes and rebuild')
  .option('--analyze', 'Show bundle analysis')
  .action(async (options) => {
    try {
      const config = await buildConfig(options);
      
      if (options.watch) {
        console.log(chalk.blue('🔍 Starting watch mode...'));
        // Watch mode would be implemented here
        console.log(chalk.yellow('⚠️  Watch mode is not implemented yet'));
        return;
      }

      await runBuild(config, options.analyze);
    } catch (error) {
      console.error(chalk.red('❌ Build failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * List presets command
 */
program
  .command('presets')
  .description('List available framework presets')
  .action(() => {
    console.log(chalk.blue('\n📦 Available Framework Presets:\n'));
    
    const presets = listPresets();
    presets.forEach(preset => {
      console.log(chalk.green(`  ${preset.name}`));
      console.log(chalk.gray(`    ${preset.description}`));
      console.log();
    });
  });

/**
 * Build configuration from CLI options
 */
async function buildConfig(options: any): Promise<BackbundleConfig> {
  let entry = options.input;
  let output = options.output;

  // Auto-detect entry point if not provided
  if (!entry) {
    entry = detectEntryPoint();
    if (!entry) {
      throw new Error('Could not detect entry point. Please specify with --input option.');
    }
    console.log(chalk.blue('🔍 Auto-detected entry point:'), chalk.cyan(entry));
  }

  // Auto-detect framework if preset not specified
  let preset = options.preset;
  if (!preset) {
    const detectedFramework = detectFramework();
    if (detectedFramework) {
      preset = detectedFramework;
      console.log(chalk.blue('🔍 Auto-detected framework:'), chalk.cyan(preset));
    }
  }

  // Generate output filename if not provided
  if (!output) {
    const inputBasename = basename(entry, extname(entry));
    output = resolve(process.cwd(), 'dist', `${inputBasename}.js`);
  }

  // Ensure output directory exists
  const outputDir = dirname(output);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Start with base config
  let config: BackbundleConfig = {
    entry: resolve(entry),
    output: resolve(output),
    platform: options.platform,
    format: options.format,
    target: options.target,
    minify: options.minify !== false,
    sourcemap: options.sourcemap || false,
    keepNames: options.keepNames || false,
    treeShaking: options.treeShaking !== false,
    excludePackages: options.excludePackages || false,
  };

  // Apply preset if specified
  if (preset) {
    const presetConfig = getPreset(preset);
    if (presetConfig) {
      config = { ...presetConfig.config, ...config };
      console.log(chalk.blue('🎯 Using preset:'), chalk.cyan(preset));
    } else {
      console.warn(chalk.yellow('⚠️  Unknown preset:'), preset);
    }
  }

  // Handle external modules
  if (options.external) {
    config.external = [...(config.external || []), ...options.external];
  }

  // Handle defines
  if (options.define) {
    config.define = config.define || {};
    options.define.forEach((def: string) => {
      const [key, value] = def.split('=');
      if (key && value) {
        config.define![key] = value;
      }
    });
  }

  // Handle aliases
  if (options.alias) {
    config.alias = config.alias || {};
    options.alias.forEach((alias: string) => {
      const [key, value] = alias.split('=');
      if (key && value) {
        config.alias![key] = value;
      }
    });
  }

  return config;
}

/**
 * Run the build process
 */
async function runBuild(config: BackbundleConfig, analyze = false): Promise<void> {
  const spinner = ora('Building bundle...').start();

  try {
    const result = await bundle(config);
    
    if (result.success) {
      spinner.succeed(chalk.green('✅ Bundle created successfully!'));
      
      console.log(chalk.blue('\n📊 Build Summary:'));
      console.log(chalk.gray(`   Entry:  ${config.entry}`));
      console.log(chalk.gray(`   Output: ${result.outputPath}`));
      console.log(chalk.gray(`   Size:   ${formatBytes(result.size)}`));
      console.log(chalk.gray(`   Time:   ${result.time}ms`));
      
      if (result.warnings && result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        result.warnings.forEach(warning => {
          console.log(chalk.yellow(`   ${warning}`));
        });
      }

      if (analyze) {
        console.log(chalk.blue('\n📈 Bundle Analysis:'));
        console.log(chalk.gray('   Analysis feature coming soon...'));
      }
    } else {
      spinner.fail(chalk.red('❌ Build failed!'));
      
      if (result.errors && result.errors.length > 0) {
        console.log(chalk.red('\n🚨 Errors:'));
        result.errors.forEach(error => {
          console.log(chalk.red(`   ${error}`));
        });
      }
      
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(chalk.red('❌ Build failed!'));
    throw error;
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Parse CLI arguments
program.parse();
