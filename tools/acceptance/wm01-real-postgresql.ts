import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createPostgreSqlAccess,
  inspectLeastPrivilegeDatabaseRoles,
  loadVersionedMigrations,
  runTrackedVersionedMigrations,
  withOrganizationTransaction,
  withRuntimeTransaction,
  type PostgreSqlAccess,
} from '../../packages/database/src/index.js';

function loadLocalEnvironment(path: string): void {
  if (!existsSync(path)) {
    throw new Error('.env.local برای آزمون واقعی WM-01 موجود نیست.');
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

    process.env[name] ??= value;
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

function safeDatabaseIdentifier(value: string): string {
  if (!/^[a-z0-9_]+$/u.test(value)) {
    throw new Error('نام دیتابیس موقت معتبر نیست.');
  }

  return `"${value}"`;
}

async function rejected(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation();
    return false;
  } catch {
    return true;
  }
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function expectCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function insertIdentityFixtures(
  access: PostgreSqlAccess,
  input: {
    readonly userA: string;
    readonly userB: string;
    readonly organizationA: string;
    readonly organizationB: string;
    readonly membershipA: string;
    readonly membershipB: string;
    readonly now: string;
  },
): Promise<void> {
  await access.transaction(async (transaction) => {
    await transaction.query(
      `INSERT INTO public.orgawork_users
         (id, email, status, created_at, updated_at, version)
       VALUES
         ($1, $3, 'active', $5, $5, 1),
         ($2, $4, 'active', $5, $5, 1)`,
      [
        input.userA,
        input.userB,
        `wm01-a-${input.userA}@example.test`,
        `wm01-b-${input.userB}@example.test`,
        input.now,
      ],
    );

    await transaction.query(
      `INSERT INTO public.orgawork_organizations
         (id, name, created_at, updated_at, version)
       VALUES
         ($1, 'سازمان آزمون Work Management الف', $3, $3, 1),
         ($2, 'سازمان آزمون Work Management ب', $3, $3, 1)`,
      [input.organizationA, input.organizationB, input.now],
    );

    await transaction.query(
      `INSERT INTO public.orgawork_memberships
         (id, user_id, organization_id, status, created_at, updated_at, version)
       VALUES
         ($1, $2, $3, 'active', $7, $7, 1),
         ($4, $5, $6, 'active', $7, $7, 1)`,
      [
        input.membershipA,
        input.userA,
        input.organizationA,
        input.membershipB,
        input.userB,
        input.organizationB,
        input.now,
      ],
    );
  });
}

async function insertOwnCase(
  access: PostgreSqlAccess,
  input: {
    readonly organizationId: string;
    readonly membershipId: string;
    readonly caseId: string;
    readonly responsibilityId: string;
    readonly actionId: string;
    readonly now: string;
  },
): Promise<void> {
  await withOrganizationTransaction(access, input.organizationId, async (transaction) => {
    await transaction.query(
      `INSERT INTO public.orgawork_cases
         (
           id,
           organization_id,
           title,
           description,
           priority,
           due_at,
           created_by_membership_id,
           status,
           cancellation_reason,
           created_at,
           updated_at,
           version
         )
       VALUES
         ($1, $2, 'پرونده آزمون واقعی P3', 'بررسی ایزوله PostgreSQL', 'normal', NULL, $3, 'open', NULL, $4, $4, 1)`,
      [input.caseId, input.organizationId, input.membershipId, input.now],
    );

    await transaction.query(
      `INSERT INTO public.orgawork_case_responsibilities
         (
           id,
           organization_id,
           case_id,
           target_kind,
           target_membership_id,
           target_team_id,
           assigned_by_membership_id,
           status,
           acceptance_mode,
           role,
           accepted_by_membership_id,
           rejected_by_membership_id,
           rejection_reason,
           transferred_to_responsibility_id,
           accepted_at,
           ended_at,
           created_at,
           updated_at,
           version
         )
       VALUES
         (
           $1, $2, $3, 'membership', $4, NULL, $4, 'accepted', 'self', 'primary',
           $4, NULL, NULL, NULL, $5, NULL, $5, $5, 1
         )`,
      [input.responsibilityId, input.organizationId, input.caseId, input.membershipId, input.now],
    );

    await transaction.query(
      `INSERT INTO public.orgawork_actions
         (
           id,
           organization_id,
           case_id,
           source_responsibility_id,
           responsible_kind,
           responsible_membership_id,
           responsible_team_id,
           created_by_membership_id,
           kind,
           parent_action_id,
           title,
           due_at,
           status,
           cancellation_reason,
           cancelled_by_membership_id,
           created_at,
           started_at,
           updated_at,
           version
         )
       VALUES
         (
           $1, $2, $3, $4, 'membership', $5, NULL, $5, 'primary', NULL,
           'اقدام اولیه آزمون P3', NULL, 'pending', NULL, NULL, $6, NULL, $6, 1
         )`,
      [
        input.actionId,
        input.organizationId,
        input.caseId,
        input.responsibilityId,
        input.membershipId,
        input.now,
      ],
    );

    await transaction.query(
      `INSERT INTO public.orgawork_case_current_work
         (organization_id, case_id, kind, action_id, responsibility_id, started_at, ended_at)
       VALUES
         ($1, $2, 'action', $3, NULL, $4, NULL)`,
      [input.organizationId, input.caseId, input.actionId, input.now],
    );

    await transaction.query(
      `INSERT INTO public.orgawork_idempotency_records
         (
           organization_id,
           operation,
           idempotency_key,
           request_fingerprint,
           request_id,
           correlation_id,
           state,
           resource_id,
           response_status,
           result_snapshot,
           created_at,
           completed_at
         )
       VALUES
         ($1, 'case.create_self', $2, $3, $4, $5, 'in_progress', NULL, NULL, NULL, $6, NULL)`,
      [
        input.organizationId,
        `case:create:${input.caseId}`,
        fingerprint(`case.create_self:${input.organizationId}:${input.caseId}`),
        randomUUID(),
        randomUUID(),
        input.now,
      ],
    );
  });
}

async function inspectP3Schema(access: PostgreSqlAccess): Promise<void> {
  const expectedTables = [
    'orgawork_actions',
    'orgawork_case_current_work',
    'orgawork_case_responsibilities',
    'orgawork_cases',
    'orgawork_idempotency_records',
  ] as const;

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
    [[...expectedTables]],
  );

  expectCondition(
    tables.rows.length === expectedTables.length,
    'جداول canonical WM-01 کامل نیستند.',
  );

  for (const table of tables.rows) {
    expectCondition(
      table.rls_enabled && table.rls_forced,
      `RLS اجباری جدول ${table.table_name} فعال نیست.`,
    );
  }

  const policies = await access.query<{
    readonly tablename: string;
    readonly qual: string | null;
    readonly with_check: string | null;
  }>(
    `SELECT tablename, qual, with_check
       FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
        AND roles @> ARRAY['orgawork_runtime']::name[]
      ORDER BY tablename`,
    [[...expectedTables]],
  );

  expectCondition(
    policies.rows.length === expectedTables.length,
    'Policyهای orgawork_runtime برای جداول WM-01 کامل نیستند.',
  );

  for (const policy of policies.rows) {
    expectCondition(
      policy.qual?.includes('orgawork_current_organization_id') === true &&
        policy.with_check?.includes('orgawork_current_organization_id') === true,
      `Policy tenant جدول ${policy.tablename} از context canonical استفاده نمی‌کند.`,
    );
  }

  const privileges = await access.query<{
    readonly table_name: string;
    readonly can_select: boolean;
    readonly can_insert: boolean;
    readonly can_update: boolean;
    readonly can_delete: boolean;
  }>(
    `SELECT
       table_name,
       has_table_privilege('orgawork_runtime', 'public.' || table_name, 'SELECT') AS can_select,
       has_table_privilege('orgawork_runtime', 'public.' || table_name, 'INSERT') AS can_insert,
       has_table_privilege('orgawork_runtime', 'public.' || table_name, 'UPDATE') AS can_update,
       has_table_privilege('orgawork_runtime', 'public.' || table_name, 'DELETE') AS can_delete
     FROM unnest($1::text[]) AS table_name
     ORDER BY table_name`,
    [[...expectedTables]],
  );

  for (const privilege of privileges.rows) {
    expectCondition(
      privilege.can_select && privilege.can_insert && privilege.can_update && !privilege.can_delete,
      `Privilegeهای Runtime جدول ${privilege.table_name} least-privilege نیستند.`,
    );
  }

  const legacy = await access.query<{
    readonly cases_absent: boolean;
    readonly assignments_absent: boolean;
    readonly actions_absent: boolean;
  }>(
    `SELECT
       to_regclass('public.cases') IS NULL AS cases_absent,
       to_regclass('public.case_assignments') IS NULL AS assignments_absent,
       to_regclass('public.action_items') IS NULL AS actions_absent`,
  );

  const legacyState = legacy.rows[0];
  expectCondition(
    legacyState?.cases_absent === true &&
      legacyState.assignments_absent === true &&
      legacyState.actions_absent === true,
    'Schema drift تاریخی داخل دیتابیس ایزوله WM-01 ظاهر شده است.',
  );

  const grants = await access.query<{ readonly role_key: string }>(
    `SELECT role_key
       FROM public.orgawork_role_permissions
      WHERE permission_key = 'case.create_self'
      ORDER BY role_key`,
  );

  expectCondition(
    grants.rows.map((row) => row.role_key).join(',') === 'manager,member',
    'Grant دیتابیسی case.create_self با قرارداد WM-01 سازگار نیست.',
  );

  process.stdout.write('WM-01_REAL_SCHEMA_RLS_PRIVILEGES: VERIFIED\n');
}

async function inspectTenantIsolation(
  access: PostgreSqlAccess,
  input: {
    readonly organizationA: string;
    readonly organizationB: string;
    readonly membershipA: string;
    readonly membershipB: string;
    readonly caseA: string;
    readonly caseB: string;
    readonly responsibilityA: string;
    readonly actionA: string;
    readonly now: string;
  },
): Promise<void> {
  await withRuntimeTransaction(access, async (transaction) => {
    const invisible = await transaction.query<{ readonly count: number }>(
      `SELECT count(*)::int AS count
         FROM public.orgawork_cases
        WHERE id = ANY($1::uuid[])`,
      [[input.caseA, input.caseB]],
    );

    expectCondition(
      invisible.rows[0]?.count === 0,
      'پرونده‌های Work Management بدون Tenant Context قابل مشاهده هستند.',
    );
  });

  const visibleA = await withOrganizationTransaction(
    access,
    input.organizationA,
    async (transaction) =>
      transaction.query<{ readonly id: string }>(
        `SELECT id::text AS id
           FROM public.orgawork_cases
          WHERE id = ANY($1::uuid[])
          ORDER BY id`,
        [[input.caseA, input.caseB]],
      ),
  );

  expectCondition(
    visibleA.rows.length === 1 && visibleA.rows[0]?.id === input.caseA,
    'جداسازی پرونده سازمان A معتبر نیست.',
  );

  const visibleB = await withOrganizationTransaction(
    access,
    input.organizationB,
    async (transaction) =>
      transaction.query<{ readonly id: string }>(
        `SELECT id::text AS id
           FROM public.orgawork_cases
          WHERE id = ANY($1::uuid[])
          ORDER BY id`,
        [[input.caseA, input.caseB]],
      ),
  );

  expectCondition(
    visibleB.rows.length === 1 && visibleB.rows[0]?.id === input.caseB,
    'جداسازی پرونده سازمان B معتبر نیست.',
  );

  const crossTenantInsertRejected = await rejected(() =>
    withOrganizationTransaction(access, input.organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_cases
           (
             id,
             organization_id,
             title,
             description,
             priority,
             due_at,
             created_by_membership_id,
             status,
             cancellation_reason,
             created_at,
             updated_at,
             version
           )
         VALUES
           ($1, $2, 'پرونده غیرمجاز', 'آزمون RLS', 'normal', NULL, $3, 'open', NULL, $4, $4, 1)`,
        [randomUUID(), input.organizationB, input.membershipB, input.now],
      );
    }),
  );

  expectCondition(crossTenantInsertRejected, 'درج cross-tenant پرونده توسط RLS رد نشد.');

  const crossTenantRelationRejected = await rejected(() =>
    withOrganizationTransaction(access, input.organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_case_responsibilities
           (
             id,
             organization_id,
             case_id,
             target_kind,
             target_membership_id,
             target_team_id,
             assigned_by_membership_id,
             status,
             acceptance_mode,
             role,
             accepted_by_membership_id,
             rejected_by_membership_id,
             rejection_reason,
             transferred_to_responsibility_id,
             accepted_at,
             ended_at,
             created_at,
             updated_at,
             version
           )
         VALUES
           (
             $1, $2, $3, 'membership', $4, NULL, $5, 'pending', 'explicit', 'collaborator',
             NULL, NULL, NULL, NULL, NULL, NULL, $6, $6, 1
           )`,
        [
          randomUUID(),
          input.organizationA,
          input.caseA,
          input.membershipB,
          input.membershipA,
          input.now,
        ],
      );
    }),
  );

  expectCondition(crossTenantRelationRejected, 'Composite FK مسئولیت cross-tenant را رد نکرد.');

  process.stdout.write('WM-01_REAL_TENANT_ISOLATION: VERIFIED\n');
}

