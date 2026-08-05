import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('P2R UI remediation foundation decision', () => {
  it('freezes the approved reference roles and commits', () => {
    const decisions = read('docs/DECISIONS.md');

    expect(decisions).toContain('`Studio Admin`: `4727cc7533d46e44b401cac34a38da8566ae9677`');
    expect(decisions).toContain('`TailAdmin Next.js`: `d3526b35fb7e579a4585129fe6eaa47f54ec9a0b`');
    expect(decisions).toContain('`Kiranism Dashboard`: `f5d9a0c9afe72111560bb14af5e187b40306cfaf`');

    expect(decisions).toContain('پایه پوسته، Sidebar و Header');
    expect(decisions).toContain('مرجع Provider، Theme و جدول مدیریتی');
    expect(decisions).toContain('مرجع صفحه ورود و صفحات تمام‌عرض');
  });

  it('records English-first development without losing the final Persian default', () => {
    const decisions = read('docs/DECISIONS.md');
    const status = read('docs/PROJECT-STATUS.md');

    expect(decisions).toContain('زبان توسعه رابط تا نزدیک پایان پروژه `English` است');
    expect(decisions).toContain('زبان فارسی را به‌صورت پیش‌فرض');
    expect(decisions).toContain('English را به‌صورت زبان دوم');
    expect(decisions).toContain('`en` و `fa`');
    expect(decisions).toContain('`dir=ltr/rtl`');

    expect(status).toContain('زبان توسعه فعلی: `English`');
    expect(status).toContain('زبان پیش‌فرض نسخه نهایی: `fa`');
    expect(status).toContain('زبان دوم نسخه نهایی: `en`');
  });

  it('keeps OrgaWork authentication and backend isolated from templates', () => {
    const decisions = read('docs/DECISIONS.md');

    expect(decisions).toContain(
      '`Clerk`، `Vercel Analytics`، Backend، داده نمایشی، برند و لینک‌های تبلیغاتی قالب‌ها وارد OrgaWork نمی‌شوند',
    );
    expect(decisions).toContain(
      'احراز هویت، CSRF، نشست، سازمان جاری و مجوزدهی فقط از پیاده‌سازی داخلی OrgaWork استفاده می‌کنند',
    );
  });

  it('keeps P3.1 separate after the remediation acceptance is closed', () => {
    const roadmap = read('docs/ROADMAP.md');
    const status = read('docs/PROJECT-STATUS.md');

    expect(roadmap).toContain(
      'P2R.1.8 بسته و پذیرفته شده است؛ آغاز P3.1 باید در Commit جداگانه انجام شود.',
    );
    expect(status).toContain('مرحله `P3.1` در این Commit آغاز نشد و برای شروع جداگانه آماده است.');
  });
});
