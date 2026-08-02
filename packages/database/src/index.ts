import { Client, type ClientConfig } from 'pg';

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