async function inspectInvariantRejections(
  access: PostgreSqlAccess,
  input: {
    readonly organizationA: string;
    readonly membershipA: string;
    readonly caseA: string;
    readonly responsibilityA: string;
    readonly actionA: string;
    readonly now: string;
  },
): Promise<void> {
  const duplicatePrimaryRejected = await rejected(() =>
    withOrganizationTransaction(access, input.organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_case_responsibilities
           (
             id,
             organization_id,
             case_id,
             target_kind,
             target_membership_id,
             target_team_id,
             assigned_by_membership_id,
             status,
             acceptance_mode,
             role,
             accepted_by_membership_id,
             rejected_by_membership_id,
             rejection_reason,
             transferred_to_responsibility_id,
             accepted_at,
             ended_at,
             created_at,
             updated_at,
             version
           )
         VALUES
           (
             $1, $2, $3, 'membership', $4, NULL, $4, 'pending', 'explicit', 'primary',
             NULL, NULL, NULL, NULL, NULL, NULL, $5, $5, 1
           )`,
        [randomUUID(), input.organizationA, input.caseA, input.membershipA, input.now],
      );
    }),
  );

  expectCondition(duplicatePrimaryRejected, 'Unique active primary responsibility اعمال نشد.');

  const duplicateCurrentWorkRejected = await rejected(() =>
    withOrganizationTransaction(access, input.organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_case_current_work
           (organization_id, case_id, kind, action_id, responsibility_id, started_at, ended_at)
         VALUES
           ($1, $2, 'action', $3, NULL, $4, NULL)`,
        [input.organizationA, input.caseA, input.actionA, input.now],
      );
    }),
  );

  expectCondition(duplicateCurrentWorkRejected, 'Unique active current work اعمال نشد.');

  const invalidTransitionRejected = await rejected(() =>
    withOrganizationTransaction(access, input.organizationA, async (transaction) => {
      await transaction.query(
        `UPDATE public.orgawork_cases
            SET status = 'closed',
                updated_at = clock_timestamp(),
                version = version + 1
          WHERE id = $1`,
        [input.caseA],
      );
    }),
  );

  expectCondition(invalidTransitionRejected, 'Transition نامعتبر open -> closed رد نشد.');

  const duplicateIdempotencyRejected = await rejected(() =>
    withOrganizationTransaction(access, input.organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_idempotency_records
           (
             organization_id,
             operation,
             idempotency_key,
             request_fingerprint,
             request_id,
             correlation_id,
             state,
             resource_id,
             response_status,
             result_snapshot,
             created_at,
             completed_at
           )
         VALUES
           ($1, 'case.create_self', $2, $3, $4, $5, 'in_progress', NULL, NULL, NULL, $6, NULL)`,
        [
          input.organizationA,
          `case:create:${input.caseA}`,
          fingerprint(`duplicate:${input.caseA}`),
          randomUUID(),
          randomUUID(),
          input.now,
        ],
      );
    }),
  );

  expectCondition(
    duplicateIdempotencyRejected,
    'کلید idempotency تکراری برای همان سازمان/operation رد نشد.',
  );

  const orphanOpenCaseRejected = await rejected(() =>
    withOrganizationTransaction(access, input.organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_cases
           (
             id,
             organization_id,
             title,
             description,
             priority,
             due_at,
             created_by_membership_id,
             status,
             cancellation_reason,
             created_at,
             updated_at,
             version
           )
         VALUES
           ($1, $2, 'پرونده یتیم', 'باید هنگام commit رد شود', 'normal', NULL, $3, 'open', NULL, $4, $4, 1)`,
        [randomUUID(), input.organizationA, input.membershipA, input.now],
      );
    }),
  );

  expectCondition(
    orphanOpenCaseRejected,
    'Deferred invariant پرونده باز بدون مسئولیت/current-work را رد نکرد.',
  );

  process.stdout.write('WM-01_REAL_DATABASE_INVARIANTS: VERIFIED\n');
}

