import {
  Client,
  Pool,
  type ClientConfig,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

export interface PostgreSqlConnectivityConfiguration {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

export interface PostgreSqlConnectivityResult {
  readonly service: 'postgresql';
  readonly status: 'connected';
  readonly operation: 'SELECT 1';
  readonly value: 1;
}

export type PostgreSqlAccessErrorCode =
  'ACCESS_CLOSED' | 'QUERY_FAILED' | 'TRANSACTION_FAILED' | 'CLOSE_FAILED';

export class PostgreSqlAccessError extends Error {
  public readonly code: PostgreSqlAccessErrorCode;

  public constructor(code: PostgreSqlAccessErrorCode, message: string) {
    super(message);
    this.name = 'PostgreSqlAccessError';
    this.code = code;
  }
}

const accessErrorMessages: Readonly<Record<PostgreSqlAccessErrorCode, string>> = {
  ACCESS_CLOSED: 'دسترسی مشترک PostgreSQL بسته شده است.',
  QUERY_FAILED: 'اجرای پرس‌وجوی PostgreSQL ناموفق بود.',
  TRANSACTION_FAILED: 'اجرای تراکنش PostgreSQL ناموفق بود.',
  CLOSE_FAILED: 'بستن Pool مشترک PostgreSQL ناموفق بود.',
};

function createAccessError(code: PostgreSqlAccessErrorCode): PostgreSqlAccessError {
  return new PostgreSqlAccessError(code, accessErrorMessages[code]);
}

export interface PostgreSqlAccessOptions {
  readonly applicationName?: string;
  readonly maximumConnections?: number;
  readonly idleTimeoutMilliseconds?: number;
  readonly connectionTimeoutMilliseconds?: number;
  readonly statementTimeoutMilliseconds?: number;
  readonly queryTimeoutMilliseconds?: number;
}

export interface PostgreSqlQueryExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export type PostgreSqlTransaction = PostgreSqlQueryExecutor;

export interface PostgreSqlPoolClientAdapter extends PostgreSqlQueryExecutor {
  release(): void;
}

export interface PostgreSqlPoolAdapter extends PostgreSqlQueryExecutor {
  connect(): Promise<PostgreSqlPoolClientAdapter>;
  end(): Promise<void>;
}

export interface PostgreSqlAccessDependencies {
  createPool(configuration: PoolConfig): PostgreSqlPoolAdapter;
}

export interface PostgreSqlAccess extends PostgreSqlQueryExecutor {
  transaction<Result>(
    operation: (transaction: PostgreSqlTransaction) => Promise<Result>,
  ): Promise<Result>;
  close(): Promise<void>;
}

function readPositiveInteger(
  value: number | undefined,
  fallback: number,
  label: string,
  maximum?: number,
): number {
  const resolved = value ?? fallback;

  if (
    !Number.isInteger(resolved) ||
    resolved < 1 ||
    (maximum !== undefined && resolved > maximum)
  ) {
    throw new RangeError('مقدار ' + label + ' معتبر نیست.');
  }

  return resolved;
}

function readApplicationName(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized === undefined || normalized === '' ? 'orgawork-shared-database' : normalized;
}

export function buildPostgreSqlPoolConfiguration(
  configuration: PostgreSqlConnectivityConfiguration,
  options: PostgreSqlAccessOptions = {},
): PoolConfig {
  return {
    host: configuration.host,
    port: configuration.port,
    database: configuration.database,
    user: configuration.user,
    password: configuration.password,
    application_name: readApplicationName(options.applicationName),
    max: readPositiveInteger(options.maximumConnections, 10, 'maximumConnections', 100),
    idleTimeoutMillis: readPositiveInteger(
      options.idleTimeoutMilliseconds,
      30_000,
      'idleTimeoutMilliseconds',
    ),
    connectionTimeoutMillis: readPositiveInteger(
      options.connectionTimeoutMilliseconds,
      5_000,
      'connectionTimeoutMilliseconds',
    ),
    statement_timeout: readPositiveInteger(
      options.statementTimeoutMilliseconds,
      15_000,
      'statementTimeoutMilliseconds',
    ),
    query_timeout: readPositiveInteger(
      options.queryTimeoutMilliseconds,
      15_000,
      'queryTimeoutMilliseconds',
    ),
    allowExitOnIdle: false,
  };
}

function copyQueryValues(values: readonly unknown[] | undefined): unknown[] | undefined {
  return values === undefined ? undefined : [...values];
}

function createDefaultPool(configuration: PoolConfig): PostgreSqlPoolAdapter {
  const pool = new Pool(configuration);

  return {
    query: async <Row extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<Row>> => pool.query<Row>(text, copyQueryValues(values)),
    connect: async (): Promise<PostgreSqlPoolClientAdapter> => {
      const client = await pool.connect();

      return {
        query: async <Row extends QueryResultRow = QueryResultRow>(
          text: string,
          values?: readonly unknown[],
        ): Promise<QueryResult<Row>> => client.query<Row>(text, copyQueryValues(values)),
        release: (): void => client.release(),
      };
    },
    end: async (): Promise<void> => pool.end(),
  };
}

const defaultAccessDependencies: PostgreSqlAccessDependencies = {
  createPool: createDefaultPool,
};

async function executeSafeQuery<Row extends QueryResultRow = QueryResultRow>(
  executor: PostgreSqlQueryExecutor,
  text: string,
  values?: readonly unknown[],
): Promise<QueryResult<Row>> {
  try {
    return await executor.query<Row>(text, values);
  } catch {
    throw createAccessError('QUERY_FAILED');
  }
}

async function rollbackQuietly(client: PostgreSqlPoolClientAdapter): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    return;
  }
}

