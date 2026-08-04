import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createPostgreSqlAccess,
  loadVersionedMigrations,
  runTrackedVersionedMigrations,
  withOrganizationTransaction,
} from '../../packages/database/src/index.js';
import {
  AuthenticationError,
  createAuthenticationService,
  createPostgreSqlAuthenticationRepository,
} from '../../modules/authentication/src/index.js';
import {
  createOrganizationContextService,
  createPostgreSqlOrganizationContextRepository,
} from '../../modules/organization-context/src/index.js';
import {
  createAuthorizationService,
  createPostgreSqlAuthorizationRepository,
} from '../../modules/authorization/src/index.js';
import {
  createOrganizationAdministrationService,
  createPostgreSqlOrganizationAdministrationRepository,
} from '../../modules/organization-administration/src/index.js';

function loadEnvironment(): void {
  const path = resolve('.env.local');
  if (!existsSync(path)) throw new Error('.env.local موجود نیست.');
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    process.env[key] ??= value;
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`${name} تعریف نشده است.`);
  return value;
}

loadEnvironment();
const access = createPostgreSqlAccess(
  {
    host: process.env['POSTGRES_HOST']?.trim() || '127.0.0.1',
    port: Number(process.env['POSTGRES_PORT'] ?? 5432),
    database: process.env['POSTGRES_DB']?.trim() || 'orgawork',
    user: process.env['POSTGRES_USER']?.trim() || 'orgawork',
    password: required('POSTGRES_PASSWORD'),
  },
  {
    applicationName: 'orgawork-p2-real',
    maximumConnections: 4,
    statementTimeoutMilliseconds: 30_000,
    queryTimeoutMilliseconds: 30_000,
  },
);

const ids = {
  userA: randomUUID(),
  userB: randomUUID(),
  organizationA: randomUUID(),
  organizationB: randomUUID(),
  membershipA: randomUUID(),
  membershipB: randomUUID(),
  denial: randomUUID(),
};
const emailA = `p2-a-${ids.userA}@example.test`;
const emailB = `p2-b-${ids.userB}@example.test`;
const password = 'P2 secure acceptance password 1405';
const now = new Date().toISOString();

