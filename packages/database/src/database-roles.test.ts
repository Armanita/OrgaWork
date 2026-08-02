import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';

import type { PostgreSqlQueryExecutor } from './index.js';
import {
  DatabaseRoleContractError,
  databaseRoleNames,
  inspectLeastPrivilegeDatabaseRoles,
} from './database-roles.js';

interface RoleInspectionRow extends QueryResultRow {
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

interface RecordedQuery {
  readonly text: string;
  readonly values: readonly unknown[] | undefined;
}

function roleRow(
  role: 'orgawork_migration' | 'orgawork_runtime',
  overrides: Partial<RoleInspectionRow> = {},
): RoleInspectionRow {
  const migration = role === databaseRoleNames.migration;

  return {
    role_name: role,
    can_login: false,
    is_superuser: false,
    can_create_database: false,
    can_create_role: false,
    can_replicate: false,
    can_connect: true,
    can_use_public_schema: true,
    can_create_in_public_schema: migration,
    can_read_migration_history: migration,
    can_insert_migration_history: migration,
    can_update_migration_history: false,
    can_delete_migration_history: false,
    ...overrides,
  };
}

function queryResult<Row extends QueryResultRow>(rows: readonly Row[]): QueryResult<Row> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows: [...rows],
  };
}

function createExecutor(
  rows: readonly RoleInspectionRow[],
  failure: Error | undefined = undefined,
): { readonly executor: PostgreSqlQueryExecutor; readonly calls: RecordedQuery[] } {
  const calls: RecordedQuery[] = [];

  return {
    calls,
    executor: {
      query: <Row extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: readonly unknown[],
      ): Promise<QueryResult<Row>> => {
        calls.push({ text, values });

        if (failure !== undefined) {
          return Promise.reject(failure);
        }

        return Promise.resolve(queryResult(rows) as unknown as QueryResult<Row>);
      },
    },
  };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }

  throw new Error('انتظار می‌رفت قرارداد نقش با خطا متوقف شود.');
}

function expectRoleError(
  error: unknown,
  code: DatabaseRoleContractError['code'],
  role?: DatabaseRoleContractError['role'],
): void {
  expect(error).toBeInstanceOf(DatabaseRoleContractError);
  expect(error).toMatchObject({ code, role });
  expect(error).not.toHaveProperty('cause');
}

describe('least-privilege PostgreSQL roles', () => {
  it('exposes stable and distinct capability role names', () => {
    expect(databaseRoleNames).toEqual({
      migration: 'orgawork_migration',
      runtime: 'orgawork_runtime',
    });
    expect(databaseRoleNames.migration).not.toBe(databaseRoleNames.runtime);
  });

  it('inspects both role names through one parameterized query', async () => {
    const fake = createExecutor([
      roleRow(databaseRoleNames.migration),
      roleRow(databaseRoleNames.runtime),
    ]);

    await inspectLeastPrivilegeDatabaseRoles(fake.executor);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.text).toContain('roles.rolname = ANY($1::text[])');
    expect(fake.calls[0]?.values).toEqual([
      [databaseRoleNames.migration, databaseRoleNames.runtime],
    ]);
  });

  it('accepts the approved migration and runtime privilege split', async () => {
    const fake = createExecutor([
      roleRow(databaseRoleNames.runtime),
      roleRow(databaseRoleNames.migration),
    ]);

    const state = await inspectLeastPrivilegeDatabaseRoles(fake.executor);

    expect(state.migration).toMatchObject({
      role: databaseRoleNames.migration,
      canLogin: false,
      isSuperuser: false,
      canCreateDatabase: false,
      canCreateRole: false,
      canReplicate: false,
      canConnect: true,
      canUsePublicSchema: true,
      canCreateInPublicSchema: true,
      canReadMigrationHistory: true,
      canInsertMigrationHistory: true,
      canUpdateMigrationHistory: false,
      canDeleteMigrationHistory: false,
    });
    expect(state.runtime).toMatchObject({
      role: databaseRoleNames.runtime,
      canCreateInPublicSchema: false,
      canReadMigrationHistory: false,
      canInsertMigrationHistory: false,
    });
  });

  it('rejects a missing required role with a stable error', async () => {
    const fake = createExecutor([roleRow(databaseRoleNames.migration)]);
    const error = await captureError(inspectLeastPrivilegeDatabaseRoles(fake.executor));

    expectRoleError(error, 'ROLE_MISSING', databaseRoleNames.runtime);
  });

  it('rejects login or elevated cluster attributes', async () => {
    const fake = createExecutor([
      roleRow(databaseRoleNames.migration, { can_create_role: true }),
      roleRow(databaseRoleNames.runtime),
    ]);
    const error = await captureError(inspectLeastPrivilegeDatabaseRoles(fake.executor));

    expectRoleError(error, 'ROLE_PRIVILEGE_MISMATCH', databaseRoleNames.migration);
  });

  it('rejects a migration role without schema creation or history write access', async () => {
    const fake = createExecutor([
      roleRow(databaseRoleNames.migration, { can_insert_migration_history: false }),
      roleRow(databaseRoleNames.runtime),
    ]);
    const error = await captureError(inspectLeastPrivilegeDatabaseRoles(fake.executor));

    expectRoleError(error, 'ROLE_PRIVILEGE_MISMATCH', databaseRoleNames.migration);
  });

  it('rejects runtime schema creation or migration-history access', async () => {
    const fake = createExecutor([
      roleRow(databaseRoleNames.migration),
      roleRow(databaseRoleNames.runtime, { can_create_in_public_schema: true }),
    ]);
    const error = await captureError(inspectLeastPrivilegeDatabaseRoles(fake.executor));

    expectRoleError(error, 'ROLE_PRIVILEGE_MISMATCH', databaseRoleNames.runtime);
  });

  it('replaces raw inspection failures with a secret-free stable error', async () => {
    const fake = createExecutor([], new Error('password=should-not-leak'));
    const error = await captureError(inspectLeastPrivilegeDatabaseRoles(fake.executor));

    expectRoleError(error, 'ROLE_INSPECTION_FAILED');
    expect(String(error)).not.toContain('should-not-leak');
  });
});
