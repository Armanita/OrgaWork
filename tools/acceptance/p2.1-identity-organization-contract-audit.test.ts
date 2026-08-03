import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  inspectIdentityOrganizationContract,
  isAtOrAfterP22,
  type IdentityContractAuditMode,
} from './p2.1-identity-organization-contract-audit.js';

function currentMode(): IdentityContractAuditMode {
  const roadmap = readFileSync(resolve(process.cwd(), 'docs/ROADMAP.md'), 'utf8');

  return roadmap.includes('- [x] P2.1 ') ? 'closed' : 'pre';
}

describe('P2.1 identity and organization contract', () => {
  it('accepts the current repository state without hidden issues', () => {
    const report = inspectIdentityOrganizationContract(
      process.cwd(),
      currentMode(),
      new Date('2026-08-03T00:00:00.000Z'),
    );

    expect(report.stage).toBe('P2.1');
    expect(report.issues).toEqual([]);
    expect(report.contractSections).toBeGreaterThanOrEqual(22);
    expect(report.evidenceCount).toBe(report.mode === 'closed' ? 31 : 30);
  });

  it('remains valid after later P2 stages begin', () => {
    expect(isAtOrAfterP22('P2.2 ایجاد مدل دامنه')).toBe(true);
    expect(isAtOrAfterP22('P2.3 ایجاد مهاجرت')).toBe(true);
    expect(isAtOrAfterP22('P3.1 ایجاد پرونده')).toBe(true);
    expect(isAtOrAfterP22('P2.1 قرارداد')).toBe(false);
  });

  it('keeps the password and session security floor explicit', () => {
    const contract = readFileSync(
      resolve(process.cwd(), 'docs/contracts/P2.1-IDENTITY-ORGANIZATION-CONTRACT.md'),
      'utf8',
    );

    expect(contract).toContain('حداقل طول گذرواژه `15` نویسه است.');
    expect(contract).toContain('الگوریتم اصلی `Argon2id` است.');
    expect(contract).toContain('حافظه `19 MiB`');
    expect(contract).toContain('نشست اصلی مرورگر Server Side');
    expect(contract).toContain('`JWT` به‌عنوان نشست اصلی مرورگر استفاده نمی‌شود.');
  });

  it('keeps tenant and deny invariants explicit', () => {
    const contract = readFileSync(
      resolve(process.cwd(), 'docs/contracts/P2.1-IDENTITY-ORGANIZATION-CONTRACT.md'),
      'utf8',
    );

    expect(contract).toContain('با `SET LOCAL` اعمال می‌شود.');
    expect(contract).toContain('عدم دسترسی صریح بالاترین اولویت را دارد.');
    expect(contract).toContain('توقف اجباری پیش از `P2.13`');
  });
});
