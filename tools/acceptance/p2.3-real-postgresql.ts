import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createPostgreSqlAccess,
  inspectLeastPrivilegeDatabaseRoles,
  loadVersionedMigrations,
  runTrackedVersionedMigrations,
  withOrganizationTransaction,
  type PostgreSqlAccess,
  type PostgreSqlQueryExecutor,
} from '../../packages/database/src/index.js';

function loadLocalEnvironment(path: string): void {
  if (!existsSync(path)) {
    throw new Error('.env.local برای آزمون واقعی P2.3 موجود نیست.');
  }

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');

    if (separator < 1) {
      continue;
    }

    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[name] === undefined) {
      process.env[name] = value;
    }
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (value === undefined || value === '') {
    throw new Error(`${name} در محیط آزمون واقعی تعریف نشده است.`);
  }

  return value;
}

function port(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? String(fallback));

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} معتبر نیست.`);
  }

  return value;
}

async function rejected(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation();
    return false;
  } catch {
    return true;
  }
}

async function runtimeWithoutOrganization(
  access: PostgreSqlAccess,
  operation: (transaction: PostgreSqlQueryExecutor) => Promise<void>,
): Promise<void> {
  await access.transaction(async (transaction) => {
    await transaction.query('SET LOCAL ROLE orgawork_runtime');
    await operation(transaction);
  });
}

loadLocalEnvironment(resolve('.env.local'));

const access = createPostgreSqlAccess(
  {
    host: process.env['POSTGRES_HOST']?.trim() || '127.0.0.1',
    port: port('POSTGRES_PORT', 5432),
    database: process.env['POSTGRES_DB']?.trim() || 'orgawork',
    user: process.env['POSTGRES_USER']?.trim() || 'orgawork',
    password: required('POSTGRES_PASSWORD'),
  },
  {
    applicationName: 'orgawork-p2.3-real-acceptance',
    maximumConnections: 4,
    statementTimeoutMilliseconds: 20_000,
    queryTimeoutMilliseconds: 20_000,
  },
);

const userA = randomUUID();
const userB = randomUUID();
const organizationA = randomUUID();
const organizationB = randomUUID();
const membershipA = randomUUID();
const suspendedMembershipA = randomUUID();
const membershipB = randomUUID();
const teamA = randomUUID();
const teamB = randomUUID();
const teamMembershipA = randomUUID();
const now = new Date().toISOString();
let fixturesPrepared = false;

try {
  const migrations = await loadVersionedMigrations('infra/migrations');
  const first = await runTrackedVersionedMigrations(access, migrations);
  const second = await runTrackedVersionedMigrations(access, migrations);

  if (!first.discoveredVersions.includes(4)) {
    throw new Error('Migration نسخه 4 کشف نشد.');
  }

  if (second.appliedVersions.length !== 0 || !second.skippedVersions.includes(4)) {
    throw new Error('اجرای دوباره Migration نسخه 4 Idempotent نیست.');
  }

  const roles = await inspectLeastPrivilegeDatabaseRoles(access);

  if (roles.runtime.bypassesRowLevelSecurity) {
    throw new Error('نقش Runtime قادر به عبور از RLS است.');
  }

  const tables = await access.query<{
    readonly table_name: string;
    readonly rls_enabled: boolean;
    readonly rls_forced: boolean;
  }>(
    `SELECT
       class.relname AS table_name,
       class.relrowsecurity AS rls_enabled,
       class.relforcerowsecurity AS rls_forced
     FROM pg_class AS class
     JOIN pg_namespace AS namespace
       ON namespace.oid = class.relnamespace
     WHERE namespace.nspname = 'public'
       AND class.relname = ANY($1::text[])
     ORDER BY class.relname`,
    [
      [
        'orgawork_organizations',
        'orgawork_memberships',
        'orgawork_teams',
        'orgawork_team_memberships',
      ],
    ],
  );

  if (tables.rows.length !== 4) {
    throw new Error('جداول سازمانی P2.3 کامل نیستند.');
  }

  for (const table of tables.rows) {
    if (!table.rls_enabled || !table.rls_forced) {
      throw new Error(`RLS جدول ${table.table_name} اجباری نیست.`);
    }
  }

  const policies = await access.query<{ readonly policy_count: number }>(
    `SELECT count(*)::int AS policy_count
       FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
        AND roles @> ARRAY['orgawork_runtime']::name[]`,
    [
      [
        'orgawork_organizations',
        'orgawork_memberships',
        'orgawork_teams',
        'orgawork_team_memberships',
      ],
    ],
  );

  if (policies.rows[0]?.policy_count !== 4) {
    throw new Error('Policyهای سازمانی P2.3 کامل نیستند.');
  }

  const constraints = await access.query<{ readonly definition: string }>(
    `SELECT pg_get_constraintdef(constraint_row.oid) AS definition
       FROM pg_constraint AS constraint_row
       JOIN pg_class AS class
         ON class.oid = constraint_row.conrelid
       JOIN pg_namespace AS namespace
         ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'public'
        AND class.relname = ANY($1::text[])`,
    [['orgawork_users', 'orgawork_memberships', 'orgawork_teams', 'orgawork_team_memberships']],
  );

  const definitions = constraints.rows.map((row) => row.definition).join('\n');

  for (const marker of [
    'UNIQUE (organization_id, user_id)',
    'UNIQUE (id, organization_id)',
    'FOREIGN KEY (team_id, organization_id)',
    'FOREIGN KEY (membership_id, organization_id)',
    "CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'disabled'::text])))",
    "CHECK ((role = ANY (ARRAY['member'::text, 'team_manager'::text])))",
  ]) {
    if (!definitions.includes(marker)) {
      throw new Error(`Constraint واقعی پیدا نشد: ${marker}`);
    }
  }

  process.stdout.write('P2.3_REAL_SCHEMA_INSPECTION: VERIFIED\n');

  await access.transaction(async (transaction) => {
    await transaction.query(
      `INSERT INTO public.orgawork_users
         (id, email, status, created_at, updated_at, version)
       VALUES
         ($1, $2, 'active', $5, $5, 1),
         ($3, $4, 'active', $5, $5, 1)`,
      [userA, `p23-${userA}@example.test`, userB, `p23-${userB}@example.test`, now],
    );
    process.stdout.write('P2.3_REAL_FIXTURE_USERS: INSERTED\n');

    await transaction.query(
      `INSERT INTO public.orgawork_organizations
         (id, name, created_at, updated_at, version)
       VALUES
         ($1, 'سازمان آزمون الف', $3, $3, 1),
         ($2, 'سازمان آزمون ب', $3, $3, 1)`,
      [organizationA, organizationB, now],
    );
    process.stdout.write('P2.3_REAL_FIXTURE_ORGANIZATIONS: INSERTED\n');

    await transaction.query(
      `INSERT INTO public.orgawork_memberships
         (id, user_id, organization_id, status, created_at, updated_at, version)
       VALUES
         ($1, $2, $3, 'active', $7, $7, 1),
         ($4, $6, $3, 'suspended', $7, $7, 1),
         ($5, $6, $8, 'active', $7, $7, 1)`,
      [
        membershipA,
        userA,
        organizationA,
        suspendedMembershipA,
        membershipB,
        userB,
        now,
        organizationB,
      ],
    );
    process.stdout.write('P2.3_REAL_FIXTURE_MEMBERSHIPS: INSERTED\n');

    await transaction.query(
      `INSERT INTO public.orgawork_teams
         (id, organization_id, name, created_at, updated_at, version)
       VALUES
         ($1, $2, 'تیم آزمون الف', $5, $5, 1),
         ($3, $4, 'تیم آزمون ب', $5, $5, 1)`,
      [teamA, organizationA, teamB, organizationB, now],
    );
    process.stdout.write('P2.3_REAL_FIXTURE_TEAMS: INSERTED\n');
  });

  fixturesPrepared = true;
  process.stdout.write('P2.3_REAL_FIXTURE_SETUP: VERIFIED\n');

  const duplicateEmailRejected = await rejected(() =>
    access.query(
      `INSERT INTO public.orgawork_users
         (id, email, status, created_at, updated_at, version)
       VALUES ($1, $2, 'pending', $3, $3, 1)`,
      [randomUUID(), `p23-${userA}@example.test`, now],
    ),
  );

  if (!duplicateEmailRejected) {
    throw new Error('ایمیل نرمال‌شده تکراری پذیرفته شد.');
  }

  await runtimeWithoutOrganization(access, async (transaction) => {
    const result = await transaction.query<{ readonly count: number }>(
      `SELECT count(*)::int AS count
         FROM public.orgawork_memberships
        WHERE id = ANY($1::uuid[])`,
      [[membershipA, membershipB]],
    );

    if (result.rows[0]?.count !== 0) {
      throw new Error('داده سازمانی بدون Tenant Context قابل مشاهده است.');
    }
  });

  const visibleA = await withOrganizationTransaction(access, organizationA, async (transaction) =>
    transaction.query<{ readonly id: string }>(
      `SELECT id::text AS id
           FROM public.orgawork_memberships
          WHERE id = ANY($1::uuid[])
          ORDER BY id`,
      [[membershipA, membershipB]],
    ),
  );

  if (visibleA.rows.length !== 1 || visibleA.rows[0]?.id !== membershipA) {
    throw new Error('جداسازی Membership سازمان الف نامعتبر است.');
  }

  const visibleB = await withOrganizationTransaction(access, organizationB, async (transaction) =>
    transaction.query<{ readonly id: string }>(
      `SELECT id::text AS id
           FROM public.orgawork_teams
          WHERE id = ANY($1::uuid[])
          ORDER BY id`,
      [[teamA, teamB]],
    ),
  );

  if (visibleB.rows.length !== 1 || visibleB.rows[0]?.id !== teamB) {
    throw new Error('جداسازی Team سازمان ب نامعتبر است.');
  }

  const crossTenantInsertRejected = await rejected(() =>
    withOrganizationTransaction(access, organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_teams
           (id, organization_id, name, created_at, updated_at, version)
         VALUES ($1, $2, 'تیم غیرمجاز', $3, $3, 1)`,
        [randomUUID(), organizationB, now],
      );
    }),
  );

  if (!crossTenantInsertRejected) {
    throw new Error('درج Team برای سازمان دیگر توسط RLS رد نشد.');
  }

  const inactiveMembershipRejected = await rejected(() =>
    withOrganizationTransaction(access, organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_team_memberships
           (
             id,
             organization_id,
             team_id,
             membership_id,
             role,
             created_at,
             updated_at,
             version
           )
         VALUES ($1, $2, $3, $4, 'member', $5, $5, 1)`,
        [randomUUID(), organizationA, teamA, suspendedMembershipA, now],
      );
    }),
  );

  if (!inactiveMembershipRejected) {
    throw new Error('Membership غیرفعال وارد Team شد.');
  }

  const crossOrganizationRelationRejected = await rejected(() =>
    withOrganizationTransaction(access, organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_team_memberships
           (
             id,
             organization_id,
             team_id,
             membership_id,
             role,
             created_at,
             updated_at,
             version
           )
         VALUES ($1, $2, $3, $4, 'member', $5, $5, 1)`,
        [randomUUID(), organizationA, teamA, membershipB, now],
      );
    }),
  );

  if (!crossOrganizationRelationRejected) {
    throw new Error('رابطه TeamMembership بین دو سازمان پذیرفته شد.');
  }

  const invalidTransitionRejected = await rejected(() =>
    withOrganizationTransaction(access, organizationA, async (transaction) => {
      await transaction.query(
        `UPDATE public.orgawork_memberships
            SET status = 'invited',
                updated_at = clock_timestamp(),
                version = version + 1
          WHERE id = $1`,
        [membershipA],
      );
    }),
  );

  if (!invalidTransitionRejected) {
    throw new Error('Transition نامعتبر Membership پذیرفته شد.');
  }

  await withOrganizationTransaction(access, organizationA, async (transaction) => {
    await transaction.query(
      `INSERT INTO public.orgawork_team_memberships
         (
           id,
           organization_id,
           team_id,
           membership_id,
           role,
           created_at,
           updated_at,
           version
         )
       VALUES ($1, $2, $3, $4, 'member', $5, $5, 1)`,
      [teamMembershipA, organizationA, teamA, membershipA, now],
    );

    await transaction.query(
      `UPDATE public.orgawork_team_memberships
          SET role = 'team_manager',
              updated_at = clock_timestamp(),
              version = version + 1
        WHERE id = $1`,
      [teamMembershipA],
    );

    const result = await transaction.query<{
      readonly role: string;
      readonly version: number;
    }>(
      `SELECT role, version
         FROM public.orgawork_team_memberships
        WHERE id = $1`,
      [teamMembershipA],
    );

    if (result.rows[0]?.role !== 'team_manager' || result.rows[0]?.version !== 2) {
      throw new Error('به‌روزرسانی نسخه‌دار TeamMembership نامعتبر است.');
    }
  });

  process.stdout.write('P2.3_REAL_MIGRATION_VERSION_4: VERIFIED\n');
  process.stdout.write('P2.3_REAL_RLS_FORCED_TABLES: VERIFIED\n');
  process.stdout.write('P2.3_REAL_CROSS_TENANT_ISOLATION: VERIFIED\n');
  process.stdout.write('P2.3_REAL_COMPOSITE_FOREIGN_KEYS: VERIFIED\n');
  process.stdout.write('P2.3_REAL_DOMAIN_TRANSITION_TRIGGERS: VERIFIED\n');
  process.stdout.write('P2.3_REAL_POSTGRESQL_ACCEPTANCE: PASSED\n');
} finally {
  try {
    if (fixturesPrepared) {
      await access.transaction(async (transaction) => {
        await transaction.query(
          `DELETE FROM public.orgawork_team_memberships
            WHERE id = $1`,
          [teamMembershipA],
        );

        await transaction.query(
          `DELETE FROM public.orgawork_teams
            WHERE id = ANY($1::uuid[])`,
          [[teamA, teamB]],
        );

        await transaction.query(
          `DELETE FROM public.orgawork_memberships
            WHERE id = ANY($1::uuid[])`,
          [[membershipA, suspendedMembershipA, membershipB]],
        );

        await transaction.query(
          `DELETE FROM public.orgawork_organizations
            WHERE id = ANY($1::uuid[])`,
          [[organizationA, organizationB]],
        );

        await transaction.query(
          `DELETE FROM public.orgawork_users
            WHERE id = ANY($1::uuid[])`,
          [[userA, userB]],
        );
      });

      process.stdout.write('P2.3_REAL_FIXTURE_CLEANUP: VERIFIED\n');
    }
  } finally {
    await access.close();
  }
}
