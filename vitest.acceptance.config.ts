import { configDefaults, defineConfig } from 'vitest/config';

import { testTimeoutPolicy } from './tools/verification/test-policy.js';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'artifacts/**'],
    testTimeout: testTimeoutPolicy.acceptanceMs,
    hookTimeout: testTimeoutPolicy.acceptanceMs,
  },
});
