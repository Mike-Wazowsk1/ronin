/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tests/tsconfig.json',
      isolatedModules: true,
    }],
  },
  collectCoverageFrom: [
    'tests/**/*.ts',
    '!tests/**/*.spec.ts',
    '!tests/**/*.d.ts',
  ],
  testTimeout: 60000, // 60s for slower bankrun tests
  verbose: true,
  maxWorkers: 1, // Bankrun is more reliable when run sequentially
  modulePathIgnorePatterns: ['<rootDir>/lib/client/pda.ts'],
};
