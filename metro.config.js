const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for .tflite files
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'tflite',
];

module.exports = config;