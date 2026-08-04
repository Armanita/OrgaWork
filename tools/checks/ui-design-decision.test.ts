import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');

function document(relativePath: string): string {
  return readFileSync(resolve(repositoryRoot, 'docs', relativePath), 'utf8');
}

describe('preapproved P2.13 UI design baseline', () => {
  it('records the frozen references and Persian font', () => {
    const decisions = document('DECISIONS.md');

    expect(decisions).toContain('DEC-UI-001');
    expect(decisions).toContain('4727cc7533d46e44b401cac34a38da8566ae9677');
    expect(decisions).toContain('d3526b35fb7e579a4585129fe6eaa47f54ec9a0b');
    expect(decisions).toContain('f5d9a0c9afe72111560bb14af5e187b40306cfaf');
    expect(decisions).toContain('Vazirmatn');
  });

  it('removes only the repeated approval stop after P2.12', () => {
    const status = document('PROJECT-STATUS.md');
    const roadmap = document('ROADMAP.md');
    const risks = document('RISKS-ASSUMPTIONS-DEBT.md');

    expect(status).toContain(
      'پس از بسته‌شدن `P2.12` آغاز `P2.13` نیازمند توقف و تأیید دوباره مرجع طراحی نیست',
    );
    expect(roadmap).toContain(
      'پس از بسته‌شدن `P2.12` اجرای این ردیف بدون توقف برای تأیید دوباره طراحی آغاز می‌شود',
    );
    expect(risks).toContain('توقف تأیید دوباره در مرز P2.13 با `DEC-UI-001` حذف شده است');
  });

  it('preserves the early UI implementation boundary', () => {
    const decisions = document('DECISIONS.md');
    const acceptance = document('TEST-AND-ACCEPTANCE.md');

    expect(decisions).toContain('طراحی واقعی رابط پیش از بسته‌شدن `P2.12`');
    expect(acceptance).toContain('`P2.13` فقط پس از بسته‌شدن و ثبت شاهد `P2.12` آغاز می‌شود');
    expect(acceptance).toContain('شکست این کنترل‌ها توقف فنی برای رفع مشکل است');
  });

  it('keeps template backend logic outside OrgaWork', () => {
    const decisions = document('DECISIONS.md');
    const traceability = document('TRACEABILITY-MATRIX.md');

    expect(decisions).toContain('منطق احراز هویت، مجوزدهی، چندسازمانی، پایگاه داده، صورتحساب');
    expect(traceability).toContain(
      'انتقال منطق احراز هویت مجوز چندسازمانی داده و Backend قالب‌ها: ممنوع',
    );
  });
});
