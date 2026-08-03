import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { inspectArchitecture } from '../checks/architecture-policy.js';
import { inspectRepositorySecurity } from '../checks/repository-security.js';
import { inspectP22DomainModel } from './p2.2-domain-model-audit.js';

export type P23AuditMode = 'auto' | 'pre' | 'closed';

export interface P23AuditReport {
  readonly schemaVersion: 1;
  readonly stage: 'P2.3';
  readonly mode: Exclude<P23AuditMode, 'auto'>;
  readonly generatedAt: string;
  readonly evidenceCount: number;
  readonly migrationVersion: 4;
  readonly tenantTables: 4;
  readonly issues: readonly string[];
}

const migrationPath = 'infra/migrations/0004_create-identity-organization-schema.sql';

const requiredFiles = [
  migrationPath,
  'packages/database/src/identity-organization-schema.test.ts',
  'tools/acceptance/p2.3-real-postgresql.ts',
  'tools/acceptance/p2.3-database-isolation-audit.ts',
  'tools/acceptance/p2.3-database-isolation-audit.test.ts',
] as const;

function read(repository: string, relativePath: string): string {
  return readFileSync(resolve(repository, relativePath), 'utf8').replace(/\r\n?/gu, '\n');
}

function marker(issues: string[], content: string, expected: string, label: string): void {
  if (!content.includes(expected)) {
    issues.push(`${label}: ${expected}`);
  }
}

function stageAtOrAfterP24(stage: string): boolean {
  const match = /^P(\d+)(?:\.(\d+))?/u.exec(stage);
  const majorText = match?.[1];
  const minorText = match?.[2];

  if (majorText === undefined) {
    return false;
  }

  const major = Number.parseInt(majorText, 10);
  const minor = minorText === undefined ? 0 : Number.parseInt(minorText, 10);

  return major > 2 || (major === 2 && minor >= 4);
}

function resolveMode(roadmap: string, requested: P23AuditMode): Exclude<P23AuditMode, 'auto'> {
  if (requested !== 'auto') {
    return requested;
  }

  return roadmap.includes('- [x] P2.3 ') ? 'closed' : 'pre';
}

