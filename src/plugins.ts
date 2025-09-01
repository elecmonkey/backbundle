// Re-export everything from the plugins directory
export * from './plugins/index.js';

// For backward compatibility, also export the main function
export { getAllPlugins as getPlugins } from './plugins/index.js';
