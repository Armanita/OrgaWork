import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkClosureDocuments, prepareClosureDocuments } from './closure.js';
import type { VerificationReport } from './runner.js';
import { getStageDefinition } from './stages.js';

function write(root: string, relative: string, body: string): void {
  const full = join(root, relative);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

describe('Stage 00 trust bootstrap closure', () => {
  it('records a readable trust baseline without changing product acceptance semantics', () => {
    const root = mkdtempSync(join(tmpdir(), 'orgawork-stage00-'));
    const stage = getStageDefinition('STAGE-00');
    const technicalCommit = '1111111111111111111111111111111111111111';
    const evidence = 'EVD-TEST-STAGE00';

    try {
      write(
        root,
        'docs/PROJECT-STATUS.md',
        [
          '# وضعیت پروژه',
          '- فاز جاری کلان: `P3 — پرونده، مسئولیت و اقدام`',
          '- مرحله مادر جاری: `P3 — پرونده، مسئولیت و اقدام`',
          '- زیرمرحله جاری: `P3.1 — تثبیت قرارداد دامنه پرونده`',
          '- آخرین زیرمرحله بسته‌شده: `P3.1 — تثبیت قرارداد دامنه پرونده`',
          '',
        ].join('\n'),
      );
      write(
        root,
        'docs/ROADMAP.md',
        [
          '# نقشه راه',
          '- مرحله جاری: `P3 — پرونده، مسئولیت و اقدام`',
          '- [x] P3.1 تثبیت قرارداد دامنه پرونده',
          '- [ ] P3.2 پیاده‌سازی ایجاد پرونده توسط کاربر',
          '',
        ].join('\n'),
      );
      write(root, 'docs/IMPLEMENTATION-JOURNAL.md', '# Journal\n');
      write(root, 'docs/TRACEABILITY-MATRIX.md', '# Traceability\n');
      write(root, 'docs/TEST-AND-ACCEPTANCE.md', '# Tests\n');
      write(root, 'docs/RISKS-ASSUMPTIONS-DEBT.md', '# Risks\n');
      write(root, 'docs/DECISIONS.md', '# Decisions\n');
      write(root, 'docs/VERIFICATION-SYSTEM.md', '# Verification\n');
      write(root, 'docs/CONTINUATION-PROTOCOL.md', '# Continuation\n');

      const report = {
        schemaVersion: 1,
        profile: 'stage',
        stage: 'STAGE-00',
        gitHead: technicalCommit,
        changedFiles: [],
        startedAt: '2026-08-17T00:00:00.000Z',
        finishedAt: '2026-08-17T00:01:00.000Z',
        passed: true,
        results: stage.gates.map((id) => ({
          id,
          label: id,
          status: 'passed',
          durationMs: 1,
        })),
      } as VerificationReport;

      prepareClosureDocuments(root, stage, evidence, technicalCommit, report);
      checkClosureDocuments(root, stage, evidence, false);

      const status = readFileSync(join(root, 'docs/PROJECT-STATUS.md'), 'utf8');
      const roadmap = readFileSync(join(root, 'docs/ROADMAP.md'), 'utf8');

      expect(status).toContain('- زیرمرحله جاری: `P3.2 — پیاده‌سازی ایجاد پرونده توسط کاربر`');
      expect(status).toContain('\n<!-- ORGAWORK:TRUST-BASELINE:STAGE-00 -->\n');
      expect(status).not.toContain('\\n<!-- ORGAWORK:TRUST-BASELINE:STAGE-00 -->');
      expect(status).toContain('- آخرین زیرمرحله بسته‌شده: `P3.1 — تثبیت قرارداد دامنه پرونده`');

      expect(roadmap).toContain('- [x] P3.1 تثبیت قرارداد دامنه پرونده');
      expect(roadmap).toContain('- [ ] P3.2 پیاده‌سازی ایجاد پرونده توسط کاربر');
      expect(roadmap).toContain('\n<!-- ORGAWORK:TRUST-BASELINE:STAGE-00 -->\n');
      expect(roadmap).not.toContain('\\n<!-- ORGAWORK:TRUST-BASELINE:STAGE-00 -->');
      expect(roadmap).not.toContain('- [x] Stage 00');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
