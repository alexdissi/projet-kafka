export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {},
  testTimeout: 60000, // 60 secondes pour les tests avec Testcontainers
  collectCoverageFrom: [
    'services/**/*.js',
    '!services/**/index.js',
    '!**/node_modules/**'
  ]
};