try {
  const migrations = await loadVersionedMigrations('infra/migrations');
  const first = await runTrackedVersionedMigrations(access, migrations);
  const second = await runTrackedVersionedMigrations(access, migrations);
  if (!first.discoveredVersions.includes(9) || second.appliedVersions.length !== 0) {
    throw new Error('Migrationهای P2 کامل یا Idempotent نیستند.');
  }

  await access.transaction(async (transaction) => {
    await transaction.query(
      `INSERT INTO public.orgawork_users
         (id, email, status, created_at, updated_at, version)
       VALUES
         ($1, $3, 'active', $5, $5, 1),
         ($2, $4, 'active', $5, $5, 1)`,
      [ids.userA, ids.userB, emailA, emailB, now],
    );
    await transaction.query(
      `INSERT INTO public.orgawork_organizations
         (id, name, created_at, updated_at, version)
       VALUES
         ($1, 'سازمان الف', $3, $3, 1),
         ($2, 'سازمان ب', $3, $3, 1)`,
      [ids.organizationA, ids.organizationB, now],
    );
    await transaction.query(
      `INSERT INTO public.orgawork_memberships
         (id, user_id, organization_id, status, created_at, updated_at, version)
       VALUES
         ($1, $3, $4, 'active', $6, $6, 1),
         ($2, $3, $5, 'active', $6, $6, 1)`,
      [ids.membershipA, ids.membershipB, ids.userA, ids.organizationA, ids.organizationB, now],
    );
  });

  const authentication = await createAuthenticationService({
    repository: createPostgreSqlAuthenticationRepository(access),
  });
  await authentication.setPasswordCredential(ids.userA, password);
  const login = await authentication.login({
    email: emailA,
    password,
    clientAddress: '127.0.0.1',
  });
  if (login.session.currentOrganizationId !== null)
    throw new Error('نشست اولیه نباید سازمان جاری داشته باشد.');

  let csrfRejected = false;
  try {
    await authentication.logout(login.sessionSecret, 'invalid-csrf');
  } catch (error: unknown) {
    csrfRejected = error instanceof AuthenticationError && error.code === 'AUTH_CSRF_INVALID';
  }
  if (!csrfRejected) throw new Error('CSRF نامعتبر رد نشد.');

  const organizationContext = createOrganizationContextService(
    createPostgreSqlOrganizationContextRepository(access),
  );
  const organizations = await organizationContext.listOrganizations(ids.userA);
  if (organizations.length !== 2) {
    throw new Error(
      `فهرست سازمان‌های فعال کاربر نامعتبر است. expected=2 actual=${organizations.length}`,
    );
  }
  const switched = await organizationContext.switchOrganization({
    sessionId: login.session.id,
    userId: ids.userA,
    organizationId: ids.organizationA,
  });
  if (switched.sessionRevision !== 2)
    throw new Error('بازنگری نشست پس از تغییر سازمان افزایش نیافت.');

  await withOrganizationTransaction(access, ids.organizationA, async (transaction) => {
    await transaction.query(
      `INSERT INTO public.orgawork_membership_roles
         (membership_id, role_key, created_at)
       VALUES ($1, 'organization_admin', $2)`,
      [ids.membershipA, now],
    );
  });
  const authorization = createAuthorizationService(createPostgreSqlAuthorizationRepository(access));
  const allowed = await authorization.authorize({
    userId: ids.userA,
    organizationId: ids.organizationA,
    permission: 'organization.manage_members',
  });
  if (!allowed.allowed) throw new Error('مجوز مدیر سازمان اعمال نشد.');

  await withOrganizationTransaction(access, ids.organizationA, async (transaction) => {
    await transaction.query(
      `INSERT INTO public.orgawork_explicit_denials
         (id, organization_id, membership_id, permission_key, reason, created_at)
       VALUES ($1, $2, $3, 'task.update', 'آزمون عدم دسترسی', $4)`,
      [ids.denial, ids.organizationA, ids.membershipA, now],
    );
  });
  const denied = await authorization.authorize({
    userId: ids.userA,
    organizationId: ids.organizationA,
    permission: 'task.update',
  });
  if (denied.allowed || denied.reasonCode !== 'EXPLICIT_DENY') {
    throw new Error('اولویت عدم دسترسی صریح معتبر نیست.');
  }

  const administration = createOrganizationAdministrationService(
    createPostgreSqlOrganizationAdministrationRepository(access),
  );
  const invitation = await administration.createInvitation({
    organizationId: ids.organizationA,
    email: emailB,
    roleKey: 'member',
  });
  if (invitation.token === undefined) throw new Error('Token دعوت ایجاد نشد.');
  const accepted = await administration.acceptInvitation(invitation.token, ids.userB);
  if (accepted.organizationId !== ids.organizationA)
    throw new Error('پذیرش دعوت در سازمان نادرست انجام شد.');

  const tenantA = await withOrganizationTransaction(access, ids.organizationA, (transaction) =>
    transaction.query<{ readonly count: number }>(
      `SELECT count(*)::int AS count FROM public.orgawork_invitations WHERE organization_id = $1`,
      [ids.organizationA],
    ),
  );
  const tenantB = await withOrganizationTransaction(access, ids.organizationB, (transaction) =>
    transaction.query<{ readonly count: number }>(
      `SELECT count(*)::int AS count FROM public.orgawork_invitations WHERE organization_id = $1`,
      [ids.organizationA],
    ),
  );
  if (tenantA.rows[0]?.count !== 1 || tenantB.rows[0]?.count !== 0) {
    throw new Error('جداسازی دعوت بین سازمانی نامعتبر است.');
  }

  await authentication.logout(login.sessionSecret, switched.csrfToken);
  let revokedRejected = false;
  try {
    await authentication.getSession(login.sessionSecret);
  } catch (error: unknown) {
    revokedRejected = error instanceof AuthenticationError && error.code === 'AUTH_SESSION_REVOKED';
  }
  if (!revokedRejected) throw new Error('نشست لغوشده قابل استفاده باقی ماند.');

  process.stdout.write(
    'P2_REAL_POSTGRESQL_ACCEPTANCE_PASSED: migrations=9 login=verified csrf=verified session=verified organizationSwitch=verified explicitDeny=verified invitation=verified tenantIsolation=verified\n',
  );
} finally {
  try {
    await access.query('DELETE FROM public.orgawork_organizations WHERE id = ANY($1::uuid[])', [
      [ids.organizationA, ids.organizationB],
    ]);
    await access.query('DELETE FROM public.orgawork_users WHERE id = ANY($1::uuid[])', [
      [ids.userA, ids.userB],
    ]);
  } catch {
    // Best-effort cleanup; unique randomized identifiers prevent collisions on a later run.
  }
  await access.close();
}