export function createPostgreSqlAccess(
  configuration: PostgreSqlConnectivityConfiguration,
  options: PostgreSqlAccessOptions = {},
  dependencies: PostgreSqlAccessDependencies = defaultAccessDependencies,
): PostgreSqlAccess {
  const pool = dependencies.createPool(buildPostgreSqlPoolConfiguration(configuration, options));
  let state: 'open' | 'closing' | 'closed' = 'open';
  let closePromise: Promise<void> | undefined;

  const assertOpen = (): void => {
    if (state !== 'open') {
      throw createAccessError('ACCESS_CLOSED');
    }
  };

  return {
    query: async <Row extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<Row>> => {
      assertOpen();
      return executeSafeQuery<Row>(pool, text, values);
    },
    transaction: async <Result>(
      operation: (transaction: PostgreSqlTransaction) => Promise<Result>,
    ): Promise<Result> => {
      assertOpen();
      let client: PostgreSqlPoolClientAdapter;

      try {
        client = await pool.connect();
      } catch {
        throw createAccessError('TRANSACTION_FAILED');
      }

      let transactionStarted = false;

      try {
        await client.query('BEGIN');
        transactionStarted = true;

        const transaction: PostgreSqlTransaction = {
          query: async <Row extends QueryResultRow = QueryResultRow>(
            text: string,
            values?: readonly unknown[],
          ): Promise<QueryResult<Row>> => executeSafeQuery<Row>(client, text, values),
        };

        const result = await operation(transaction);
        await client.query('COMMIT');
        transactionStarted = false;
        return result;
      } catch {
        if (transactionStarted) {
          await rollbackQuietly(client);
        }

        throw createAccessError('TRANSACTION_FAILED');
      } finally {
        client.release();
      }
    },
    close: async (): Promise<void> => {
      if (closePromise !== undefined) {
        return closePromise;
      }

      state = 'closing';
      closePromise = (async (): Promise<void> => {
        try {
          await pool.end();
        } catch {
          throw createAccessError('CLOSE_FAILED');
        } finally {
          state = 'closed';
        }
      })();

      return closePromise;
    },
  };
}

export async function probePostgreSqlConnectivity(
  configuration: PostgreSqlConnectivityConfiguration,
): Promise<PostgreSqlConnectivityResult> {
  const clientConfiguration: ClientConfig = {
    host: configuration.host,
    port: configuration.port,
    database: configuration.database,
    user: configuration.user,
    password: configuration.password,
    application_name: 'orgawork-connectivity-probe',
    connectionTimeoutMillis: 5_000,
    query_timeout: 5_000,
    statement_timeout: 5_000,
  };

  const client = new Client(clientConfiguration);
  await client.connect();

  try {
    const result = await client.query<{ readonly value: number }>('SELECT 1::int AS value');
    const value = result.rows[0]?.value;

    if (result.rowCount !== 1 || value !== 1) {
      throw new Error('پاسخ Probe خواندنی PostgreSQL معتبر نیست.');
    }

    return {
      service: 'postgresql',
      status: 'connected',
      operation: 'SELECT 1',
      value: 1,
    };
  } finally {
    await client.end();
  }
}

export * from './migrations.js';

export * from './migration-history.js';
