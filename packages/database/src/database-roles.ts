import type { QueryResult, QueryResultRow } from 'pg';

import type { PostgreSqlQueryExecutor } from './index.js';

export const databaseRoleNames = {
  migration: 'orgawork_migration',
  runtime: 'orgawork_runtime',
} as const;

export type DatabaseRoleKind = keyof typeof databaseRoleNames;
export type DatabaseRoleName = (typeof databaseRoleNames)[DatabaseRoleKind];

export type DatabaseRoleContractErrorCode =
  'ROLE_INSPECTION_FAILED' | 'ROLE_MISSING' | 'ROLE_PRIVILEGE_MISMATCH';

export class DatabaseRoleContractError extends Error {
  public readonly code: DatabaseRoleContractErrorCode;
  public readonly role: DatabaseRoleName | undefined;

  public constructor(
    code: DatabaseRoleContractErrorCode,
    message: string,
    context: { readonly role?: DatabaseRoleName } = {},
  ) {
    super(message);
    this.name = 'DatabaseRoleContractError';
    this.code = code;
    this.role = context.role;
  }
}

export interface DatabaseRoleState {
  readonly role: DatabaseRoleName;
  readonly canLogin: false;
  readonly isSuperuser: false;
  readonly canCreateDatabase: false;
  readonly canCreateRole: false;
  readonly canReplicate: false;
  readonly canConnect: true;
  readonly canUsePublicSchema: true;
  readonly canCreateInPublicSchema: boolean;
  readonly canReadMigrationHistory: boolean;
  readonly canInsertMigrationHistory: boolean;
  readonly canUpdateMigrationHistory: false;
  readonly canDeleteMigrationHistory: false;
}

export interface LeastPrivilegeDatabaseRoleState {
  readonly migration: DatabaseRoleState & {
    readonly role: 'orgawork_migration';
    readonly canCreateInPublicSchema: true;
    readonly canReadMigrationHistory: true;
    readonly canInsertMigrationHistory: true;
  };
  readonly runtime: DatabaseRoleState & {
    readonly role: 'orgawork_runtime';
    readonly canCreateInPublicSchema: false;
    readonly canReadMigrationHistory: false;
    readonly canInsertMigrationHistory: false;
  };
}

interface DatabaseRoleInspectionRow extends QueryResultRow {
  readonly role_name: string;
  readonly can_login: boolean;
  readonly is_superuser: boolean;
  readonly can_create_database: boolean;
  readonly can_create_role: boolean;
  readonly can_replicate: boolean;
  readonly can_connect: boolean;
  readonly can_use_public_schema: boolean;
  readonly can_create_in_public_schema: boolean;
  readonly can_read_migration_history: boolean;
  readonly can_insert_migration_history: boolean;
  readonly can_update_migration_history: boolean;
  readonly can_delete_migration_history: boolean;
}

const roleInspectionSql = `
  SELECT
    roles.rolname AS role_name,
    roles.rolcanlogin AS can_login,
    roles.rolsuper AS is_superuser,
    roles.rolcreatedb AS can_create_database,
    roles.rolcreaterole AS can_create_role,
    roles.rolreplication AS can_replicate,
    has_database_privilege(roles.oid, current_database(), 'CONNECT') AS can_connect,
    has_schema_privilege(roles.oid, 'public', 'USAGE') AS can_use_public_schema,
    has_schema_privilege(roles.oid, 'public', 'CREATE') AS can_create_in_public_schema,
    CASE
      WHEN to_regclass('public.orgawork_migration_history') IS NULL THEN false
      ELSE has_table_privilege(
        roles.oid,
        'public.orgawork_migration_history',
        'SELECT'
      )
    END AS can_read_migration_history,
    CASE
      WHEN to_regclass('public.orgawork_migration_history') IS NULL THEN false
      ELSE has_table_privilege(
        roles.oid,
        'public.orgawork_migration_history',
        'INSERT'
      )
    END AS can_insert_migration_history,
    CASE
      WHEN to_regclass('public.orgawork_migration_history') IS NULL THEN false
      ELSE has_table_privilege(
        roles.oid,
        'public.orgawork_migration_history',
        'UPDATE'
      )
    END AS can_update_migration_history,
    CASE
      WHEN to_regclass('public.orgawork_migration_history') IS NULL THEN false
      ELSE has_table_privilege(
        roles.oid,
        'public.orgawork_migration_history',
        'DELETE'
      )
    END AS can_delete_migration_history
  FROM pg_roles AS roles
  WHERE roles.rolname = ANY($1::text[])
  ORDER BY roles.rolname ASC
`;

