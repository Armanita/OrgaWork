import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('verification system documentation contract', () => {
  it('keeps the central verification system discoverable from continuation docs', () => {
    const continuation = read('docs/CONTINUATION-PROTOCOL.md');
    const readme = read('docs/README.md');

    expect(continuation).toContain('docs/VERIFICATION-SYSTEM.md');
    expect(readme).toContain('docs/VERIFICATION-SYSTEM.md');
  });

  it('documents the executable verification and closure contract', () => {
    const document = read('docs/VERIFICATION-SYSTEM.md');

    for (const marker of [
      'pnpm verify:fast',
      'pnpm verify:stage -- --stage <stage-id>',
      'pnpm verify:full',
      'pnpm verify:infra',
      'pnpm verify:ci -- --suite <suite-id>',
      'pnpm stage:close:prepare',
      'pnpm stage:close:publish',
      'Historical Acceptance',
      'Current-State Invariants',
      'tools/verification/test-policy.ts',
      'git write-tree',
      'pnpm install --frozen-lockfile',
      'pnpm-workspace.yaml',
      'Default deny',
    ]) {
      expect(document).toContain(marker);
    }
  });

  it('keeps destructive Git operations explicitly outside the normal workflow', () => {
    const document = read('docs/VERIFICATION-SYSTEM.md');

    expect(document).toContain('git reset --hard');
    expect(document).toContain('git clean -fd');
    expect(document).toContain('Force push');
    expect(document).toContain('بدون علت و Evidence روشن');
  });
});
