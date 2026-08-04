import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('current documentation state after P2R.1.2', () => {
  it('keeps historical P1 and P2 evidence discoverable', () => {
    const readme = read('docs/README.md');

    expect(readme).toContain('docs/acceptance/P1-FINAL-ACCEPTANCE.md');
    expect(readme).toContain('docs/acceptance/P0-P2.3-FULL-AUDIT.md');
    expect(readme).toContain('docs/acceptance/P2-FINAL-ACCEPTANCE.md');
  });

  it('records P2 as closed, P2R.1.2 as closed, and P2R.1.3 as current', () => {
    const status = read('docs/PROJECT-STATUS.md');
    const roadmap = read('docs/ROADMAP.md');

    expect(status).toContain('P2 با Commit نهایی `0be4eb3e1dcf63c358ed9a2751103d4d410eb30b` بسته');
    expect(status).toContain(
      'مرحله بسته‌شده: `P2R.1.2 — ایجاد زیرساخت چندزبانه English و فارسی با LTR و RTL`',
    );
    expect(status).toContain('مرحله جاری: `P2R.1.3 — ایجاد سیستم طراحی و مؤلفه‌های پایه`');
    expect(status).toContain('مرحله `P3.1` هنوز آغاز نشده');

    expect(roadmap).toContain('## P2R — اصلاح بنیاد رابط پیش از آغاز P3');
    expect(roadmap).toContain('- [x] P2R.1.1');
    expect(roadmap).toContain('- [x] P2R.1.2');
    expect(roadmap).toContain('- [ ] P2R.1.3');
    expect(roadmap).toContain('- [ ] P3.1');
  });

  it('keeps final P2 traceability and acceptance aligned', () => {
    const traceability = read('docs/TRACEABILITY-MATRIX.md');
    const acceptance = read('docs/acceptance/P2-FINAL-ACCEPTANCE.md');

    expect(traceability).toContain('EVD-041');
    expect(acceptance).toContain('P2');
    expect(acceptance).toContain('شاهد `EVD-041` ثبت');
    expect(acceptance).toContain('مرحله جاری به `P3.1` منتقل می‌شود');
  });

  it('keeps the UI remediation decisions and bilingual baseline visible', () => {
    const decisions = read('docs/DECISIONS.md');
    const baselines = read('docs/APPROVED-BASELINES.md');
    const journal = read('docs/IMPLEMENTATION-JOURNAL.md');

    expect(decisions).toContain('DEC-UI-001');
    expect(decisions).toContain('DEC-UI-002');
    expect(baselines).toContain('UI-BASELINE-P2R-001');
    expect(journal).toContain('# P2R.1.2 — ایجاد زیرساخت چندزبانه و جهت پویا');
    expect(journal).toContain('`next-intl` نسخه ثابت `4.13.4`');
  });

  it('does not reopen closed P2 stages', () => {
    const roadmap = read('docs/ROADMAP.md');

    for (let stage = 1; stage <= 15; stage += 1) {
      expect(roadmap).not.toContain(`- [ ] P2.${stage} `);
    }

    expect(roadmap).toContain('- [x] P2.15');
  });
});
