import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { inspectArchitecture } from './architecture-policy.js';

const roots: string[] = [];

function workspace(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'orgawork-architecture-'));
  roots.push(root);
  return root;
}

function write(root: string, path: string, content: string): void {
  const target = resolve(root, path);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('architecture policy', () => {
  it('accepts declared app to package dependencies', () => {
    const root = workspace();
    write(root, 'packages/kernel/package.json', JSON.stringify({ name: '@workspace/kernel' }));
    write(root, 'packages/kernel/src/index.ts', 'export const value = 1;\n');
    write(
      root,
      'apps/api/package.json',
      JSON.stringify({
        name: '@workspace/api',
        dependencies: { '@workspace/kernel': 'workspace:*' },
      }),
    );
    write(
      root,
      'apps/api/src/index.ts',
      "import { value } from '@workspace/kernel';\nvoid value;\n",
    );

    expect(inspectArchitecture(root).issues).toEqual([]);
  });

  it('rejects cycles between workspace packages', () => {
    const root = workspace();
    write(
      root,
      'packages/a/package.json',
      JSON.stringify({
        name: '@workspace/a',
        dependencies: { '@workspace/b': 'workspace:*' },
      }),
    );
    write(
      root,
      'packages/b/package.json',
      JSON.stringify({
        name: '@workspace/b',
        dependencies: { '@workspace/a': 'workspace:*' },
      }),
    );

    expect(inspectArchitecture(root).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CYCLE' })]),
    );
  });

  it('rejects package dependencies on applications', () => {
    const root = workspace();
    write(root, 'apps/api/package.json', JSON.stringify({ name: '@workspace/api' }));
    write(
      root,
      'packages/kernel/package.json',
      JSON.stringify({
        name: '@workspace/kernel',
        dependencies: { '@workspace/api': 'workspace:*' },
      }),
    );
    write(root, 'packages/kernel/src/index.ts', "import '@workspace/api';\n");

    expect(inspectArchitecture(root).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'FORBIDDEN_LAYER_DEPENDENCY',
        }),
      ]),
    );
  });

  it('rejects undeclared workspace imports including subpaths', () => {
    const root = workspace();
    write(root, 'packages/kernel/package.json', JSON.stringify({ name: '@workspace/kernel' }));
    write(root, 'apps/api/package.json', JSON.stringify({ name: '@workspace/api' }));
    write(root, 'apps/api/src/index.ts', "import '@workspace/kernel/internal';\n");

    expect(inspectArchitecture(root).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNDECLARED_WORKSPACE_DEPENDENCY',
          target: '@workspace/kernel',
        }),
      ]),
    );
  });
});
