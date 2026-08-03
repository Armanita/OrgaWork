import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const branchProtection = readFileSync('.github/BRANCH-PROTECTION.md', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  readonly scripts: Readonly<Record<string, string>>;
};
const vitestConfiguration = readFileSync('vitest.ci.config.ts', 'utf8');

describe('continuous integration contract', () => {
  it('uses frozen lockfile installation on Linux and Windows', () => {
    expect(workflow).toContain('ubuntu-latest');
    expect(workflow).toContain('windows-latest');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).not.toContain('--no-frozen-lockfile');
    expect(workflow).not.toContain('frozen-lockfile=false');
  });

  it('contains all required quality and architecture gates', () => {
    for (const command of [
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
      expect(workflow).toContain(command);
    }
  });

  it('stores JUnit coverage and CI summary artifacts', () => {
    expect(workflow).toContain('actions/upload-artifact@v6');
    expect(workflow).toContain('path: artifacts/');
    expect(vitestConfiguration).toContain("'junit'");
    expect(vitestConfiguration).toContain('artifacts/test-results/junit.xml');
    expect(vitestConfiguration).toContain('artifacts/coverage');
    expect(packageJson.scripts['ci:report']).toBe('tsx tools/scripts/ci-report.ts');
  });

  it('defines direct builds for all four applications', () => {
    const script = packageJson.scripts['build:apps:direct'];

    expect(script).toContain('@workspace/web');
    expect(script).toContain('@workspace/api');
    expect(script).toContain('@workspace/worker');
    expect(script).toContain('@workspace/scheduler');
    expect(script).not.toContain('turbo');
  });

  it('records the branch protection baseline without claiming remote mutation', () => {
    expect(branchProtection).toContain(
      'Remote branch protection is not changed by local project scripts',
    );
    expect(branchProtection).toContain('Require a pull request before merging');
  });
});
