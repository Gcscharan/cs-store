const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [
  path.resolve(workspaceRoot, 'packages/types'),
  path.resolve(workspaceRoot, 'packages/shared-utils'),
  path.resolve(workspaceRoot, 'packages/i18n'),
];
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = true;

// 4. Resolve workspace packages
config.resolver.extraNodeModules = {
  '@vyaparsetu/types': path.resolve(workspaceRoot, 'packages/types'),
  '@vyaparsetu/shared-utils': path.resolve(workspaceRoot, 'packages/shared-utils'),
  '@vyaparsetu/i18n': path.resolve(workspaceRoot, 'packages/i18n'),
};

module.exports = config;
