import { defineConfig } from '@playwright/test';

const apiStubUrl = 'http://127.0.0.1:3318';

export default defineConfig({
  testDir: './tools/browser',
  testMatch: '**/wm01-create-own-case.pw.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: 'node_modules/.cache/orgawork-playwright-wm01',
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:3218',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: [
    {
      command: 'node tools/browser/wm01-api-stub.mjs',
      url: `${apiStubUrl}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @workspace/web start --hostname 127.0.0.1 --port 3218',
      url: 'http://127.0.0.1:3218/cases/new',
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
