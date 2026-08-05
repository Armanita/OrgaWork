import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('current documentation state after P2R.1.8', () => {
  it('keeps historical and remediation acceptance evidence discoverable', () => {
    const readme = read('docs/README.md');

    expect(readme).toContain('docs/acceptance/P1-FINAL-ACCEPTANCE.md');
    expect(readme).toContain('docs/acceptance/P0-P2.3-FULL-AUDIT.md');
    expect(readme).toContain('docs/acceptance/P2-FINAL-ACCEPTANCE.md');
    expect(readme).toContain('docs/acceptance/P2R-FINAL-ACCEPTANCE.md');
  });

  it('records P2R.1.8 and the remediation path as closed without starting P3.1', () => {
    const status = read('docs/PROJECT-STATUS.md');
    const roadmap = read('docs/ROADMAP.md');

    expect(status).toContain(
      'مرحله بسته‌شده: `P2R.1.8 — ساخت تولیدی بازگشت کامل آزمون‌ها و پذیرش اصلاح رابط`',
    );
    expect(status).toContain('مسیر اصلاحی `P2R` بسته و پذیرفته شد');
    expect(status).toContain('مرحله `P3.1` در این Commit آغاز نشد و برای شروع جداگانه آماده است');

    expect(roadmap).toContain('- [x] P2R.1.7');
    expect(roadmap).toContain('- [x] P2R.1.8');
    expect(roadmap).toContain('- [ ] P3.1');
    expect(roadmap).toContain('آغاز P3.1 باید در Commit جداگانه انجام شود');
  });

  it('aligns final P2R acceptance and traceability evidence', () => {
    const acceptance = read('docs/acceptance/P2R-FINAL-ACCEPTANCE.md');
    const traceability = read('docs/TRACEABILITY-MATRIX.md');

    expect(acceptance).toContain('P2R.1.8');
    expect(acceptance).toContain('شاهد: `EVD-042`');
    expect(acceptance).toContain('۶ آزمون مرورگر واقعی');
    expect(acceptance).toContain('۸۱ فایل آزمون و ۳۸۹ آزمون');
    expect(acceptance).toContain('۵۸ خطای قدیمی');
    expect(acceptance).toContain('صفر خطای جدید');
    expect(acceptance).toContain('en/ltr');
    expect(acceptance).toContain('fa/rtl');
    expect(acceptance).toContain('Checkpoint');

    expect(traceability).toContain('EVD-042');
    expect(traceability).toContain('UI-P2R-FINAL-ACCEPTANCE-001');
  });

  it('records the final remediation baseline and journal transition', () => {
    const baselines = read('docs/APPROVED-BASELINES.md');
    const journal = read('docs/IMPLEMENTATION-JOURNAL.md');

    expect(baselines).toContain('UI-ACCESSIBILITY-P2R-001');
    expect(baselines).toContain('UI-P2R-FINAL-ACCEPTANCE-001');
    expect(journal).toContain('# P2R.1.8 — ساخت تولیدی بازگشت کامل آزمون‌ها و پذیرش اصلاح رابط');
    expect(journal).toContain('`turbo run build --force`');
    expect(journal).toContain('`P3.1` در این Commit آغاز نشد');
  });

  it('does not reopen closed P2 stages or begin P3.1 implementation', () => {
    const roadmap = read('docs/ROADMAP.md');

    for (let stage = 1; stage <= 15; stage += 1) {
      expect(roadmap).not.toContain(`- [ ] P2.${stage} `);
    }

    expect(roadmap).toContain('- [x] P2.15');
    expect(roadmap).toContain('- [ ] P3.1');
  });
});
