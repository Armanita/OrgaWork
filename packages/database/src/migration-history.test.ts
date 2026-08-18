import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';

import type { PostgreSqlAccess, PostgreSqlQueryExecutor } from './index.js';
import {
  MigrationHistoryError,
  computeVersionedMigrationFingerprint,
  runTrackedVersionedMigrations,
} from './migration-history.js';
import type { VersionedMigration } from './migrations.js';

interface FakeHistoryRow extends QueryResultRow {
  readonly version: number;
  readonly name: string;
  readonly file_name: string;
  readonly fingerprint: string;
  readonly applied_order: string;
  readonly applied_at: Date | string;
}

function createResult<Row extends QueryResultRow>(
  rows: readonly Row[],
  command = 'SELECT',
): QueryResult<Row> {
  return {
    command,
    rowCount: rows.length,
    oid: 0,
    rows: [...rows],
    fields: [],
  };
}

function createMigration(version: number, name: string, sql: string): VersionedMigration {
  const fileName = String(version).padStart(4, '0') + '_' + name + '.sql';

  return {
    version,
    name,
    fileName,
    absolutePath: 'C:/migrations/' + fileName,
    sql,
  };
}

class FakeAccess implements PostgreSqlAccess {
  public tableExists = false;
  public readonly historyRows: FakeHistoryRow[] = [];
  public readonly transactionCalls: Array<{
    readonly text: string;
    readonly values: readonly unknown[] | undefined;
  }> = [];
  public transactionCount = 0;
  public failText: string | undefined;

  public query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
  ): Promise<QueryResult<Row>> {
    if (text.includes('to_regclass')) {
      return Promise.resolve(
        createResult([{ exists: this.tableExists }]) as unknown as QueryResult<Row>,
      );
    }

    if (text.includes('FROM public.orgawork_migration_history')) {
      const rows = [...this.historyRows];

      if (text.includes('ORDER BY history.applied_order ASC')) {
        rows.sort((left, right) => Number(left.applied_order) - Number(right.applied_order));
      } else if (text.includes('ORDER BY applied_order ASC')) {
        rows.sort((left, right) => left.applied_order.localeCompare(right.applied_order));
      }

      return Promise.resolve(createResult(rows) as unknown as QueryResult<Row>);
    }

    return Promise.reject(new Error('database-secret unexpected access query'));
  }

  public transaction<Result>(
    operation: (transaction: PostgreSqlQueryExecutor) => Promise<Result>,
  ): Promise<Result> {
    this.transactionCount += 1;

    const transaction: PostgreSqlQueryExecutor = {
      query: <Row extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: readonly unknown[],
      ): Promise<QueryResult<Row>> => {
        this.transactionCalls.push({ text, values });

        if (this.failText === text) {
          return Promise.reject(new Error('database-secret raw transaction failure'));
        }

        if (text.includes('CREATE TABLE')) {
          this.tableExists = true;
        }

        if (text.includes('INSERT INTO public.orgawork_migration_history')) {
          const version = values?.[0];
          const name = values?.[1];
          const fileName = values?.[2];
          const fingerprint = values?.[3];

          if (
            typeof version !== 'number' ||
            typeof name !== 'string' ||
            typeof fileName !== 'string' ||
            typeof fingerprint !== 'string'
          ) {
            return Promise.reject(new Error('invalid fake insert values'));
          }

          this.historyRows.push({
            version,
            name,
            file_name: fileName,
            fingerprint,
            applied_order: String(this.historyRows.length + 1),
            applied_at: new Date('2026-08-02T00:00:00.000Z'),
          });
        }

        return Promise.resolve(createResult<Row>([], 'EXECUTE'));
      },
    };

    return operation(transaction);
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }
}

async function captureHistoryError(
  operation: () => Promise<unknown>,
): Promise<MigrationHistoryError> {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(MigrationHistoryError);
    return error as MigrationHistoryError;
  }

  throw new Error('انتظار می‌رفت عملیات با خطای تاریخچه Migration متوقف شود.');
}

function seedHistory(
  access: FakeAccess,
  migration: VersionedMigration,
  appliedOrder: number,
  fingerprint = computeVersionedMigrationFingerprint(migration),
): void {
  access.tableExists = true;
  access.historyRows.push({
    version: migration.version,
    name: migration.name,
    file_name: migration.fileName,
    fingerprint,
    applied_order: String(appliedOrder),
    applied_at: new Date('2026-08-02T00:00:00.000Z'),
  });
}

