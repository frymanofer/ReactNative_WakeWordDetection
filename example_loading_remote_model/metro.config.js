const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Wake word (.dm / .onnx) and speaker verification (.dm) models can also be loaded with require().
module.exports = mergeConfig(defaultConfig, {
  resolver: { assetExts: [...defaultConfig.resolver.assetExts, 'dm', 'onnx'] },
});
