import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { inspectArchitecture } from '../checks/architecture-policy.js';
import { inspectRepositorySecurity } from '../checks/repository-security.js';
import { inspectIdentityOrganizationContract } from './p2.1-identity-organization-contract-audit.js';

export type DomainModelAuditMode = 'auto' | 'pre' | 'closed';

export interface DomainModelAuditReport {
  readonly schemaVersion: 1;
  readonly stage: 'P2.2';
  readonly mode: Exclude<DomainModelAuditMode, 'auto'>;
  readonly generatedAt: string;
  readonly evidenceCount: number;
  readonly workspaces: number;
  readonly sourceFiles: number;
  readonly packageManifests: number;
  readonly issues: readonly string[];
}

const requiredFiles = [
  'modules/identity/package.json',
  'modules/identity/src/index.ts',
  'modules/identity/src/index.test.ts',
  'modules/organizations/package.json',
  'modules/organizations/src/index.ts',
  'modules/organizations/src/index.test.ts',
  'modules/teams/package.json',
  'modules/teams/src/index.ts',
  'modules/teams/src/index.test.ts',
] as const;

function read(repository: string, relativePath: string): string {
  return readFileSync(resolve(repository, relativePath), 'utf8').replace(/\r\n?/gu, '\n');
}

function marker(issues: string[], content: string, expected: string, label: string): void {
  if (!content.includes(expected)) {
    issues.push(`${label}: ${expected}`);
  }
}

function stageAtOrAfterP23(stage: string): boolean {
  const match = /^P(\d+)(?:\.(\d+))?/u.exec(stage);
  const majorText = match?.[1];
  const minorText = match?.[2];

  if (majorText === undefined) {
    return false;
  }

  const major = Number.parseInt(majorText, 10);
  const minor = minorText === undefined ? 0 : Number.parseInt(minorText, 10);

  return major > 2 || (major === 2 && minor >= 3);
}

function resolveMode(
  roadmap: string,
  requested: DomainModelAuditMode,
): Exclude<DomainModelAuditMode, 'auto'> {
  if (requested !== 'auto') {
    return requested;
  }

  return roadmap.includes('- [x] P2.2 ') ? 'closed' : 'pre';
}

