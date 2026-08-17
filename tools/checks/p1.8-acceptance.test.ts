import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { inspectArchitecture } from './architecture-policy.js';
import { inspectRepositorySecurity } from './repository-security.js';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

describe('پذیرش نهایی مرحله P1.8', () => {
  it('مرزهای معماری و وابستگی را بدون خطا بررسی می‌کند', () => {
    const report = inspectArchitecture(process.cwd());
    expect(report.workspaces.length).toBeGreaterThan(0);
    expect(report.sourceFiles).toBeGreaterThan(0);
    expect(report.issues).toEqual([]);
  }, 30_000);

  it('سیاست قفل وابستگی Secret و UTF-8 را بدون خطا بررسی می‌کند', () => {
    const report = inspectRepositorySecurity(process.cwd());

    expect(report.trackedFiles).toBeGreaterThan(0);
    expect(report.packageManifests).toBeGreaterThan(0);
    expect(report.issues).toEqual([]);
  }, 30_000);

  it('دروازه قرارداد OpenAPI و مهاجرت را از Runner مرکزی فراخوانی می‌کند', () => {
    expect(workflow).toContain('pnpm verify:ci -- --suite contracts --continue');
    expect(workflow).toContain('Contracts OpenAPI and migrations');
  });

  it('گزارش پوشش و Artifact را نگهداری می‌کند', () => {
    expect(workflow).toContain('--suite quality-coverage');
    expect(workflow).toContain('pnpm ci:report');
    expect(workflow).toContain('actions/upload-artifact@v6');
  });

  it('هیچ نصب غیرثابتی در گردش کار ندارد', () => {
    const installs = workflow.split(/\r?\n/u).filter((line) => line.includes('pnpm install'));

    expect(installs.length).toBeGreaterThan(0);
    expect(installs.every((line) => line.includes('--frozen-lockfile'))).toBe(true);
  });
});