loadLocalEnvironment(resolve('.env.local'));

const connection = {
  host: process.env['POSTGRES_HOST']?.trim() || '127.0.0.1',
  port: port('POSTGRES_PORT', 5432),
  user: process.env['POSTGRES_USER']?.trim() || 'orgawork',
  password: required('POSTGRES_PASSWORD'),
};

const control = createPostgreSqlAccess(
  {
    ...connection,
    database: 'postgres',
  },
  {
    applicationName: 'orgawork-wm01-real-control',
    maximumConnections: 2,
    statementTimeoutMilliseconds: 30_000,
    queryTimeoutMilliseconds: 30_000,
  },
);

const temporaryDatabaseName = `orgawork_wm01_acceptance_${randomUUID().replaceAll('-', '')}`;
const temporaryDatabaseIdentifier = safeDatabaseIdentifier(temporaryDatabaseName);
let temporaryAccess: PostgreSqlAccess | undefined;
let databaseCreated = false;

const ids = {
  userA: randomUUID(),
  userB: randomUUID(),
  organizationA: randomUUID(),
  organizationB: randomUUID(),
  membershipA: randomUUID(),
  membershipB: randomUUID(),
  caseA: randomUUID(),
  caseB: randomUUID(),
  responsibilityA: randomUUID(),
  responsibilityB: randomUUID(),
  actionA: randomUUID(),
  actionB: randomUUID(),
};
const now = new Date().toISOString();

