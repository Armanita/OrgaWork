import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectArchitecture } from '../checks/architecture-policy.js';
import { inspectRepositorySecurity } from '../checks/repository-security.js';
import { inspectP23DatabaseIsolation } from './p2.3-database-isolation-audit.js';

export type P2AuditMode = 'auto' | 'pre' | 'closed';
export interface P2AuditReport {
  readonly schemaVersion: 1;
  readonly stage: 'P2';
  readonly mode: 'pre' | 'closed';
  readonly generatedAt: string;
  readonly evidenceCount: number;
  readonly migrationVersion: 9;
  readonly workspaces: number;
  readonly sourceFiles: number;
  readonly packageManifests: number;
  readonly issues: readonly string[];
}
const requiredFiles = [
  'packages/security/src/index.ts',
  'modules/authentication/src/index.ts',
  'modules/organization-context/src/index.ts',
  'modules/authorization/src/index.ts',
  'modules/organization-administration/src/index.ts',
  'apps/api/src/routes/identity-organization.ts',
  'apps/api/src/routes/organization-administration.ts',
  'apps/web/app/login/page.tsx',
  'apps/web/app/organization/page.tsx',
  'apps/web/app/organization/members/page.tsx',
  'apps/web/app/organization/teams/page.tsx',
  'apps/web/app/api/identity/[...path]/route.ts',
  'infra/migrations/0005_create-password-credentials.sql',
  'infra/migrations/0006_create-session-and-organization-context.sql',
  'infra/migrations/0007_create-authorization-and-administration.sql',
  'infra/migrations/0008_fix-organization-user-lookup-policy.sql',
  'infra/migrations/0009_grant-role-permission-catalog-read.sql',
  'tools/acceptance/p2-negative-access.test.ts',
  'tools/acceptance/p2-real-postgresql.ts',
  'docs/acceptance/P2-FINAL-ACCEPTANCE.md',
] as const;
function read(repository: string, path: string) {
  return readFileSync(resolve(repository, path), 'utf8').replace(/\r\n?/gu, '\n');
}
function marker(issues: string[], content: string, expected: string, label: string) {
  if (!content.includes(expected)) issues.push(`${label}: ${expected}`);
}
export function inspectP2Complete(
  repository: string,
  requested: P2AuditMode = 'auto',
  now: Date = new Date(),
): P2AuditReport {
  const issues: string[] = [];
  const roadmap = read(repository, 'docs/ROADMAP.md');
  const status = read(repository, 'docs/PROJECT-STATUS.md');
  const decisions = read(repository, 'docs/DECISIONS.md');
  const mode =
    requested === 'auto' ? (roadmap.includes('- [x] P2.15 ') ? 'closed' : 'pre') : requested;
  const p23 = inspectP23DatabaseIsolation(repository, 'closed', now);
  for (const issue of p23.issues) issues.push(`P2.3: ${issue}`);
  for (const file of requiredFiles)
    if (!existsSync(resolve(repository, file))) issues.push(`فایل P2 موجود نیست: ${file}`);
  const auth = existsSync(resolve(repository, 'modules/authentication/src/index.ts'))
    ? read(repository, 'modules/authentication/src/index.ts')
    : '';
  const org = existsSync(resolve(repository, 'modules/organization-context/src/index.ts'))
    ? read(repository, 'modules/organization-context/src/index.ts')
    : '';
  const authorization = existsSync(resolve(repository, 'modules/authorization/src/index.ts'))
    ? read(repository, 'modules/authorization/src/index.ts')
    : '';
  const administration = existsSync(
    resolve(repository, 'modules/organization-administration/src/index.ts'),
  )
    ? read(repository, 'modules/organization-administration/src/index.ts')
    : '';
  const api = existsSync(resolve(repository, 'apps/api/src/routes/identity-organization.ts'))
    ? read(repository, 'apps/api/src/routes/identity-organization.ts')
    : '';
  const ui = existsSync(resolve(repository, 'apps/web/app/layout.tsx'))
    ? read(repository, 'apps/web/app/layout.tsx') + read(repository, 'apps/web/app/globals.css')
    : '';
  const m6 = existsSync(
    resolve(repository, 'infra/migrations/0006_create-session-and-organization-context.sql'),
  )
    ? read(repository, 'infra/migrations/0006_create-session-and-organization-context.sql')
    : '';
  const m7 = existsSync(
    resolve(repository, 'infra/migrations/0007_create-authorization-and-administration.sql'),
  )
    ? read(repository, 'infra/migrations/0007_create-authorization-and-administration.sql')
    : '';
  const m8 = existsSync(
    resolve(repository, 'infra/migrations/0008_fix-organization-user-lookup-policy.sql'),
  )
    ? read(repository, 'infra/migrations/0008_fix-organization-user-lookup-policy.sql')
    : '';
  const m9 = existsSync(
    resolve(repository, 'infra/migrations/0009_grant-role-permission-catalog-read.sql'),
  )
    ? read(repository, 'infra/migrations/0009_grant-role-permission-catalog-read.sql')
    : '';
  for (const expected of [
    'loginFailureLimit: 5',
    'loginFailureWindowMilliseconds: 15 * 60 * 1000',
    'idleTimeoutMilliseconds: 8 * 60 * 60 * 1000',
    'absoluteTimeoutMilliseconds: 7 * 24 * 60 * 60 * 1000',
    'hashSecurityToken(sessionSecret)',
    'AUTH_CSRF_INVALID',
    'requestPasswordReset',
    'confirmPasswordReset',
  ])
    marker(issues, auth, expected, 'ناوردایی احراز هویت');
  for (const expected of [
    'session_revision = session_revision + 1',
    'current_organization_id',
    'organizationCacheKey',
  ])
    marker(issues, org, expected, 'ناوردایی سازمان جاری');
  for (const expected of [
    "'EXPLICIT_DENY'",
    "'PERMISSION_MISSING'",
    'organizationRoleCatalog',
    'recordDecision',
  ])
    marker(issues, authorization, expected, 'ناوردایی مجوز');
  for (const expected of [
    '72 * 60 * 60 * 1000',
    'hashSecurityToken(token)',
    "status = 'active'",
    'removeTeamMember',
    "set_config('orgawork.user_id'",
    "set_config('orgawork.invitation_token_hash'",
    "set_config('orgawork.organization_id'",
    'invitationCandidateResult',
    'lockedInvitationResult',
    'FOR UPDATE OF invitation',
  ])
    marker(issues, administration, expected, 'ناوردایی مدیریت سازمان');
  for (const expected of [
    "'/v1/auth/login'",
    "'/v1/auth/current-organization'",
    "'__Host-orgawork-session'",
    "'x-csrf-token'",
  ])
    marker(issues, api, expected, 'قرارداد API');
  for (const expected of [
    'dir="rtl"',
    '@fontsource-variable/vazirmatn/wght.css',
    'Vazirmatn Variable',
  ])
    marker(issues, ui, expected, 'خط مبنای رابط');
  for (const expected of [
    'secret_hash text NOT NULL UNIQUE',
    'current_organization_id uuid NULL',
    'absolute_expires_at <= created_at',
  ])
    marker(issues, m6, expected, 'Migration نشست');
  for (const expected of [
    'orgawork_explicit_denials',
    'orgawork_membership_roles',
    'orgawork_invitations',
    'orgawork_authorization_audit',
  ])
    marker(issues, m7, expected, 'Migration مجوز');
  for (const expected of [
    'DROP POLICY IF EXISTS orgawork_organizations_user_lookup_policy',
    'membership.organization_id = orgawork_organizations.id',
  ])
    marker(issues, m8, expected, 'Migration اصلاح RLS');
  for (const expected of [
    'REVOKE ALL ON TABLE public.orgawork_role_permissions FROM PUBLIC',
    'GRANT SELECT',
    'TO orgawork_runtime',
  ])
    marker(issues, m9, expected, 'Migration مجوز کاتالوگ نقش');
  const architecture = inspectArchitecture(repository);
  for (const issue of architecture.issues)
    issues.push(`Architecture ${issue.code}: ${issue.source} -> ${issue.target}`);
  const security = inspectRepositorySecurity(repository);
  for (const issue of security.issues)
    issues.push(`Security ${issue.code}: ${issue.path} | ${issue.detail}`);
  if (mode === 'closed') {
    for (let stage = 4; stage <= 15; stage += 1)
      marker(issues, roadmap, `- [x] P2.${stage} `, `وضعیت P2.${stage}`);
    marker(issues, roadmap, '- مرحله جاری: `P3.1 تثبیت قرارداد دامنه پرونده`', 'مرحله بعدی');
    marker(issues, status, '- فاز جاری کلان: `P3 — پرونده، مسئولیت و اقدام`', 'وضعیت کلان');
    marker(issues, status, '- مرحله مادر `P2`: بسته و پذیرفته‌شده', 'پذیرش P2');
    marker(issues, decisions, 'DEC-P2-001', 'تصمیم نهایی P2');
  } else {
    marker(issues, roadmap, '- [ ] P2.15 آزمون و پذیرش مرحله', 'وضعیت پیش از بسته‌شدن');
  }
  return {
    schemaVersion: 1,
    stage: 'P2',
    mode,
    generatedAt: now.toISOString(),
    evidenceCount: mode === 'closed' ? 41 : 40,
    migrationVersion: 9,
    workspaces: architecture.workspaces.length,
    sourceFiles: architecture.sourceFiles,
    packageManifests: security.packageManifests,
    issues,
  };
}
function main() {
  const requested = (process.argv[2] ?? 'auto') as P2AuditMode;
  if (!['auto', 'pre', 'closed'].includes(requested)) throw new Error('حالت ممیزی P2 معتبر نیست.');
  const report = inspectP2Complete(process.cwd(), requested);
  mkdirSync(resolve('artifacts/acceptance'), { recursive: true });
  writeFileSync(
    resolve('artifacts/acceptance/p2-complete-audit.json'),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );
  if (report.issues.length > 0)
    throw new Error('P2 complete audit failed\n' + report.issues.join('\n'));
  process.stdout.write(
    `P2_COMPLETE_AUDIT_PASSED: mode=${report.mode} evidence=${report.evidenceCount} migration=${report.migrationVersion} workspaces=${report.workspaces} sourceFiles=${report.sourceFiles}\n`,
  );
}
const arg = process.argv[1];
if (arg !== undefined && import.meta.url === pathToFileURL(resolve(arg)).href) main();
