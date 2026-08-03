import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { inspectFoundationAcceptance } from './p1.10-foundation-audit.js';

export type IdentityContractAuditMode = 'auto' | 'pre' | 'closed';

export interface IdentityContractAuditReport {
  readonly schemaVersion: 1;
  readonly stage: 'P2.1';
  readonly mode: Exclude<IdentityContractAuditMode, 'auto'>;
  readonly generatedAt: string;
  readonly evidenceCount: number;
  readonly contractSections: number;
  readonly issues: readonly string[];
}

const contractPath = 'docs/contracts/P2.1-IDENTITY-ORGANIZATION-CONTRACT.md';

const requiredContractMarkers = [
  'هویت سراسری کاربر از عضویت سازمانی جدا است.',
  '- `pending`',
  '- `active`',
  '- `disabled`',
  '- `invited`',
  '- `suspended`',
  '- `revoked`',
  'حداقل طول گذرواژه `15` نویسه است.',
  'حداکثر طول پذیرفته‌شده `128` نویسه است.',
  'الگوریتم اصلی `Argon2id` است.',
  'حافظه `19 MiB`، تعداد تکرار `2` و Parallelism برابر `1`',
  'اعتبار Token برابر `30` دقیقه است.',
  'نشست اصلی مرورگر Server Side و ذخیره‌شده در PostgreSQL است.',
  '`JWT` به‌عنوان نشست اصلی مرورگر استفاده نمی‌شود.',
  'انقضای عدم فعالیت برابر `8` ساعت است.',
  'حداکثر عمر مطلق نشست برابر `7` روز است.',
  '`__Host-orgawork-session`',
  '- `HttpOnly`',
  '- `Secure`',
  '- `SameSite=Lax`',
  'Header با نام `X-CSRF-Token`',
  'سازمان جاری در Session Server Side نگهداری می‌شود.',
  'تغییر سازمان `sessionRevision` را افزایش می‌دهد.',
  'Tenant Context پایگاه داده فقط داخل Transaction و با `SET LOCAL` اعمال می‌شود.',
  '- `organization_admin`',
  '- `platform_operator`',
  'عدم دسترسی صریح بالاترین اولویت را دارد.',
  'اعتبار دعوت برابر `72` ساعت است.',
  'توقف اجباری پیش از `P2.13`',
  'طراحی واقعی رابط کاربری پیش از `P2.13` ممنوع است.',
] as const;

function read(repository: string, relativePath: string): string {
  return readFileSync(resolve(repository, relativePath), 'utf8').replace(/\r\n?/gu, '\n');
}

function marker(issues: string[], content: string, expected: string, label: string): void {
  if (!content.includes(expected)) {
    issues.push(`${label}: ${expected}`);
  }
}

function resolveMode(
  roadmap: string,
  requestedMode: IdentityContractAuditMode,
): Exclude<IdentityContractAuditMode, 'auto'> {
  if (requestedMode !== 'auto') {
    return requestedMode;
  }

  return roadmap.includes('- مرحله جاری: `P2.2 ایجاد مدل کاربر، سازمان، عضویت و تیم`')
    ? 'closed'
    : 'pre';
}

