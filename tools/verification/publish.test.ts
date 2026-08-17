import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { prepareClosureDocuments, reportDirectory } from './closure.js';
import { parseAheadBehind, parsePublishArguments, publishStageClosure } from './publish.js';
import type { VerificationReport } from './runner.js';
import { getStageDefinition } from './stages.js';

function git(cwd: string, args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
  }).trim();
}

function writeFixtureDocs(root: string): void {
  mkdirSync(resolve(root, 'docs/acceptance'), { recursive: true });

  writeFileSync(
    resolve(root, 'docs/ROADMAP.md'),
    [
      '- مرحله جاری: `P3 — پرونده، مسئولیت و اقدام`',
      '- آخرین زیرمرحله بسته‌شده: `P2R.1.8 — پذیرش اصلاح رابط`',
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

  for (const [file, title] of [
    ['IMPLEMENTATION-JOURNAL.md', '# Journal\n'],
    ['TRACEABILITY-MATRIX.md', '# Traceability\n'],
    ['TEST-AND-ACCEPTANCE.md', '# Test\n'],
    ['RISKS-ASSUMPTIONS-DEBT.md', '# Risks\n'],
    ['DECISIONS.md', '# Decisions\n'],
  ] as const) {
    writeFileSync(resolve(root, 'docs', file), title, 'utf8');
  }
}

describe('stage closure publication', () => {
  it('parses publication arguments and rev-list counts', () => {
    expect(parsePublishArguments(['--', '--stage', 'P3.1', '--evidence', 'EVD-TEST'])).toEqual({
      stage: 'P3.1',
      evidence: 'EVD-TEST',
    });

    expect(parseAheadBehind('0\t2')).toEqual({
      behind: 0,
      ahead: 2,
    });
  });

  it('commits, tags and atomically publishes prepared closure documents to a local bare remote', () => {
    const sandbox = mkdtempSync(resolve(tmpdir(), 'orgawork-publish-'));
    const remote = resolve(sandbox, 'remote.git');
    const root = resolve(sandbox, 'repo');

    execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
    execFileSync('git', ['init', '-b', 'main', root], { stdio: 'ignore' });

    git(root, ['config', 'user.name', 'OrgaWork Test']);
    git(root, ['config', 'user.email', 'orgawork-test@example.invalid']);
    git(root, ['remote', 'add', 'origin', remote]);

    writeFixtureDocs(root);
    git(root, ['add', '.']);
    git(root, ['commit', '-m', 'base']);
    git(root, ['push', '-u', 'origin', 'main']);

    writeFileSync(resolve(root, 'technical.txt'), 'accepted technical work\n', 'utf8');
    git(root, ['add', 'technical.txt']);
    git(root, ['commit', '-m', 'technical']);

    const technicalCommit = git(root, ['rev-parse', 'HEAD']);
    const stage = getStageDefinition('P3.1');
    const report: VerificationReport = {
      schemaVersion: 1,
      profile: 'stage',
      stage: 'P3.1',
      gitHead: technicalCommit,
      changedFiles: [],
      startedAt: '2026-08-17T08:00:00.000Z',
      finishedAt: '2026-08-17T08:01:00.000Z',
      results: [
        {
          id: 'p3-contract-test',
          label: 'P3 contract test',
          status: 'passed',
          durationMs: 10,
          exitCode: 0,
        },
      ],
      passed: true,
    };

    const reportDir = reportDirectory(root);
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(
      resolve(reportDir, 'latest.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );

    const prepared = prepareClosureDocuments(root, stage, 'EVD-TEST', technicalCommit, report);
    git(root, ['add', '--', ...prepared.paths]);

    publishStageClosure(root, {
      stage: 'P3.1',
      evidence: 'EVD-TEST',
    });

    const closureCommit = git(root, ['rev-parse', 'HEAD']);
    expect(git(remote, ['rev-parse', 'refs/heads/main'])).toBe(closureCommit);
    expect(
      git(remote, ['rev-list', '-n', '1', 'refs/tags/stage-p3.1-case-domain-contract-acceptance']),
    ).toBe(closureCommit);
    expect(git(root, ['status', '--porcelain'])).toBe('');

    // Re-running after a successful atomic push is idempotent.
    expect(() =>
      publishStageClosure(root, {
        stage: 'P3.1',
        evidence: 'EVD-TEST',
      }),
    ).not.toThrow();
  }, 60_000);
});
