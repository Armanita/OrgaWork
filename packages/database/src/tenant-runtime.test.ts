import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';

import type { PostgreSqlAccess, PostgreSqlQueryExecutor, PostgreSqlTransaction } from './index.js';
import {
  TenantRuntimeError,
  normalizeOrganizationId,
  readCurrentOrganizationId,
  withOrganizationTransaction,
} from './tenant-runtime.js';

interface RecordedQuery {
  readonly text: string;
  readonly values: readonly unknown[] | undefined;
}

interface CurrentOrganizationRow extends QueryResultRow {
  readonly organization_id: string | null;
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

function createAccess(
  currentOrganizationId: string | null,
  transactionFailure: Error | undefined = undefined,
): {
  readonly access: PostgreSqlAccess;
  readonly calls: RecordedQuery[];
  readonly transactionExecutors: PostgreSqlQueryExecutor[];
} {
  const calls: RecordedQuery[] = [];
  const transactionExecutors: PostgreSqlQueryExecutor[] = [];

  const transactionExecutor: PostgreSqlQueryExecutor = {
    query: <Row extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<Row>> => {
      calls.push({ text, values });

      if (text.includes("current_setting('orgawork.organization_id'")) {
        return Promise.resolve(
          queryResult<CurrentOrganizationRow>([
            { organization_id: currentOrganizationId },
          ]) as unknown as QueryResult<Row>,
        );
      }

      return Promise.resolve(queryResult<QueryResultRow>([]) as unknown as QueryResult<Row>);
    },
  };

  return {
    calls,
    transactionExecutors,
    access: {
      query: <Row extends QueryResultRow = QueryResultRow>(): Promise<QueryResult<Row>> =>
        Promise.resolve(queryResult<QueryResultRow>([]) as unknown as QueryResult<Row>),
      transaction: <Result>(
        operation: (transaction: PostgreSqlTransaction) => Promise<Result>,
      ): Promise<Result> => {
        if (transactionFailure !== undefined) {
          return Promise.reject(transactionFailure);
        }

        transactionExecutors.push(transactionExecutor);
        return operation(transactionExecutor);
      },
      close: (): Promise<void> => Promise.resolve(),
    },
  };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }

  throw new Error('انتظار می‌رفت قرارداد زمینه سازمان با خطا متوقف شود.');
}

describe('tenant runtime transaction contract', () => {
  it('normalizes a valid organization UUID', () => {
    expect(normalizeOrganizationId(' 123E4567-E89B-42D3-A456-426614174000 ')).toBe(
      '123e4567-e89b-42d3-a456-426614174000',
    );
  });

  it('rejects an invalid organization identifier before opening a transaction', async () => {
    const fake = createAccess(null);
    const error = await captureError(
      withOrganizationTransaction(fake.access, 'not-an-organization-id', () =>
        Promise.resolve(undefined),
      ),
    );

    expect(error).toBeInstanceOf(TenantRuntimeError);
    expect(error).toMatchObject({ code: 'INVALID_ORGANIZATION_ID' });
    expect(fake.transactionExecutors).toHaveLength(0);
  });

  it('applies the runtime role and local organization context inside one transaction', async () => {
    const organizationId = '123e4567-e89b-42d3-a456-426614174000';
    const fake = createAccess(organizationId);
    let operationExecutor: PostgreSqlQueryExecutor | undefined;

    const result = await withOrganizationTransaction(
      fake.access,
      organizationId,
      (transaction, normalizedOrganizationId) => {
        operationExecutor = transaction;
        expect(normalizedOrganizationId).toBe(organizationId);
        return Promise.resolve('completed');
      },
    );

    expect(result).toBe('completed');
    expect(operationExecutor).toBe(fake.transactionExecutors[0]);
    expect(fake.calls[0]?.text).toBe('SET LOCAL ROLE orgawork_runtime');
    expect(fake.calls[1]).toEqual({
      text: "SELECT set_config('orgawork.organization_id', $1, true)",
      values: [organizationId],
    });
  });

  it('reads an absent tenant context as null without inventing a value', async () => {
    const fake = createAccess(null);
    const value = await readCurrentOrganizationId(
      fake.transactionExecutors[0] ?? {
        query: <Row extends QueryResultRow = QueryResultRow>(
          text: string,
          values?: readonly unknown[],
        ): Promise<QueryResult<Row>> => {
          fake.calls.push({ text, values });
          return Promise.resolve(
            queryResult<CurrentOrganizationRow>([
              { organization_id: null },
            ]) as unknown as QueryResult<Row>,
          );
        },
      },
    );

    expect(value).toBeNull();
  });

  it('replaces raw transaction failures with a stable secret-free error', async () => {
    const fake = createAccess(
      null,
      new Error('password=should-not-leak organization=private-value'),
    );
    const error = await captureError(
      withOrganizationTransaction(fake.access, '123e4567-e89b-42d3-a456-426614174000', () =>
        Promise.resolve(undefined),
      ),
    );

    expect(error).toBeInstanceOf(TenantRuntimeError);
    expect(error).toMatchObject({ code: 'TENANT_TRANSACTION_FAILED' });
    expect(String(error)).not.toContain('should-not-leak');
    expect(String(error)).not.toContain('private-value');
  });

  it('declares explicit no-bypass roles and tenant context in the official migration', async () => {
    const sql = await readFile(
      resolve('infra/migrations/0003_create-tenant-runtime-infrastructure.sql'),
      'utf8',
    );

    expect(sql).toContain('ALTER ROLE orgawork_migration NOBYPASSRLS');
    expect(sql).toContain('ALTER ROLE orgawork_runtime NOBYPASSRLS');
    expect(sql).toContain("current_setting('orgawork.organization_id', true)");
    expect(sql).toContain('orgawork_current_organization_id');
  });

  it('creates outbox, inbox, heartbeat and forced RLS policies', async () => {
    const sql = await readFile(
      resolve('infra/migrations/0003_create-tenant-runtime-infrastructure.sql'),
      'utf8',
    );

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.orgawork_outbox');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.orgawork_inbox');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.orgawork_process_heartbeat');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('orgawork_outbox_organization_policy');
    expect(sql).toContain('orgawork_inbox_organization_policy');
  });

  it('enforces idempotency and safe completion timestamps in the database', async () => {
    const sql = await readFile(
      resolve('infra/migrations/0003_create-tenant-runtime-infrastructure.sql'),
      'utf8',
    );

    expect(sql).toContain('UNIQUE (organization_id, idempotency_key)');
    expect(sql).toContain('UNIQUE (organization_id, consumer_name, message_id)');
    expect(sql).toContain('published_at IS NULL OR published_at >= occurred_at');
    expect(sql).toContain('processed_at IS NULL OR processed_at >= received_at');
    expect(sql).toContain('stopped_at IS NULL OR stopped_at >= started_at');
    expect(sql).toContain('lease_expires_at >= last_seen_at');
  });
});
