import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { inspectRepositorySecurity } from './repository-security.js';

const roots: string[] = [];

function repository(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'orgawork-security-'));
  roots.push(root);
  return root;
}

function write(root: string, path: string, content: string | Buffer): void {
  const target = resolve(root, path);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, content);
}

function baseline(root: string): void {
  write(
    root,
    'package.json',
    JSON.stringify({
      name: 'fixture',
      private: true,
      dependencies: { vitest: '4.1.10' },
    }),
  );
  write(
    root,
    'pnpm-lock.yaml',
    'lockfileVersion: 9.0\nimporters:\n  .: {}\npackages:\n  vitest@4.1.10: {}\n',
  );
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('repository security policy', () => {
  it('accepts pinned dependencies and sample credentials', () => {
    const root = repository();
    baseline(root);
    write(root, '.env.example', 'POSTGRES_PASSWORD=<define-in-env-local>\n');

    expect(
      inspectRepositorySecurity(root, {
        trackedPaths: ['package.json', 'pnpm-lock.yaml', '.env.example'],
      }).issues,
    ).toEqual([]);
  });

  it('rejects unpinned and remote dependency sources', () => {
    const root = repository();
    baseline(root);
    write(
      root,
      'packages/a/package.json',
      JSON.stringify({
        name: '@workspace/a',
        dependencies: {
          first: '^1.0.0',
          second: 'https://example.invalid/archive.tgz',
        },
      }),
    );

    const issues = inspectRepositorySecurity(root, {
      trackedPaths: ['package.json', 'pnpm-lock.yaml'],
    }).issues;

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNPINNED_DEPENDENCY' }),
        expect.objectContaining({
          code: 'UNSAFE_DEPENDENCY_SOURCE',
        }),
      ]),
    );
  });

  it('rejects tracked environment files and private keys', () => {
    const root = repository();
    baseline(root);
    write(root, '.env.local', 'TOKEN=real-value\n');
    write(root, 'key.pem', ['-----BEGIN ', 'PRIVATE KEY-----\nnot-a-real-key\n'].join(''));

    const issues = inspectRepositorySecurity(root, {
      trackedPaths: ['package.json', 'pnpm-lock.yaml', '.env.local', 'key.pem'],
    }).issues;

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TRACKED_ENV_FILE' }),
        expect.objectContaining({ code: 'HIGH_CONFIDENCE_SECRET' }),
      ]),
    );
  });

  it('rejects invalid UTF-8 text files', () => {
    const root = repository();
    baseline(root);
    write(root, 'broken.md', Buffer.from([0xc3, 0x28]));

    expect(
      inspectRepositorySecurity(root, {
        trackedPaths: ['package.json', 'pnpm-lock.yaml', 'broken.md'],
      }).issues,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_UTF8' })]));
  });
});
