const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add path aliases
config.resolver.extraNodeModules = {
  '@': path.resolve(__dirname),
};

module.exports = config;
