module.exports = {
  preset: 'react-native',
  // Model and sound files are binary: a require() of one gets a stub in tests.
  moduleNameMapper: { '\\.(dm|onnx|mp3|wav)$': '<rootDir>/jest/assetStub.js' },
};