export function inspectP23DatabaseIsolation(
  repository: string,
  requestedMode: P23AuditMode = 'auto',
  now: Date = new Date(),
): P23AuditReport {
  const issues: string[] = [];
  const roadmap = read(repository, 'docs/ROADMAP.md');
  const status = read(repository, 'docs/PROJECT-STATUS.md');
  const traceability = read(repository, 'docs/TRACEABILITY-MATRIX.md');
  const packageDocument = JSON.parse(read(repository, 'package.json')) as {
    readonly scripts?: Readonly<Record<string, string>>;
  };
  const mode = resolveMode(roadmap, requestedMode);

  const p22 = inspectP22DomainModel(repository, 'closed', now);

  for (const issue of p22.issues) {
    issues.push(`P2.2 domain: ${issue}`);
  }

  for (const relativePath of requiredFiles) {
    if (!existsSync(resolve(repository, relativePath))) {
      issues.push(`فایل P2.3 موجود نیست: ${relativePath}`);
    }
  }

  const migration = existsSync(resolve(repository, migrationPath))
    ? read(repository, migrationPath)
    : '';

  for (const expected of [
    'CREATE TABLE public.orgawork_users',
    'CREATE TABLE public.orgawork_organizations',
    'CREATE TABLE public.orgawork_memberships',
    'CREATE TABLE public.orgawork_teams',
    'CREATE TABLE public.orgawork_team_memberships',
    'FOREIGN KEY (team_id, organization_id)',
    'FOREIGN KEY (membership_id, organization_id)',
    'orgawork_validate_membership_update',
    'orgawork_validate_team_membership',
    'ALTER TABLE public.orgawork_organizations FORCE ROW LEVEL SECURITY',
    'ALTER TABLE public.orgawork_memberships FORCE ROW LEVEL SECURITY',
    'ALTER TABLE public.orgawork_teams FORCE ROW LEVEL SECURITY',
    'ALTER TABLE public.orgawork_team_memberships FORCE ROW LEVEL SECURITY',
    'public.orgawork_current_organization_id()',
  ]) {
    marker(issues, migration, expected, 'ناوردایی Migration موجود نیست');
  }

  for (const forbidden of [
    'orgawork_password_credentials',
    'orgawork_sessions',
    'orgawork_invitations',
  ]) {
    if (migration.includes(forbidden)) {
      issues.push(`جدول خارج از دامنه P2.3 ایجاد شده است: ${forbidden}`);
    }
  }

  const scripts = packageDocument.scripts ?? {};
  const expectedScripts: Readonly<Record<string, string>> = {
    'accept:p2.3:audit': 'tsx tools/acceptance/p2.3-database-isolation-audit.ts auto',
    'accept:p2.3:audit:pre': 'tsx tools/acceptance/p2.3-database-isolation-audit.ts pre',
    'accept:p2.3:audit:closed': 'tsx tools/acceptance/p2.3-database-isolation-audit.ts closed',
    'accept:p2.3:real': 'tsx tools/acceptance/p2.3-real-postgresql.ts',
  };

  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) {
      issues.push(`فرمان P2.3 معتبر نیست: ${name}`);
    }
  }

  if (
    !scripts['ci:migrations']?.includes(
      'packages/database/src/identity-organization-schema.test.ts',
    )
  ) {
    issues.push('آزمون Schema P2.3 در دروازه Migration ثبت نشده است.');
  }

  const architecture = inspectArchitecture(repository);

  for (const issue of architecture.issues) {
    issues.push(`Architecture ${issue.code}: ${issue.source} -> ${issue.target}`);
  }

  const security = inspectRepositorySecurity(repository);

  for (const issue of security.issues) {
    issues.push(`Security ${issue.code}: ${issue.path} | ${issue.detail}`);
  }

  if (mode === 'pre') {
    marker(issues, roadmap, '- [ ] P2.3 ایجاد مهاجرت‌ها و سیاست‌های جداسازی سازمانی', 'وضعیت P2.3');
    marker(
      issues,
      roadmap,
      '- مرحله جاری: `P2.3 ایجاد مهاجرت‌ها و سیاست‌های جداسازی سازمانی`',
      'مرحله جاری P2.3',
    );
  } else {
    const current = /^- مرحله جاری: `([^`]+)`/mu.exec(roadmap)?.[1];

    marker(issues, roadmap, '- [x] P2.3 ایجاد مهاجرت‌ها و سیاست‌های جداسازی سازمانی', 'وضعیت P2.3');
    marker(issues, traceability, 'EVD-033 — شاهد Migration و جداسازی سازمانی P2.3', 'شاهد P2.3');
    marker(
      issues,
      status,
      '- Migration نسخه 4 و RLS اجباری جداول هویت و سازمان با PostgreSQL واقعی پذیرفته شده‌اند.',
      'Project Status P2.3',
    );

    if (current === undefined || !stageAtOrAfterP24(current)) {
      issues.push(`مرحله جاری باید P2.4 یا بعد از آن باشد: ${String(current)}`);
    }
  }

  return {
    schemaVersion: 1,
    stage: 'P2.3',
    mode,
    generatedAt: now.toISOString(),
    evidenceCount: mode === 'closed' ? 33 : 32,
    migrationVersion: 4,
    tenantTables: 4,
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
    throw new Error('حالت ممیزی P2.3 باید auto، pre یا closed باشد.');
  }

  const report = inspectP23DatabaseIsolation(process.cwd(), requested);

  mkdirSync(resolve('artifacts/acceptance'), { recursive: true });
  writeFileSync(
    resolve('artifacts/acceptance/p2.3-database-isolation-audit.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  if (report.issues.length > 0) {
    throw new Error(`P2.3 database isolation audit failed\n${report.issues.join('\n')}`);
  }

  process.stdout.write(
    `P2.3_DATABASE_ISOLATION_AUDIT_PASSED: mode=${report.mode} evidence=${String(report.evidenceCount)} migration=${String(report.migrationVersion)} tenantTables=${String(report.tenantTables)}\n`,
  );
}
