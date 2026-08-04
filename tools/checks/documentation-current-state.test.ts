import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function document(path: string): string {
  return readFileSync(resolve(root, 'docs', path), 'utf8');
}

describe('current documentation state after P2 acceptance', () => {
  it('keeps historical P1 and P2 evidence discoverable', () => {
    const readme = document('README.md');
    const status = document('PROJECT-STATUS.md');
    const journal = document('IMPLEMENTATION-JOURNAL.md');

    expect(readme).toContain('acceptance/P1-FINAL-ACCEPTANCE.md');
    expect(readme).toContain('acceptance/P0-P2.3-FULL-AUDIT.md');
    expect(readme).toContain('acceptance/P2-FINAL-ACCEPTANCE.md');

    for (const commit of [
      'f7bcd86b617f299a5d26329a4a3386cc7537c5fe',
      '78612b5459343d05a73ea7e12f074793543e9047',
      '75bedac73e64bf144c43ad43339abb36684d3c00',
      '6963796e81580527e3a719895c83c03eb5f71fb1',
    ]) {
      expect(status + journal).toContain(commit);
    }
  });

  it('records P2 as closed and P3.1 as current', () => {
    const status = document('PROJECT-STATUS.md');
    const roadmap = document('ROADMAP.md');
    const journal = document('IMPLEMENTATION-JOURNAL.md');

    expect(status).toContain('مرحله مادر `P2`: بسته و پذیرفته‌شده');
    expect(status).toContain('زیرمرحله جاری: `P3.1 — تثبیت قرارداد دامنه پرونده`');
    expect(roadmap).toContain('- [x] P2.15 آزمون و پذیرش مرحله');
    expect(roadmap).toContain('- [ ] P3.1 تثبیت قرارداد دامنه پرونده');
    expect(journal).toContain('شاهد نهایی: `EVD-041`');
  });

  it('keeps final P2 traceability and acceptance aligned', () => {
    const traceability = document('TRACEABILITY-MATRIX.md');
    const acceptance = document('TEST-AND-ACCEPTANCE.md');
    const finalEvidence = document('acceptance/P2-FINAL-ACCEPTANCE.md');

    expect(traceability).toContain('## EVD-041 — شاهد پذیرش نهایی P2');
    expect(acceptance).toContain('شاهد رسمی این پذیرش `EVD-041` است');
    expect(finalEvidence).toContain('P2.4` تا `P2.15');
    expect(finalEvidence).toContain('Migrationهای نسخه 5 تا 9');
  });

  it('keeps the preapproved UI baseline and records its implementation', () => {
    const decisions = document('DECISIONS.md');
    const risks = document('RISKS-ASSUMPTIONS-DEBT.md');

    expect(decisions).toContain('DEC-UI-001');
    expect(decisions).toContain('Vazirmatn');
    expect(risks).toContain('رابط بر خط مبنای مصوب اجرا شد');
  });

  it('does not reopen closed P2 stages', () => {
    const roadmap = document('ROADMAP.md');
    const status = document('PROJECT-STATUS.md');

    for (let stage = 4; stage <= 15; stage += 1) {
      expect(roadmap).toContain(`- [x] P2.${stage}`);
    }
    expect(status).not.toContain('مرحله مادر جاری: `P2');
  });
});
