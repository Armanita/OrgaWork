import { defineConfig } from '@playwright/test';

const apiStubUrl = 'http://127.0.0.1:3317';

export default defineConfig({
  testDir: './tools/browser',
  testMatch: '**/*.pw.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: 'node_modules/.cache/orgawork-playwright',
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:3217',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: [
    {
      command: 'node tools/browser/p2r-api-stub.mjs',
      url: `${apiStubUrl}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @workspace/web start --hostname 127.0.0.1 --port 3217',
      url: 'http://127.0.0.1:3217/login',
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ORGAWORK_API_INTERNAL_URL: apiStubUrl,
      },
    },
  ],
});