describe('persistent migration history', () => {
  it('computes a deterministic lowercase SHA-256 fingerprint', () => {
    const migration = createMigration(1, 'sample', 'SELECT 1;');

    expect(computeVersionedMigrationFingerprint(migration)).toBe(
      '17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a',
    );
  });

  it('bootstraps the official history migration and records every applied version', async () => {
    const access = new FakeAccess();
    const first = createMigration(
      1,
      'create-migration-history',
      'CREATE TABLE public.orgawork_migration_history ();',
    );
    const second = createMigration(2, 'create-sample', 'CREATE TABLE sample ();');

    const result = await runTrackedVersionedMigrations(access, [second, first]);

    expect(result.appliedVersions).toEqual([1, 2]);
    expect(result.skippedVersions).toEqual([]);
    expect(result.historyTable).toBe('orgawork_migration_history');
    expect(result.fingerprints).toHaveLength(2);
    expect(access.transactionCount).toBe(1);
    expect(access.historyRows.map((row) => row.version)).toEqual([1, 2]);
  });

  it('skips every migration after the exact persistent history is recorded', async () => {
    const access = new FakeAccess();
    const migrations = [
      createMigration(
        1,
        'create-migration-history',
        'CREATE TABLE public.orgawork_migration_history ();',
      ),
      createMigration(2, 'create-sample', 'CREATE TABLE sample ();'),
    ];

    await runTrackedVersionedMigrations(access, migrations);
    const secondRun = await runTrackedVersionedMigrations(access, migrations);

    expect(secondRun.appliedVersions).toEqual([]);
    expect(secondRun.skippedVersions).toEqual([1, 2]);
    expect(access.transactionCount).toBe(1);
  });

  it('keeps persistent history numerically ordered after migration version 9', async () => {
    const access = new FakeAccess();
    const migrations = Array.from({ length: 10 }, (_, index) => {
      const version = index + 1;

      return version === 1
        ? createMigration(
            1,
            'create-migration-history',
            'CREATE TABLE public.orgawork_migration_history ();',
          )
        : createMigration(version, `migration-${version}`, `SELECT ${version};`);
    });

    const firstRun = await runTrackedVersionedMigrations(access, migrations);
    const secondRun = await runTrackedVersionedMigrations(access, migrations);

    expect(firstRun.appliedVersions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(secondRun.appliedVersions).toEqual([]);
    expect(secondRun.skippedVersions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(access.transactionCount).toBe(1);
  });

  it('applies only the suffix after an exact ordered history prefix', async () => {
    const access = new FakeAccess();
    const first = createMigration(1, 'first', 'SELECT 1;');
    const second = createMigration(2, 'second', 'SELECT 2;');
    seedHistory(access, first, 7);

    const result = await runTrackedVersionedMigrations(access, [second, first]);

    expect(result.appliedVersions).toEqual([2]);
    expect(result.skippedVersions).toEqual([1]);
    expect(
      access.transactionCalls
        .filter((call) => !call.text.includes('INSERT INTO'))
        .map((call) => call.text),
    ).toEqual(['SELECT 2;']);
  });

  it('rejects a changed fingerprint before any migration SQL executes', async () => {
    const access = new FakeAccess();
    const migration = createMigration(1, 'sample', 'SELECT 1;');
    seedHistory(access, migration, 1, '0'.repeat(64));

    const error = await captureHistoryError(() =>
      runTrackedVersionedMigrations(access, [migration]),
    );

    expect(error.code).toBe('MIGRATION_HISTORY_FINGERPRINT_MISMATCH');
    expect(error.version).toBe(1);
    expect(access.transactionCount).toBe(0);
  });

  it('rejects history that is not an exact prefix of discovered versions', async () => {
    const access = new FakeAccess();
    const first = createMigration(1, 'first', 'SELECT 1;');
    const second = createMigration(2, 'second', 'SELECT 2;');
    seedHistory(access, second, 1);

    const error = await captureHistoryError(() =>
      runTrackedVersionedMigrations(access, [first, second]),
    );

    expect(error.code).toBe('MIGRATION_HISTORY_ORDER_MISMATCH');
    expect(access.transactionCount).toBe(0);
  });

  it('rejects malformed persistent history records', async () => {
    const access = new FakeAccess();
    const migration = createMigration(1, 'sample', 'SELECT 1;');
    seedHistory(access, migration, 1, 'not-a-sha256');

    const error = await captureHistoryError(() =>
      runTrackedVersionedMigrations(access, [migration]),
    );

    expect(error.code).toBe('INVALID_MIGRATION_HISTORY');
    expect(access.transactionCount).toBe(0);
  });

  it('replaces raw execution failures with a stable secret-free error', async () => {
    const access = new FakeAccess();
    const bootstrap = createMigration(
      1,
      'create-migration-history',
      'CREATE TABLE public.orgawork_migration_history ();',
    );
    const failingSql = 'SELECT database_secret_failure();';
    access.failText = failingSql;

    const error = await captureHistoryError(() =>
      runTrackedVersionedMigrations(access, [bootstrap, createMigration(2, 'failure', failingSql)]),
    );

    expect(error.code).toBe('MIGRATION_HISTORY_EXECUTION_FAILED');
    expect(error.message).not.toContain('database_secret_failure');
    expect(error.message).not.toContain('database-secret');
  });
});
