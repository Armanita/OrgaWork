import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { testTimeoutPolicy, timeoutForTestClass } from './test-policy.js';

describe('verification test timeout policy', () => {
  it('keeps unit tests strict and gives bounded headroom to heavy verification', () => {
    expect(testTimeoutPolicy.unitMs).toBe(5_000);
    expect(testTimeoutPolicy.acceptanceMs).toBe(30_000);
    expect(testTimeoutPolicy.publicationMs).toBe(60_000);
    expect(testTimeoutPolicy.unitMs).toBeLessThan(testTimeoutPolicy.acceptanceMs);
    expect(testTimeoutPolicy.acceptanceMs).toBeLessThan(testTimeoutPolicy.publicationMs);
  });

  it('resolves timeout classes from one source of truth', () => {
    expect(timeoutForTestClass('unitMs')).toBe(5_000);
    expect(timeoutForTestClass('acceptanceMs')).toBe(30_000);
    expect(timeoutForTestClass('publicationMs')).toBe(60_000);
  });

  it('wires acceptance and CI configs to the same central policy', () => {
    const acceptanceConfig = readFileSync('vitest.acceptance.config.ts', 'utf8');
    const ciConfig = readFileSync('vitest.ci.config.ts', 'utf8');
    const packageJson = readFileSync('package.json', 'utf8');

    expect(acceptanceConfig).toContain('testTimeout: testTimeoutPolicy.acceptanceMs');
    expect(acceptanceConfig).toContain('hookTimeout: testTimeoutPolicy.acceptanceMs');
    expect(ciConfig).toContain('testTimeout: testTimeoutPolicy.acceptanceMs');
    expect(ciConfig).toContain('hookTimeout: testTimeoutPolicy.acceptanceMs');
    expect(packageJson).toContain(
      '"test:acceptance": "vitest run --config vitest.acceptance.config.ts"',
    );
  });
});
