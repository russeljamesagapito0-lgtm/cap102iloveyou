module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['babel-preset-expo'] }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo|@expo|@unimodules|unimodules|base64-arraybuffer)/'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/']
};