function createRoleError(
  code: DatabaseRoleContractErrorCode,
  context: { readonly role?: DatabaseRoleName } = {},
): DatabaseRoleContractError {
  const messages: Readonly<Record<DatabaseRoleContractErrorCode, string>> = {
    ROLE_INSPECTION_FAILED: 'خواندن وضعیت نقش‌های PostgreSQL ناموفق بود.',
    ROLE_MISSING: 'یکی از نقش‌های الزامی PostgreSQL یافت نشد.',
    ROLE_PRIVILEGE_MISMATCH: 'سطح دسترسی نقش PostgreSQL با قرارداد مصوب سازگار نیست.',
  };

  return new DatabaseRoleContractError(code, messages[code], context);
}

function isDatabaseRoleName(value: string): value is DatabaseRoleName {
  return value === databaseRoleNames.migration || value === databaseRoleNames.runtime;
}

function readRole(
  rows: readonly DatabaseRoleInspectionRow[],
  role: DatabaseRoleName,
): DatabaseRoleInspectionRow {
  const matchingRows = rows.filter((row) => row.role_name === role);

  if (matchingRows.length !== 1) {
    throw createRoleError('ROLE_MISSING', { role });
  }

  const row = matchingRows[0];

  if (row === undefined) {
    throw createRoleError('ROLE_MISSING', { role });
  }

  return row;
}

function assertSharedLeastPrivilege(row: DatabaseRoleInspectionRow, role: DatabaseRoleName): void {
  if (
    row.can_login ||
    row.is_superuser ||
    row.can_create_database ||
    row.can_create_role ||
    row.can_replicate ||
    !row.can_connect ||
    !row.can_use_public_schema ||
    row.can_update_migration_history ||
    row.can_delete_migration_history
  ) {
    throw createRoleError('ROLE_PRIVILEGE_MISMATCH', { role });
  }
}

function validateMigrationRole(row: DatabaseRoleInspectionRow): void {
  assertSharedLeastPrivilege(row, databaseRoleNames.migration);

  if (
    !row.can_create_in_public_schema ||
    !row.can_read_migration_history ||
    !row.can_insert_migration_history
  ) {
    throw createRoleError('ROLE_PRIVILEGE_MISMATCH', {
      role: databaseRoleNames.migration,
    });
  }
}

function validateRuntimeRole(row: DatabaseRoleInspectionRow): void {
  assertSharedLeastPrivilege(row, databaseRoleNames.runtime);

  if (
    row.can_create_in_public_schema ||
    row.can_read_migration_history ||
    row.can_insert_migration_history
  ) {
    throw createRoleError('ROLE_PRIVILEGE_MISMATCH', {
      role: databaseRoleNames.runtime,
    });
  }
}

function toRoleState(row: DatabaseRoleInspectionRow, role: DatabaseRoleName): DatabaseRoleState {
  return {
    role,
    canLogin: false,
    isSuperuser: false,
    canCreateDatabase: false,
    canCreateRole: false,
    canReplicate: false,
    canConnect: true,
    canUsePublicSchema: true,
    canCreateInPublicSchema: row.can_create_in_public_schema,
    canReadMigrationHistory: row.can_read_migration_history,
    canInsertMigrationHistory: row.can_insert_migration_history,
    canUpdateMigrationHistory: false,
    canDeleteMigrationHistory: false,
  };
}

export async function inspectLeastPrivilegeDatabaseRoles(
  executor: PostgreSqlQueryExecutor,
): Promise<LeastPrivilegeDatabaseRoleState> {
  let result: QueryResult<DatabaseRoleInspectionRow>;

  try {
    result = await executor.query<DatabaseRoleInspectionRow>(roleInspectionSql, [
      [databaseRoleNames.migration, databaseRoleNames.runtime],
    ]);
  } catch {
    throw createRoleError('ROLE_INSPECTION_FAILED');
  }

  for (const row of result.rows) {
    if (!isDatabaseRoleName(row.role_name)) {
      throw createRoleError('ROLE_PRIVILEGE_MISMATCH');
    }
  }

  const migrationRow = readRole(result.rows, databaseRoleNames.migration);
  const runtimeRow = readRole(result.rows, databaseRoleNames.runtime);

  validateMigrationRole(migrationRow);
  validateRuntimeRole(runtimeRow);

  return {
    migration: {
      ...toRoleState(migrationRow, databaseRoleNames.migration),
      role: databaseRoleNames.migration,
      canCreateInPublicSchema: true,
      canReadMigrationHistory: true,
      canInsertMigrationHistory: true,
    },
    runtime: {
      ...toRoleState(runtimeRow, databaseRoleNames.runtime),
      role: databaseRoleNames.runtime,
      canCreateInPublicSchema: false,
      canReadMigrationHistory: false,
      canInsertMigrationHistory: false,
    },
  };
}
