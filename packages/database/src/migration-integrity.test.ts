import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';

import type { PostgreSqlQueryExecutor } from './index.js';
import { inspectMigrationIntegrity, MigrationIntegrityError } from './migration-integrity.js';
import { computeVersionedMigrationFingerprint } from './migration-history.js';
import type { VersionedMigration } from './migrations.js';

interface HistoryRow extends QueryResultRow {
  readonly version: number;
  readonly name: string;
  readonly file_name: string;
  readonly fingerprint: string;
  readonly applied_order: string;
  readonly applied_at: string;
}

function migration(version: number, name: string, sql: string): VersionedMigration {
  const fileName = `${String(version).padStart(4, '0')}_${name}.sql`;

  return {
    version,
    name,
    fileName,
    absolutePath: `/migrations/${fileName}`,
    sql,
  };
}

function historyRow(
  item: VersionedMigration,
  order: number,
  overrides: Partial<HistoryRow> = {},
): HistoryRow {
  return {
    version: item.version,
    name: item.name,
    file_name: item.fileName,
    fingerprint: computeVersionedMigrationFingerprint(item),
    applied_order: String(order),
    applied_at: '2026-08-02T00:00:00.000Z',
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

function executor(
  rows: readonly HistoryRow[],
  failure: Error | undefined = undefined,
): PostgreSqlQueryExecutor {
  return {
    query: <Row extends QueryResultRow = QueryResultRow>(): Promise<QueryResult<Row>> => {
      if (failure !== undefined) {
        return Promise.reject(failure);
      }

      return Promise.resolve(queryResult(rows) as unknown as QueryResult<Row>);
    },
  };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }

  throw new Error('انتظار می‌رفت بررسی یکپارچگی با خطا متوقف شود.');
}

function expectIntegrityError(
  error: unknown,
  code: MigrationIntegrityError['code'],
  version?: number,
): void {
  expect(error).toBeInstanceOf(MigrationIntegrityError);
  expect(error).toMatchObject({ code, version });
  expect(error).not.toHaveProperty('cause');
}

describe('migration integrity and drift detection', () => {
  const first = migration(1, 'create-history', 'CREATE TABLE history ();');
  const second = migration(2, 'create-roles', 'CREATE ROLE runtime;');

  it('accepts an exact ordered migration history', async () => {
    const result = await inspectMigrationIntegrity(
      executor([historyRow(first, 1), historyRow(second, 2)]),
      [second, first],
    );

    expect(result).toEqual({
      migrationCount: 2,
      historyCount: 2,
      versions: [1, 2],
      fingerprints: [
        computeVersionedMigrationFingerprint(first),
        computeVersionedMigrationFingerprint(second),
      ],
    });
  });

  it('rejects a missing or extra history record', async () => {
    const error = await captureError(
      inspectMigrationIntegrity(executor([historyRow(first, 1)]), [first, second]),
    );

    expectIntegrityError(error, 'MIGRATION_HISTORY_COUNT_MISMATCH');
  });

  it('rejects a changed migration version or order', async () => {
    const error = await captureError(
      inspectMigrationIntegrity(
        executor([historyRow(first, 1), historyRow(second, 2, { version: 3 })]),
        [first, second],
      ),
    );

    expectIntegrityError(error, 'MIGRATION_HISTORY_ORDER_MISMATCH', 2);
  });

  it('rejects a changed migration file name', async () => {
    const error = await captureError(
      inspectMigrationIntegrity(
        executor([historyRow(first, 1), historyRow(second, 2, { file_name: '0002_changed.sql' })]),
        [first, second],
      ),
    );

    expectIntegrityError(error, 'MIGRATION_HISTORY_ORDER_MISMATCH', 2);
  });

  it('rejects a changed migration fingerprint', async () => {
    const error = await captureError(
      inspectMigrationIntegrity(
        executor([historyRow(first, 1), historyRow(second, 2, { fingerprint: 'a'.repeat(64) })]),
        [first, second],
      ),
    );

    expectIntegrityError(error, 'MIGRATION_HISTORY_FINGERPRINT_MISMATCH', 2);
  });

  it('rejects duplicate or malformed migrations before querying history', async () => {
    let queryCount = 0;
    const fake: PostgreSqlQueryExecutor = {
      query: <Row extends QueryResultRow = QueryResultRow>(): Promise<QueryResult<Row>> => {
        queryCount += 1;
        return Promise.resolve(queryResult([]) as unknown as QueryResult<Row>);
      },
    };
    const error = await captureError(inspectMigrationIntegrity(fake, [first, first]));

    expectIntegrityError(error, 'MIGRATION_SET_INVALID', 1);
    expect(queryCount).toBe(0);
  });

  it('keeps repeated exact integrity checks deterministic', async () => {
    const fake = executor([historyRow(first, 1), historyRow(second, 2)]);
    const firstResult = await inspectMigrationIntegrity(fake, [first, second]);
    const secondResult = await inspectMigrationIntegrity(fake, [first, second]);

    expect(secondResult).toEqual(firstResult);
  });

  it('replaces raw history failures with a secret-free stable error', async () => {
    const error = await captureError(
      inspectMigrationIntegrity(executor([], new Error('password=must-not-leak')), [first]),
    );

    expectIntegrityError(error, 'MIGRATION_INTEGRITY_UNAVAILABLE');
    expect(String(error)).not.toContain('must-not-leak');
  });
});