try {
  await control.query(`CREATE DATABASE ${temporaryDatabaseIdentifier} TEMPLATE template0`);
  databaseCreated = true;
  process.stdout.write('WM-01_REAL_TEMP_DATABASE: CREATED\n');

  temporaryAccess = createPostgreSqlAccess(
    {
      ...connection,
      database: temporaryDatabaseName,
    },
    {
      applicationName: 'orgawork-wm01-real-acceptance',
      maximumConnections: 4,
      statementTimeoutMilliseconds: 30_000,
      queryTimeoutMilliseconds: 30_000,
    },
  );

  const migrations = await loadVersionedMigrations('infra/migrations');
  expectCondition(
    migrations.length === 10 &&
      migrations[0]?.version === 1 &&
      migrations.at(-1)?.version === 10 &&
      migrations.at(-1)?.fileName === '0010_create-work-management-foundation.sql',
    'مجموعه Migration آزمون WM-01 دقیقاً 0001..0010 canonical نیست.',
  );

  const first = await runTrackedVersionedMigrations(temporaryAccess, migrations);
  const second = await runTrackedVersionedMigrations(temporaryAccess, migrations);

  expectCondition(
    first.appliedVersions.join(',') === '1,2,3,4,5,6,7,8,9,10',
    'اجرای fresh Migrationهای 0001..0010 کامل نیست.',
  );
  expectCondition(
    second.appliedVersions.length === 0 &&
      second.skippedVersions.join(',') === '1,2,3,4,5,6,7,8,9,10',
    'اجرای دوباره Migrationهای WM-01 idempotent نیست.',
  );

  process.stdout.write('WM-01_REAL_MIGRATIONS_0001_0010: VERIFIED\n');

  const roles = await inspectLeastPrivilegeDatabaseRoles(temporaryAccess);
  expectCondition(
    !roles.runtime.bypassesRowLevelSecurity &&
      !roles.runtime.canCreateInPublicSchema &&
      !roles.runtime.canReadMigrationHistory,
    'نقش orgawork_runtime در دیتابیس ایزوله least-privilege نیست.',
  );

  process.stdout.write('WM-01_REAL_RUNTIME_ROLE: VERIFIED\n');

  await inspectP3Schema(temporaryAccess);

  await insertIdentityFixtures(temporaryAccess, {
    userA: ids.userA,
    userB: ids.userB,
    organizationA: ids.organizationA,
    organizationB: ids.organizationB,
    membershipA: ids.membershipA,
    membershipB: ids.membershipB,
    now,
  });

  await insertOwnCase(temporaryAccess, {
    organizationId: ids.organizationA,
    membershipId: ids.membershipA,
    caseId: ids.caseA,
    responsibilityId: ids.responsibilityA,
    actionId: ids.actionA,
    now,
  });

  await insertOwnCase(temporaryAccess, {
    organizationId: ids.organizationB,
    membershipId: ids.membershipB,
    caseId: ids.caseB,
    responsibilityId: ids.responsibilityB,
    actionId: ids.actionB,
    now,
  });

  process.stdout.write('WM-01_REAL_CREATE_OWN_CASE_FIXTURES: VERIFIED\n');

  await inspectTenantIsolation(temporaryAccess, {
    organizationA: ids.organizationA,
    organizationB: ids.organizationB,
    membershipA: ids.membershipA,
    membershipB: ids.membershipB,
    caseA: ids.caseA,
    caseB: ids.caseB,
    responsibilityA: ids.responsibilityA,
    actionA: ids.actionA,
    now,
  });

  await inspectInvariantRejections(temporaryAccess, {
    organizationA: ids.organizationA,
    membershipA: ids.membershipA,
    caseA: ids.caseA,
    responsibilityA: ids.responsibilityA,
    actionA: ids.actionA,
    now,
  });

  process.stdout.write('WM-01_REAL_POSTGRESQL_ACCEPTANCE: PASSED\n');
} finally {
  if (temporaryAccess !== undefined) {
    await temporaryAccess.close();
  }

  if (databaseCreated) {
    await control.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()`,
      [temporaryDatabaseName],
    );
    await control.query(`DROP DATABASE IF EXISTS ${temporaryDatabaseIdentifier}`);
    process.stdout.write('WM-01_REAL_TEMP_DATABASE: DROPPED\n');
  }

  await control.close();
}
