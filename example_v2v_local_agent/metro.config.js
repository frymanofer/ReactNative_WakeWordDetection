// metro.config.js
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// language_packs.json -> src/tts/languagePacks.generated.ts (which language models are bundled vs downloaded).
// Runs on every bundle (dev server, Android release, iOS) so the JSON is all that needs editing; a bad config fails the build.
require('./scripts/generate-language-packs').generate();

const config = {
  resolver: {
    assetExts: [
      ...(defaultConfig.resolver.assetExts || []),
      'dm',
      'onnx',
      'json',
      'onnx',
      'wav',
      'mp3'
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
