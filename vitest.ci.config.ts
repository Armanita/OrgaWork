import { configDefaults, defineConfig } from 'vitest/config';

import { testTimeoutPolicy } from './tools/verification/test-policy.js';

export default defineConfig({
  test: {
    testTimeout: testTimeoutPolicy.acceptanceMs,
    hookTimeout: testTimeoutPolicy.acceptanceMs,
    exclude: [...configDefaults.exclude, 'artifacts/**'],
    reporters: [
      'default',
      [
        'junit',
        {
          outputFile: 'artifacts/test-results/junit.xml',
          suiteName: 'OrgaWork',
        },
      ],
    ],
    coverage: {
      provider: 'v8',
      include: [
        'apps/**/src/**/*.{ts,tsx}',
        'apps/web/lib/**/*.{ts,tsx}',
        'packages/**/src/**/*.{ts,tsx}',
        'tools/checks/**/*.ts',
        'tools/scripts/**/*.ts',
        'tools/acceptance/**/*.ts',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/dist/**',
        '**/.next/**',
        '**/generated-contract.ts',
      ],
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: 'artifacts/coverage',
      clean: true,
    },
  },
});
