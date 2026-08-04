import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { inspectArchitecture } from '../checks/architecture-policy.js';
import { inspectRepositorySecurity } from '../checks/repository-security.js';
import { inspectP23DatabaseIsolation } from './p2.3-database-isolation-audit.js';

export type P24AuditMode = 'auto' | 'pre' | 'closed';

export interface P24AuditReport {
  readonly schemaVersion: 1;
  readonly stage: 'P2.4';
  readonly mode: Exclude<P24AuditMode, 'auto'>;
  readonly generatedAt: string;
  readonly evidenceCount: number;
  readonly migrationVersion: 5;
  readonly argon2MemoryMiB: 32;
  readonly argon2TimeCost: 3;
  readonly argon2Parallelism: 1;
  readonly issues: readonly string[];
}

const requiredFiles = [
  'packages/security/package.json',
  'packages/security/src/index.ts',
  'packages/security/src/index.test.ts',
  'infra/migrations/0005_create-password-credentials.sql',
  'packages/database/src/password-credential-schema.test.ts',
  'docs/acceptance/P2.4-PASSWORD-SECURITY-BENCHMARK.md',
  'tools/acceptance/p2.4-password-security-audit.ts',
  'tools/acceptance/p2.4-password-security-audit.test.ts',
] as const;

function read(repository: string, relativePath: string): string {
  return readFileSync(resolve(repository, relativePath), 'utf8').replace(/\r\n?/gu, '\n');
}

function marker(issues: string[], content: string, expected: string, label: string): void {
  if (!content.includes(expected)) {
    issues.push(`${label}: ${expected}`);
  }
}

function resolveMode(roadmap: string, requested: P24AuditMode): Exclude<P24AuditMode, 'auto'> {
  if (requested !== 'auto') {
    return requested;
  }

  return roadmap.includes('- [x] P2.4 ') ? 'closed' : 'pre';
}

export function inspectP24PasswordSecurity(
  repository: string,
  requestedMode: P24AuditMode = 'auto',
  now: Date = new Date(),
): P24AuditReport {
  const issues: string[] = [];
  const roadmap = read(repository, 'docs/ROADMAP.md');
  const mode = resolveMode(roadmap, requestedMode);
  const rootPackage = JSON.parse(read(repository, 'package.json')) as {
    readonly scripts?: Readonly<Record<string, string>>;
  };

  const p23 = inspectP23DatabaseIsolation(repository, 'closed', now);
  for (const issue of p23.issues) {
    issues.push(`P2.3 database: ${issue}`);
  }

  for (const relativePath of requiredFiles) {
    if (!existsSync(resolve(repository, relativePath))) {
      issues.push(`فایل P2.4 موجود نیست: ${relativePath}`);
    }
  }

  const security = existsSync(resolve(repository, 'packages/security/src/index.ts'))
    ? read(repository, 'packages/security/src/index.ts')
    : '';
  const migration = existsSync(
    resolve(repository, 'infra/migrations/0005_create-password-credentials.sql'),
  )
    ? read(repository, 'infra/migrations/0005_create-password-credentials.sql')
    : '';
  const benchmark = existsSync(
    resolve(repository, 'docs/acceptance/P2.4-PASSWORD-SECURITY-BENCHMARK.md'),
  )
    ? read(repository, 'docs/acceptance/P2.4-PASSWORD-SECURITY-BENCHMARK.md')
    : '';

  for (const expected of [
    'minimumLength: 15',
    'maximumLength: 128',
    'memoryCost: 32 * 1024',
    'timeCost: 3',
    'parallelism: 1',
    'hashLength: 32',
    'type: argon2.argon2id',
    'argon2.needsRehash',
  ]) {
    marker(issues, security, expected, 'تنظیم امنیت گذرواژه موجود نیست');
  }

  for (const expected of [
    'CREATE TABLE public.orgawork_password_credentials',
    "password_hash LIKE '$argon2id$%'",
    'REFERENCES public.orgawork_users (id)',
    'CREATE TRIGGER orgawork_password_credentials_validate_update',
    'REVOKE ALL ON TABLE public.orgawork_password_credentials FROM PUBLIC',
  ]) {
    marker(issues, migration, expected, 'ناوردایی Migration P2.4 موجود نیست');
  }

  for (const expected of [
    'حافظه: `32 MiB`',
    'تکرار: `3`',
    'Parallelism: `1`',
    'زمان میانه Hash: `368.083 ms`',
    'نتیجه: `PASSED`',
  ]) {
    marker(issues, benchmark, expected, 'شاهد Benchmark موجود نیست');
  }

  const scripts = rootPackage.scripts ?? {};
  const expectedScripts: Readonly<Record<string, string>> = {
    'accept:p2.4:audit': 'tsx tools/acceptance/p2.4-password-security-audit.ts auto',
    'accept:p2.4:audit:pre': 'tsx tools/acceptance/p2.4-password-security-audit.ts pre',
    'accept:p2.4:audit:closed': 'tsx tools/acceptance/p2.4-password-security-audit.ts closed',
  };

  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) {
      issues.push(`فرمان P2.4 معتبر نیست: ${name}`);
    }
  }

  if (scripts['build:p2.4:direct'] !== 'pnpm --filter @workspace/security build') {
    issues.push('فرمان ساخت مستقیم P2.4 معتبر نیست: build:p2.4:direct');
  }

  if (!scripts['ci:migrations']?.includes('password-credential-schema.test.ts')) {
    issues.push('آزمون Schema اعتبارنامه در دروازه Migration ثبت نشده است.');
  }

  const architecture = inspectArchitecture(repository);
  for (const issue of architecture.issues) {
    issues.push(`Architecture ${issue.code}: ${issue.source} -> ${issue.target}`);
  }

  const repositorySecurity = inspectRepositorySecurity(repository);
  for (const issue of repositorySecurity.issues) {
    issues.push(`Security ${issue.code}: ${issue.path} | ${issue.detail}`);
  }

  if (mode === 'pre') {
    marker(issues, roadmap, '- [ ] P2.4 پیاده‌سازی ذخیره امن گذرواژه', 'وضعیت P2.4');
  } else {
    marker(issues, roadmap, '- [x] P2.4 پیاده‌سازی ذخیره امن گذرواژه', 'وضعیت P2.4');
  }

  return {
    schemaVersion: 1,
    stage: 'P2.4',
    mode,
    generatedAt: now.toISOString(),
    evidenceCount: mode === 'closed' ? 35 : 34,
    migrationVersion: 5,
    argon2MemoryMiB: 32,
    argon2TimeCost: 3,
    argon2Parallelism: 1,
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
    throw new Error('حالت ممیزی P2.4 باید auto، pre یا closed باشد.');
  }

  const report = inspectP24PasswordSecurity(process.cwd(), requested);
  mkdirSync(resolve('artifacts/acceptance'), { recursive: true });
  writeFileSync(
    resolve('artifacts/acceptance/p2.4-password-security-audit.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  if (report.issues.length > 0) {
    throw new Error(`P2.4 password security audit failed\n${report.issues.join('\n')}`);
  }

  process.stdout.write(
    `P2.4_PASSWORD_SECURITY_AUDIT_PASSED: mode=${report.mode} evidence=${String(report.evidenceCount)} migration=${String(report.migrationVersion)} argon2=32MiB/3/1\n`,
  );
}
