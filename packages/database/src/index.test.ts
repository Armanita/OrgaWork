import { describe, expect, it } from 'vitest';
import type { PoolConfig, QueryResult, QueryResultRow } from 'pg';

import {
  PostgreSqlAccessError,
  buildPostgreSqlPoolConfiguration,
  createPostgreSqlAccess,
  type PostgreSqlConnectivityConfiguration,
  type PostgreSqlPoolAdapter,
  type PostgreSqlPoolClientAdapter,
} from './index.js';

const configuration: PostgreSqlConnectivityConfiguration = {
  host: '127.0.0.1',
  port: 5432,
  database: 'orgawork',
  user: 'orgawork',
  password: 'database-secret',
};

function createResult<Row extends QueryResultRow>(rows: readonly Row[] = []): QueryResult<Row> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    rows: [...rows],
    fields: [],
  };
}

class FakeClient implements PostgreSqlPoolClientAdapter {
  public readonly calls: Array<{
    readonly text: string;
    readonly values: readonly unknown[] | undefined;
  }> = [];

  public failText: string | undefined;
  public releaseCalls = 0;

  public query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, values });

    if (this.failText === text) {
      return Promise.reject(new Error('database-secret raw client failure'));
    }

    return Promise.resolve(createResult<Row>());
  }

  public release(): void {
    this.releaseCalls += 1;
  }
}

class FakePool implements PostgreSqlPoolAdapter {
  public readonly calls: Array<{
    readonly text: string;
    readonly values: readonly unknown[] | undefined;
  }> = [];

  public readonly client = new FakeClient();
  public rows: readonly QueryResultRow[] = [];
  public queryFails = false;
  public connectFails = false;
  public endFails = false;
  public endCalls = 0;

  public query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, values });

    if (this.queryFails) {
      return Promise.reject(new Error('database-secret raw pool failure'));
    }

    return Promise.resolve(createResult<Row>(this.rows as readonly Row[]));
  }

  public connect(): Promise<PostgreSqlPoolClientAdapter> {
    return this.connectFails
      ? Promise.reject(new Error('database-secret raw connection failure'))
      : Promise.resolve(this.client);
  }

  public end(): Promise<void> {
    this.endCalls += 1;

    return this.endFails
      ? Promise.reject(new Error('database-secret raw close failure'))
      : Promise.resolve();
  }
}

function createAccessWithPool(
  pool: PostgreSqlPoolAdapter,
  options: Parameters<typeof createPostgreSqlAccess>[1] = {},
): {
  readonly access: ReturnType<typeof createPostgreSqlAccess>;
  readonly poolConfiguration: () => PoolConfig;
} {
  let capturedConfiguration: PoolConfig | undefined;

  const access = createPostgreSqlAccess(configuration, options, {
    createPool: (poolConfiguration): PostgreSqlPoolAdapter => {
      capturedConfiguration = poolConfiguration;
      return pool;
    },
  });

  return {
    access,
    poolConfiguration: (): PoolConfig => {
      if (capturedConfiguration === undefined) {
        throw new Error('تنظیمات Pool ثبت نشده است.');
      }

      return capturedConfiguration;
    },
  };
}

async function captureAccessError(
  operation: () => Promise<unknown>,
): Promise<PostgreSqlAccessError> {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(PostgreSqlAccessError);
    return error as PostgreSqlAccessError;
  }

  throw new Error('انتظار می‌رفت عملیات ناموفق باشد.');
}