export function inspectIdentityOrganizationContract(
  repository: string,
  requestedMode: IdentityContractAuditMode = 'auto',
  now: Date = new Date(),
): IdentityContractAuditReport {
  const issues: string[] = [];
  const roadmap = read(repository, 'docs/ROADMAP.md');
  const status = read(repository, 'docs/PROJECT-STATUS.md');
  const packageDocument = JSON.parse(read(repository, 'package.json')) as {
    readonly scripts?: Readonly<Record<string, string>>;
  };
  const mode = resolveMode(roadmap, requestedMode);

  const p1Report = inspectFoundationAcceptance(repository, 'closed', now);

  for (const issue of p1Report.issues) {
    issues.push(`P1 foundation: ${issue}`);
  }

  if (!existsSync(resolve(repository, contractPath))) {
    issues.push(`سند قرارداد P2.1 موجود نیست: ${contractPath}`);
  }

  const contract = existsSync(resolve(repository, contractPath))
    ? read(repository, contractPath)
    : '';

  for (const expected of requiredContractMarkers) {
    marker(issues, contract, expected, 'ناوردایی قرارداد موجود نیست');
  }

  const headingCount = [...contract.matchAll(/^## \d+\./gmu)].length;

  if (headingCount < 22) {
    issues.push(`تعداد بخش‌های قرارداد کمتر از انتظار است: ${String(headingCount)}`);
  }

  const scripts = packageDocument.scripts ?? {};
  const expectedScripts: Readonly<Record<string, string>> = {
    'accept:p2.1:audit': 'tsx tools/acceptance/p2.1-identity-organization-contract-audit.ts auto',
    'accept:p2.1:audit:pre':
      'tsx tools/acceptance/p2.1-identity-organization-contract-audit.ts pre',
    'accept:p2.1:audit:closed':
      'tsx tools/acceptance/p2.1-identity-organization-contract-audit.ts closed',
  };

  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) {
      issues.push(`فرمان ممیزی قرارداد معتبر نیست: ${name}`);
    }
  }

  if (mode === 'pre') {
    marker(
      issues,
      roadmap,
      '- مرحله جاری: `P2.1 تثبیت قرارداد دامنه هویت و سازمان`',
      'مرحله جاری پیش از بسته‌شدن',
    );
    marker(
      issues,
      roadmap,
      '- [ ] P2.1 تثبیت قرارداد دامنه هویت و سازمان',
      'وضعیت Roadmap پیش از بسته‌شدن',
    );
    marker(
      issues,
      status,
      '- زیرمرحله جاری: `P2.1 — تثبیت قرارداد دامنه هویت و سازمان`',
      'Project Status پیش از بسته‌شدن',
    );
  } else {
    const decisions = read(repository, 'docs/DECISIONS.md');
    const risks = read(repository, 'docs/RISKS-ASSUMPTIONS-DEBT.md');
    const traceability = read(repository, 'docs/TRACEABILITY-MATRIX.md');
    const glossary = read(repository, 'docs/DOMAIN-GLOSSARY.md');

    marker(
      issues,
      roadmap,
      '- [x] P2.1 تثبیت قرارداد دامنه هویت و سازمان',
      'وضعیت Roadmap پس از بسته‌شدن',
    );
    marker(
      issues,
      roadmap,
      '- مرحله جاری: `P2.2 ایجاد مدل کاربر، سازمان، عضویت و تیم`',
      'مرحله جاری پس از بسته‌شدن',
    );
    marker(
      issues,
      roadmap,
      '- آخرین زیرمرحله بسته‌شده: `P2.1 — تثبیت قرارداد دامنه هویت و سازمان`',
      'آخرین مرحله بسته‌شده',
    );
    marker(
      issues,
      roadmap,
      '- مرحله بعد از زیرمرحله جاری: `P2.3 ایجاد مهاجرت‌ها و سیاست‌های جداسازی سازمانی`',
      'مرحله بعد',
    );
    marker(
      issues,
      status,
      '- زیرمرحله جاری: `P2.2 — ایجاد مدل کاربر، سازمان، عضویت و تیم`',
      'Project Status پس از بسته‌شدن',
    );
    marker(issues, decisions, 'DEC-P21-003 — نشست Server Side و محافظت مرورگر', 'تصمیم نشست');
    marker(issues, decisions, 'DEC-P21-005 — ترتیب قطعی تصمیم دسترسی', 'تصمیم مجوز');
    marker(issues, risks, 'الحاقیه P2.1 — تصمیم‌های بسته و انتقال‌های کنترل‌شده', 'ثبت ریسک P2.1');
    marker(issues, traceability, 'EVD-031 — شاهد قرارداد هویت و سازمان P2.1', 'شاهد P2.1');
    marker(issues, glossary, 'الحاقیه P2.1 — واژگان قطعی هویت و سازمان', 'واژگان P2.1');
  }

  return {
    schemaVersion: 1,
    stage: 'P2.1',
    mode,
    generatedAt: now.toISOString(),
    evidenceCount: mode === 'closed' ? 31 : 30,
    contractSections: headingCount,
    issues,
  };
}

function isMainModule(): boolean {
  const argument = process.argv[1];

  return argument !== undefined && import.meta.url === pathToFileURL(resolve(argument)).href;
}

if (isMainModule()) {
  const requested = process.argv[2] ?? 'auto';

  if (requested !== 'auto' && requested !== 'pre' && requested !== 'closed') {
    throw new Error('حالت ممیزی P2.1 باید auto، pre یا closed باشد.');
  }

  const report = inspectIdentityOrganizationContract(process.cwd(), requested);

  mkdirSync(resolve('artifacts/acceptance'), { recursive: true });
  writeFileSync(
    resolve('artifacts/acceptance/p2.1-identity-organization-contract-audit.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  if (report.issues.length > 0) {
    throw new Error(`P2.1 identity contract audit failed\n${report.issues.join('\n')}`);
  }

  process.stdout.write(
    `P2.1_IDENTITY_ORGANIZATION_CONTRACT_AUDIT_PASSED: mode=${report.mode} evidence=${String(report.evidenceCount)} sections=${String(report.contractSections)}\n`,
  );
}