export function inspectP22DomainModel(
  repository: string,
  requestedMode: DomainModelAuditMode = 'auto',
  now: Date = new Date(),
): DomainModelAuditReport {
  const issues: string[] = [];
  const roadmap = read(repository, 'docs/ROADMAP.md');
  const status = read(repository, 'docs/PROJECT-STATUS.md');
  const traceability = read(repository, 'docs/TRACEABILITY-MATRIX.md');
  const packageDocument = JSON.parse(read(repository, 'package.json')) as {
    readonly scripts?: Readonly<Record<string, string>>;
  };
  const mode = resolveMode(roadmap, requestedMode);

  const p21 = inspectIdentityOrganizationContract(repository, 'closed', now);
  for (const issue of p21.issues) {
    issues.push(`P2.1 contract: ${issue}`);
  }

  for (const relativePath of requiredFiles) {
    if (!existsSync(resolve(repository, relativePath))) {
      issues.push(`فایل مدل دامنه موجود نیست: ${relativePath}`);
    }
  }

  const identity = existsSync(resolve(repository, 'modules/identity/src/index.ts'))
    ? read(repository, 'modules/identity/src/index.ts')
    : '';
  const organizations = existsSync(resolve(repository, 'modules/organizations/src/index.ts'))
    ? read(repository, 'modules/organizations/src/index.ts')
    : '';
  const teams = existsSync(resolve(repository, 'modules/teams/src/index.ts'))
    ? read(repository, 'modules/teams/src/index.ts')
    : '';
  const contracts = read(repository, 'packages/contracts/src/index.ts');

  for (const expected of [
    "export const userStatuses = ['pending', 'active', 'disabled']",
    'export interface User',
    'export function normalizeEmail',
    'export function transitionUserStatus',
  ]) {
    marker(issues, identity, expected, 'ناوردایی مدل User موجود نیست');
  }

  for (const expected of [
    'export const membershipStatuses = [',
    "'invited'",
    "'active'",
    "'suspended'",
    "'revoked'",
    'export interface Organization',
    'export interface Membership',
    'export function transitionMembershipStatus',
  ]) {
    marker(issues, organizations, expected, 'ناوردایی مدل Organization موجود نیست');
  }

  for (const expected of [
    "export const teamRoles = ['member', 'team_manager']",
    'export interface Team',
    'export interface TeamMembership',
    'export function addTeamMember',
    "'ORGANIZATION_MISMATCH'",
    "'INACTIVE_MEMBERSHIP'",
  ]) {
    marker(issues, teams, expected, 'ناوردایی مدل Team موجود نیست');
  }

  for (const expected of [
    "export type MembershipId = Brand<string, 'MembershipId'>",
    "export type TeamId = Brand<string, 'TeamId'>",
    "export type TeamMembershipId = Brand<string, 'TeamMembershipId'>",
  ]) {
    marker(issues, contracts, expected, 'شناسه مشترک دامنه موجود نیست');
  }

  const scripts = packageDocument.scripts ?? {};
  const expectedScripts: Readonly<Record<string, string>> = {
    'build:domain:direct':
      'pnpm --filter @workspace/identity build && pnpm --filter @workspace/organizations build && pnpm --filter @workspace/teams build',
    'accept:p2.2:audit': 'tsx tools/acceptance/p2.2-domain-model-audit.ts auto',
    'accept:p2.2:audit:pre': 'tsx tools/acceptance/p2.2-domain-model-audit.ts pre',
    'accept:p2.2:audit:closed': 'tsx tools/acceptance/p2.2-domain-model-audit.ts closed',
  };

  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) {
      issues.push(`فرمان P2.2 معتبر نیست: ${name}`);
    }
  }

  if (!scripts['prepare:quality']?.includes('pnpm build:domain:direct')) {
    issues.push('ساخت مدل‌های دامنه در دروازه کیفیت ثبت نشده است.');
  }

  const architecture = inspectArchitecture(repository);
  for (const issue of architecture.issues) {
    issues.push(`Architecture ${issue.code}: ${issue.source} -> ${issue.target}`);
  }

  const workspaceNames = new Set(architecture.workspaces.map((workspace) => workspace.name));
  for (const name of ['@workspace/identity', '@workspace/organizations', '@workspace/teams']) {
    if (!workspaceNames.has(name)) {
      issues.push(`Workspace دامنه ثبت نشده است: ${name}`);
    }
  }

  const security = inspectRepositorySecurity(repository);
  for (const issue of security.issues) {
    issues.push(`Security ${issue.code}: ${issue.path} | ${issue.detail}`);
  }

  if (mode === 'pre') {
    marker(issues, roadmap, '- [ ] P2.2 ایجاد مدل کاربر، سازمان، عضویت و تیم', 'وضعیت P2.2');
    marker(
      issues,
      roadmap,
      '- مرحله جاری: `P2.2 ایجاد مدل کاربر، سازمان، عضویت و تیم`',
      'مرحله جاری P2.2',
    );
  } else {
    const current = /^- مرحله جاری: `([^`]+)`/mu.exec(roadmap)?.[1];

    marker(issues, roadmap, '- [x] P2.2 ایجاد مدل کاربر، سازمان، عضویت و تیم', 'وضعیت P2.2');
    marker(issues, traceability, 'EVD-032 — شاهد مدل دامنه هویت و سازمان P2.2', 'شاهد P2.2');
    marker(
      issues,
      status,
      '- مدل‌های دامنه P2.2 در سه Workspace مستقل و بدون Persistence ثبت شده‌اند.',
      'Project Status P2.2',
    );

    if (current === undefined || !stageAtOrAfterP23(current)) {
      issues.push(`مرحله جاری باید P2.3 یا بعد از آن باشد: ${String(current)}`);
    }
  }

  return {
    schemaVersion: 1,
    stage: 'P2.2',
    mode,
    generatedAt: now.toISOString(),
    evidenceCount: mode === 'closed' ? 32 : 31,
    workspaces: architecture.workspaces.length,
    sourceFiles: architecture.sourceFiles,
    packageManifests: security.packageManifests,
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
    throw new Error('حالت ممیزی P2.2 باید auto، pre یا closed باشد.');
  }

  const report = inspectP22DomainModel(process.cwd(), requested);
  mkdirSync(resolve('artifacts/acceptance'), { recursive: true });
  writeFileSync(
    resolve('artifacts/acceptance/p2.2-domain-model-audit.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  if (report.issues.length > 0) {
    throw new Error(`P2.2 domain model audit failed\n${report.issues.join('\n')}`);
  }

  process.stdout.write(
    `P2.2_DOMAIN_MODEL_AUDIT_PASSED: mode=${report.mode} evidence=${String(report.evidenceCount)} workspaces=${String(report.workspaces)} sourceFiles=${String(report.sourceFiles)} packageManifests=${String(report.packageManifests)}\n`,
  );
}
