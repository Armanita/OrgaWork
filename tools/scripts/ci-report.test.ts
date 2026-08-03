import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCiReport } from './ci-report.js';

const roots: string[] = [];

function repository(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'orgawork-ci-report-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('CI artifact report', () => {
  it('writes machine-readable and Markdown summaries', () => {
    const root = repository();
    mkdirSync(resolve(root, 'artifacts/coverage'), {
      recursive: true,
    });
    mkdirSync(resolve(root, 'artifacts/test-results'), {
      recursive: true,
    });
    writeFileSync(
      resolve(root, 'artifacts/coverage/coverage-summary.json'),
      JSON.stringify({ total: { lines: { pct: 82 } } }),
      'utf8',
    );
    writeFileSync(resolve(root, 'artifacts/coverage/lcov.info'), 'TN:\n', 'utf8');
    writeFileSync(resolve(root, 'artifacts/test-results/junit.xml'), '<testsuites />\n', 'utf8');

    const report = createCiReport(
      root,
      {
        status: 'success',
        commit: 'abc123',
        ref: 'refs/heads/main',
        runId: '42',
        operatingSystem: 'Linux',
      },
      new Date('2026-08-03T00:00:00.000Z'),
    );

    expect(report.artifacts).toEqual({
      junit: true,
      coverageSummary: true,
      lcov: true,
    });
    expect(existsSync(resolve(root, 'artifacts/ci/summary.json'))).toBe(true);
    expect(readFileSync(resolve(root, 'artifacts/ci/summary.md'), 'utf8')).toContain(
      'Status: success',
    );
  });
});
