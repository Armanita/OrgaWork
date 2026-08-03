import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function document(path: string): string {
  return readFileSync(resolve(root, 'docs', path), 'utf8');
}

describe('current documentation state through P2.3', () => {
  it('keeps the main document index and specialized evidence current', () => {
    const readme = document('README.md');

    expect(readme).not.toContain('هنوز ایجاد یا تأیید نشده');
    expect(readme).toContain('acceptance/P1-FINAL-ACCEPTANCE.md');
    expect(readme).toContain('spikes/P1.9-TECHNICAL-SPIKES.md');
    expect(readme).toContain('acceptance/P0-P2.3-FULL-AUDIT.md');
  });

  it('records the accepted Git baselines and latest full audit', () => {
    const status = document('PROJECT-STATUS.md');
    const journal = document('IMPLEMENTATION-JOURNAL.md');

    for (const commit of [
      'f7bcd86b617f299a5d26329a4a3386cc7537c5fe',
      '78612b5459343d05a73ea7e12f074793543e9047',
      '75bedac73e64bf144c43ad43339abb36684d3c00',
      '6963796e81580527e3a719895c83c03eb5f71fb1',
    ]) {
      expect(status + journal).toContain(commit);
    }

    expect(status).toContain('`56` فایل آزمون و `285` آزمون');
    expect(status).toContain('Statements برابر `84.23%`');
    expect(status).not.toContain('پایگاه داده واقعی: هنوز در مرحله `P1.4` و `P1.5` متصل نشده است');
  });

  it('keeps roadmap and traceability aligned with the closed stages', () => {
    const roadmap = document('ROADMAP.md');
    const traceability = document('TRACEABILITY-MATRIX.md');

    for (const stage of ['`P1.10`', '`P2.1`', '`P2.2`', '`P2.3`']) {
      expect(roadmap).toContain(stage);
    }

    expect(traceability).not.toContain('زیرا ماژول‌های دامنه هنوز ایجاد نشده‌اند');
    expect(traceability).toContain('مسیرهای کد و آزمون مراحل بسته‌شده تا `P2.3` ثبت شده‌اند');
  });

  it('records paid and reduced technical debt without hiding remaining work', () => {
    const risks = document('RISKS-ASSUMPTIONS-DEBT.md');

    expect(risks).toContain('## 89. DEBT-002 — نبود CI رسمی');
    expect(risks).toContain('## 90. DEBT-003 — Health فعلی فقط پایه است');
    expect(risks).toContain('## 95. DEBT-008 — نبود آزمون چندسازمانی واقعی');
    expect(risks).toContain('## 97. DEBT-010 — نبود کنترل UTF-8 در CI');
    expect(risks.match(/- وضعیت: پرداخت‌شده/g)?.length).toBeGreaterThanOrEqual(5);
    expect(risks).toContain('## 92. DEBT-005 — Worker بدون Queue واقعی');
    expect(risks).toContain('- وضعیت: کاهش‌یافته و منتقل‌شده');
  });

  it('removes historical placeholders and preserves the UI stop gate', () => {
    const spike = document('spikes/P1.9-TECHNICAL-SPIKES.md');
    const roadmap = document('ROADMAP.md');
    const audit = document('acceptance/P0-P2.3-FULL-AUDIT.md');

    expect(spike).not.toContain('TECHNICAL_HEAD');
    expect(spike).toContain('b4d3ff0a853fe2b8d4e52bba05862bf0fb46b228');
    expect(roadmap).toContain('- [ ] P2.13 ایجاد رابط فارسی ورود و مدیریت سازمان');
    expect(audit).toContain('بسته بعدی: اجرای یکپارچه `P2.4` تا `P2.7`');
  });
});