describe('shared PostgreSQL access', () => {
  it('builds a bounded pool configuration with safe defaults', () => {
    const poolConfiguration = buildPostgreSqlPoolConfiguration(configuration);

    expect(poolConfiguration).toMatchObject({
      host: '127.0.0.1',
      port: 5432,
      database: 'orgawork',
      user: 'orgawork',
      password: 'database-secret',
      application_name: 'orgawork-shared-database',
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
      query_timeout: 15_000,
      allowExitOnIdle: false,
    });
  });

  it('applies explicit pool options and rejects invalid connection limits', () => {
    const poolConfiguration = buildPostgreSqlPoolConfiguration(configuration, {
      applicationName: 'orgawork-api',
      maximumConnections: 4,
      idleTimeoutMilliseconds: 20_000,
      connectionTimeoutMilliseconds: 4_000,
      statementTimeoutMilliseconds: 12_000,
      queryTimeoutMilliseconds: 13_000,
    });

    expect(poolConfiguration).toMatchObject({
      application_name: 'orgawork-api',
      max: 4,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 4_000,
      statement_timeout: 12_000,
      query_timeout: 13_000,
    });
    expect(() =>
      buildPostgreSqlPoolConfiguration(configuration, {
        maximumConnections: 0,
      }),
    ).toThrow(RangeError);
  });

  it('executes parameterized queries through one shared pool', async () => {
    const pool = new FakePool();
    pool.rows = [{ value: 7 }];
    const { access, poolConfiguration } = createAccessWithPool(pool, {
      maximumConnections: 3,
    });

    const result = await access.query<{ readonly value: number }>('SELECT $1::int AS value', [7]);

    expect(result.rows).toEqual([{ value: 7 }]);
    expect(pool.calls).toEqual([
      {
        text: 'SELECT $1::int AS value',
        values: [7],
      },
    ]);
    expect(poolConfiguration().max).toBe(3);
  });

  it('replaces raw query failures with a stable secret-free error', async () => {
    const pool = new FakePool();
    pool.queryFails = true;
    const { access } = createAccessWithPool(pool);

    const error = await captureAccessError(() => access.query('SELECT current_user'));

    expect(error.code).toBe('QUERY_FAILED');
    expect(error.message).toBe('اجرای پرس‌وجوی PostgreSQL ناموفق بود.');
    expect(error.message).not.toContain('database-secret');
  });

  it('commits successful transactions and releases the client', async () => {
    const pool = new FakePool();
    const { access } = createAccessWithPool(pool);

    const value = await access.transaction(async (transaction) => {
      await transaction.query('INSERT INTO sample(id) VALUES ($1)', [1]);
      return 'committed';
    });

    expect(value).toBe('committed');
    expect(pool.client.calls.map((call) => call.text)).toEqual([
      'BEGIN',
      'INSERT INTO sample(id) VALUES ($1)',
      'COMMIT',
    ]);
    expect(pool.client.releaseCalls).toBe(1);
  });

  it('rolls back failed transactions and exposes only a stable error', async () => {
    const pool = new FakePool();
    pool.client.failText = 'UPDATE sample SET value = $1';
    const { access } = createAccessWithPool(pool);

    const error = await captureAccessError(() =>
      access.transaction(async (transaction) => {
        await transaction.query('UPDATE sample SET value = $1', [2]);
      }),
    );

    expect(error.code).toBe('TRANSACTION_FAILED');
    expect(error.message).not.toContain('database-secret');
    expect(pool.client.calls.map((call) => call.text)).toEqual([
      'BEGIN',
      'UPDATE sample SET value = $1',
      'ROLLBACK',
    ]);
    expect(pool.client.releaseCalls).toBe(1);
  });

  it('closes the shared pool once and rejects later operations', async () => {
    const pool = new FakePool();
    const { access } = createAccessWithPool(pool);

    await Promise.all([access.close(), access.close()]);

    expect(pool.endCalls).toBe(1);
    const error = await captureAccessError(() => access.query('SELECT 1'));
    expect(error.code).toBe('ACCESS_CLOSED');
  });

  it('keeps close failures stable and idempotent', async () => {
    const pool = new FakePool();
    pool.endFails = true;
    const { access } = createAccessWithPool(pool);

    const firstError = await captureAccessError(() => access.close());
    const secondError = await captureAccessError(() => access.close());

    expect(firstError.code).toBe('CLOSE_FAILED');
    expect(secondError.code).toBe('CLOSE_FAILED');
    expect(firstError.message).not.toContain('database-secret');
    expect(pool.endCalls).toBe(1);
  });
});
