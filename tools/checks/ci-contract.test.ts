import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ciSuiteGateIds, fullGateIds } from '../verification/gates.js';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const branchProtection = readFileSync('.github/BRANCH-PROTECTION.md', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  readonly scripts: Readonly<Record<string, string>>;
};
const vitestConfiguration = readFileSync('vitest.ci.config.ts', 'utf8');

describe('continuous integration contract', () => {
  it('uses the pnpm 11 standalone setup path with an explicit frozen install', () => {
    expect(workflow).toContain('ubuntu-latest');
    expect(workflow).toContain('windows-latest');
    expect(workflow).toContain('pnpm/setup@c9883cc79df532ad1a7b81bf9ab944ceb090d65c # v2.0.0');
    expect(workflow).toContain('runtime: node@24');
    expect(workflow).toContain('cache: true');
    expect(workflow).toContain('install: false');
    expect(workflow).not.toContain('pnpm/action-setup');
    expect(workflow).not.toContain('actions/setup-node');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).not.toContain('--no-frozen-lockfile');
    expect(workflow).not.toContain('frozen-lockfile=false');
  });

  it('routes CI gates through the centralized verification runner', () => {
    for (const suite of [
      'quality',
      'quality-coverage',
      'contracts',
      'architecture',
      'build',
      'audit',
    ]) {
      expect(workflow).toContain(`--suite ${suite}`);
    }

    for (const directCommand of [
      'pnpm prepare:quality',
      'pnpm format:check',
      'pnpm lint',
      'pnpm typecheck',
      'pnpm test:ci',
      'pnpm test:coverage:ci',
      'pnpm ci:contracts',
      'pnpm ci:migrations',
      'pnpm ci:architecture',
      'pnpm ci:security',
      'pnpm build:apps:direct',
      'pnpm audit --prod --audit-level=high',
    ]) {
      expect(workflow).not.toContain(directCommand);
    }
  });

  it('keeps all required gates in centralized CI suites and full verification', () => {
    expect(ciSuiteGateIds.contracts).toEqual([
      'prepare-quality',
      'build-p2-modules',
      'contracts',
      'migrations',
    ]);
    expect(ciSuiteGateIds.build).toEqual(['prepare-quality', 'build-p2-modules', 'build-apps']);

    for (const gate of [
      'format-all',
      'lint-all',
      'typecheck-all',
      'coverage-ci',
      'contracts',
      'migrations',
      'architecture',
      'security',
      'build-apps',
      'dependency-audit',
    ] as const) {
      expect(fullGateIds).toContain(gate);
    }
  });

  it('stores JUnit coverage verification and CI summary artifacts', () => {
    expect(workflow).toContain('actions/upload-artifact@v6');
    expect(workflow).toContain('path: artifacts/');
    expect(vitestConfiguration).toContain("'junit'");
    expect(vitestConfiguration).toContain('artifacts/test-results/junit.xml');
    expect(vitestConfiguration).toContain('artifacts/coverage');
    expect(packageJson.scripts['ci:report']).toBe('tsx tools/scripts/ci-report.ts');
    expect(packageJson.scripts['verify:ci']).toBe('tsx tools/verification/runner.ts ci');
  });

  it('keeps the existing branch-protection check names stable', () => {
    expect(workflow).toContain('name: Quality (${{ matrix.os }})');
    expect(workflow).toContain('name: Architecture and repository policy (${{ matrix.os }})');

    for (const operatingSystem of ['ubuntu-latest', 'windows-latest'] as const) {
      expect(workflow).toContain(`- ${operatingSystem}`);
      expect(branchProtection).toContain(`Quality (${operatingSystem})`);
      expect(branchProtection).toContain(`Architecture and repository policy (${operatingSystem})`);
    }

    for (const staticName of [
      'Contracts OpenAPI and migrations',
      'Build four applications',
      'Dependency vulnerability audit',
    ]) {
      expect(workflow).toContain(`name: ${staticName}`);
      expect(branchProtection).toContain(staticName);
    }

    expect(branchProtection).toContain(
      'Remote branch protection is not changed by local project scripts',
    );
  });
});
