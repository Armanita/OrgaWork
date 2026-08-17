import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseClosureArguments,
  prepareClosureDocuments,
  validateVerificationReport,
} from './closure.js';
import type { VerificationReport } from './runner.js';
import { getStageDefinition } from './stages.js';

function fixtureRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'orgawork-closure-'));
  mkdirSync(resolve(root, 'docs/acceptance'), { recursive: true });

  writeFileSync(
    resolve(root, 'docs/ROADMAP.md'),
    [
      '- مرحله جاری: `P3 — پرونده، مسئولیت و اقدام`',
      '- آخرین زیرمرحله بسته‌شده: `P2R.1.8 — پذیرش اصلاح رابط`',
      '',
      '## P3 — پرونده، مسئولیت و اقدام',
      '',
      '- [ ] P3.1 تثبیت قرارداد دامنه پرونده',
      '- [ ] P3.2 پیاده‌سازی ایجاد پرونده توسط کاربر',
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(
    resolve(root, 'docs/PROJECT-STATUS.md'),
    [
      '- زیرمرحله جاری: `P3.1 — تثبیت قرارداد دامنه پرونده`',
      '- آخرین زیرمرحله بسته‌شده: `P2R.1.8 — پذیرش اصلاح رابط`',
      '- مرحله P3 به‌عنوان کل مرحله هنوز باز است؛ زیرمرحله‌های `P3.1` به بعد اجرا نشده‌اند.',
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(resolve(root, 'docs/IMPLEMENTATION-JOURNAL.md'), '# Journal\n', 'utf8');
  writeFileSync(resolve(root, 'docs/TRACEABILITY-MATRIX.md'), '# Traceability\n', 'utf8');
  writeFileSync(resolve(root, 'docs/TEST-AND-ACCEPTANCE.md'), '# Test\n', 'utf8');
  writeFileSync(resolve(root, 'docs/RISKS-ASSUMPTIONS-DEBT.md'), '# Risks\n', 'utf8');
  writeFileSync(resolve(root, 'docs/DECISIONS.md'), '# Decisions\n', 'utf8');

  return root;
}

function p31Report(): VerificationReport {
  return {
    schemaVersion: 1,
    profile: 'stage',
    stage: 'P3.1',
    gitHead: 'abc123',
    changedFiles: [],
    startedAt: '2026-08-17T08:00:00.000Z',
    finishedAt: '2026-08-17T08:05:00.000Z',
    results: [
      {
        id: 'p3-contract-test',
        label: 'P3.1 contract tests',
        status: 'passed',
        durationMs: 1200,
        exitCode: 0,
      },
    ],
    passed: true,
  };
}

describe('stage closure automation', () => {
  it('parses prepare and check commands with pnpm separator compatibility', () => {
    expect(
      parseClosureArguments(['prepare', '--', '--stage', 'P3.1', '--evidence', 'EVD-TEST']),
    ).toEqual({
      command: 'prepare',
      stage: 'P3.1',
      evidence: 'EVD-TEST',
      requireTag: false,
    });

    expect(parseClosureArguments(['check', '--stage', 'P3.1', '--require-tag'])).toEqual({
      command: 'check',
      stage: 'P3.1',
      evidence: undefined,
      requireTag: true,
    });
  });

  it('rejects stale, dirty, failed and under-specified stage reports', () => {
    const p31 = getStageDefinition('P3.1');

    expect(() =>
      validateVerificationReport({ ...p31Report(), passed: false }, p31, 'abc123'),
    ).toThrow('not PASS');

    expect(() =>
      validateVerificationReport({ ...p31Report(), changedFiles: ['x.ts'] }, p31, 'abc123'),
    ).toThrow('clean technical commit');

    expect(() => validateVerificationReport(p31Report(), p31, 'different')).toThrow(
      'current technical commit',
    );

    const p32 = getStageDefinition('P3.2');
    expect(() =>
      validateVerificationReport({ ...p31Report(), stage: 'P3.2' }, p32, 'abc123'),
    ).toThrow('cannot be closed until its stage-specific');
  });

  it('updates mandatory closure documents and creates acceptance evidence', () => {
    const root = fixtureRoot();
    const stage = getStageDefinition('P3.1');

    const prepared = prepareClosureDocuments(root, stage, 'EVD-TEST', 'abc123', p31Report());

    expect(prepared.paths).toContain('docs/acceptance/P3.1-ACCEPTANCE.md');

    expect(readFileSync(resolve(root, 'docs/ROADMAP.md'), 'utf8')).toContain(
      '- [x] P3.1 تثبیت قرارداد دامنه پرونده',
    );
    expect(readFileSync(resolve(root, 'docs/PROJECT-STATUS.md'), 'utf8')).toContain(
      '- زیرمرحله جاری: `P3.2 — پیاده‌سازی ایجاد پرونده توسط کاربر`',
    );
    expect(readFileSync(resolve(root, 'docs/IMPLEMENTATION-JOURNAL.md'), 'utf8')).toContain(
      '<!-- ORGAWORK:CLOSURE:P3.1 -->',
    );
    expect(readFileSync(resolve(root, 'docs/TRACEABILITY-MATRIX.md'), 'utf8')).toContain(
      '| P3.1 | EVD-TEST | `abc123` |',
    );
  });

  it('refuses duplicate closure preparation for the same stage', () => {
    const root = fixtureRoot();
    const stage = getStageDefinition('P3.1');

    prepareClosureDocuments(root, stage, 'EVD-TEST', 'abc123', p31Report());

    expect(() => prepareClosureDocuments(root, stage, 'EVD-TEST', 'abc123', p31Report())).toThrow();
  });
});
