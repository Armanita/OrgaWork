import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';

import type { PostgreSqlAccess, PostgreSqlQueryExecutor, PostgreSqlTransaction } from './index.js';
import {
  VersionedMigrationError,
  loadVersionedMigrations,
  runVersionedMigrations,
  type VersionedMigration,
} from './migrations.js';

function createQueryResult<Row extends QueryResultRow>(): QueryResult<Row> {
  return {
    command: 'SELECT',
    rowCount: 0,
    oid: 0,
    rows: [],
    fields: [],
  };
}

async function withTemporaryDirectory<Result>(
  operation: (directory: string) => Promise<Result>,
): Promise<Result> {
  const directory = await mkdtemp(join(tmpdir(), 'orgawork-p152-'));

  try {
    return await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

class FakePostgreSqlAccess implements PostgreSqlAccess {
  public readonly queries: string[] = [];
  public transactionCalls = 0;
  public closeCalls = 0;
  public failingSql: string | undefined;

  public query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
  ): Promise<QueryResult<Row>> {
    this.queries.push(text);
    return Promise.resolve(createQueryResult<Row>());
  }

  public transaction<Result>(
    operation: (transaction: PostgreSqlTransaction) => Promise<Result>,
  ): Promise<Result> {
    this.transactionCalls += 1;

    const executor: PostgreSqlQueryExecutor = {
      query: <Row extends QueryResultRow = QueryResultRow>(
        text: string,
      ): Promise<QueryResult<Row>> => {
        this.queries.push(text);

        if (this.failingSql === text) {
          return Promise.reject(new Error('database-secret raw migration failure'));
        }

        return Promise.resolve(createQueryResult<Row>());
      },
    };

    return operation(executor);
  }

  public close(): Promise<void> {
    this.closeCalls += 1;
    return Promise.resolve();
  }
}

function createMigration(version: number, name: string, sql: string): VersionedMigration {
  const fileName = String(version).padStart(4, '0') + '_' + name + '.sql';

  return {
    version,
    name,
    fileName,
    absolutePath: '/virtual/' + fileName,
    sql,
  };
}

describe('versioned migration runner', () => {
  it('loads SQL files in deterministic version order and ignores unrelated files', async () => {
    await withTemporaryDirectory(async (directory) => {
      await writeFile(join(directory, '0002_second.sql'), 'SELECT 2;', 'utf8');
      await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;', 'utf8');
      await writeFile(join(directory, '.gitkeep'), '', 'utf8');

      const migrations = await loadVersionedMigrations(directory);

      expect(migrations.map((migration) => migration.version)).toEqual([1, 2]);
      expect(migrations.map((migration) => migration.name)).toEqual(['first', 'second']);
    });
  });

  it('rejects an invalid SQL migration file name with a stable error', async () => {
    await withTemporaryDirectory(async (directory) => {
      await writeFile(join(directory, 'first.sql'), 'SELECT 1;', 'utf8');

      await expect(loadVersionedMigrations(directory)).rejects.toMatchObject({
        code: 'INVALID_MIGRATION_FILE_NAME',
        fileName: 'first.sql',
      });
    });
  });

  it('rejects duplicate migration versions before execution', async () => {
    await withTemporaryDirectory(async (directory) => {
      await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;', 'utf8');
      await writeFile(join(directory, '0001_second.sql'), 'SELECT 2;', 'utf8');

      await expect(loadVersionedMigrations(directory)).rejects.toMatchObject({
        code: 'DUPLICATE_MIGRATION_VERSION',
        version: 1,
      });
    });
  });

  it('rejects empty migration SQL', async () => {
    await withTemporaryDirectory(async (directory) => {
      await writeFile(join(directory, '0001_empty.sql'), '   \n', 'utf8');

      await expect(loadVersionedMigrations(directory)).rejects.toMatchObject({
        code: 'EMPTY_MIGRATION_SQL',
        version: 1,
      });
    });
  });

  it('executes pending migrations once in ascending order inside one transaction', async () => {
    const access = new FakePostgreSqlAccess();
    const migrations = [
      createMigration(3, 'third', 'SELECT 3;'),
      createMigration(1, 'first', 'SELECT 1;'),
      createMigration(2, 'second', 'SELECT 2;'),
    ];

    const result = await runVersionedMigrations(access, migrations, new Set([1]));

    expect(access.transactionCalls).toBe(1);
    expect(access.queries).toEqual(['SELECT 2;', 'SELECT 3;']);
    expect(result).toEqual({
      discoveredVersions: [1, 2, 3],
      appliedVersions: [2, 3],
      skippedVersions: [1],
    });
  });

  it('does not open a transaction when every discovered migration is already applied', async () => {
    const access = new FakePostgreSqlAccess();
    const migrations = [
      createMigration(1, 'first', 'SELECT 1;'),
      createMigration(2, 'second', 'SELECT 2;'),
    ];

    const result = await runVersionedMigrations(access, migrations, new Set([1, 2]));

    expect(access.transactionCalls).toBe(0);
    expect(access.queries).toEqual([]);
    expect(result.appliedVersions).toEqual([]);
    expect(result.skippedVersions).toEqual([1, 2]);
  });

  it('rejects invalid applied versions before opening a transaction', async () => {
    const access = new FakePostgreSqlAccess();
    const migrations = [createMigration(1, 'first', 'SELECT 1;')];

    await expect(runVersionedMigrations(access, migrations, new Set([0]))).rejects.toMatchObject({
      code: 'INVALID_APPLIED_VERSION',
      version: 0,
    });
    expect(access.transactionCalls).toBe(0);
  });

  it('replaces raw execution failures with a stable secret-free migration error', async () => {
    const access = new FakePostgreSqlAccess();
    access.failingSql = 'SELECT broken;';
    const migrations = [createMigration(7, 'broken', 'SELECT broken;')];

    let capturedError: unknown;

    try {
      await runVersionedMigrations(access, migrations);
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(VersionedMigrationError);
    expect(capturedError).toMatchObject({
      code: 'MIGRATION_EXECUTION_FAILED',
      fileName: '0007_broken.sql',
      version: 7,
    });
    expect((capturedError as Error).message).not.toContain('database-secret');
  });
});
