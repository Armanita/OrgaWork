import type { QueryResult, QueryResultRow } from 'pg';

import { databaseRoleNames } from './database-roles.js';
import type { PostgreSqlAccess, PostgreSqlQueryExecutor } from './index.js';

export type TenantRuntimeErrorCode =
  | 'INVALID_ORGANIZATION_ID'
  | 'TENANT_CONTEXT_UNAVAILABLE'
  | 'TENANT_CONTEXT_MISMATCH'
  | 'TENANT_TRANSACTION_FAILED';

export class TenantRuntimeError extends Error {
  public readonly code: TenantRuntimeErrorCode;

  public constructor(code: TenantRuntimeErrorCode, message: string) {
    super(message);
    this.name = 'TenantRuntimeError';
    this.code = code;
  }
}

const tenantRuntimeMessages: Readonly<Record<TenantRuntimeErrorCode, string>> = {
  INVALID_ORGANIZATION_ID: 'شناسه سازمان برای زمینه تراکنش معتبر نیست.',
  TENANT_CONTEXT_UNAVAILABLE: 'خواندن زمینه سازمان جاری ناموفق بود.',
  TENANT_CONTEXT_MISMATCH: 'زمینه سازمان جاری با تراکنش مورد انتظار سازگار نیست.',
  TENANT_TRANSACTION_FAILED: 'اجرای تراکنش سازمانی ناموفق بود.',
};

const organizationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

interface CurrentOrganizationRow extends QueryResultRow {
  readonly organization_id: string | null;
}

function createTenantRuntimeError(code: TenantRuntimeErrorCode): TenantRuntimeError {
  return new TenantRuntimeError(code, tenantRuntimeMessages[code]);
}

export function normalizeOrganizationId(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!organizationIdPattern.test(normalized)) {
    throw createTenantRuntimeError('INVALID_ORGANIZATION_ID');
  }

  return normalized;
}

export async function readCurrentOrganizationId(
  executor: PostgreSqlQueryExecutor,
): Promise<string | null> {
  let result: QueryResult<CurrentOrganizationRow>;

  try {
    result = await executor.query<CurrentOrganizationRow>(
      "SELECT NULLIF(current_setting('orgawork.organization_id', true), '') AS organization_id",
    );
  } catch {
    throw createTenantRuntimeError('TENANT_CONTEXT_UNAVAILABLE');
  }

  const value = result.rows[0]?.organization_id;

  if (result.rowCount !== 1 || (value !== null && typeof value !== 'string')) {
    throw createTenantRuntimeError('TENANT_CONTEXT_UNAVAILABLE');
  }

  return value;
}

export async function withOrganizationTransaction<Result>(
  access: PostgreSqlAccess,
  organizationId: string,
  operation: (
    transaction: PostgreSqlQueryExecutor,
    normalizedOrganizationId: string,
  ) => Promise<Result>,
): Promise<Result> {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);

  try {
    return await access.transaction(async (transaction) => {
      await transaction.query(`SET LOCAL ROLE ${databaseRoleNames.runtime}`);
      await transaction.query("SELECT set_config('orgawork.organization_id', $1, true)", [
        normalizedOrganizationId,
      ]);

      const currentOrganizationId = await readCurrentOrganizationId(transaction);

      if (currentOrganizationId !== normalizedOrganizationId) {
        throw createTenantRuntimeError('TENANT_CONTEXT_MISMATCH');
      }

      return operation(transaction, normalizedOrganizationId);
    });
  } catch (error: unknown) {
    if (error instanceof TenantRuntimeError && error.code === 'INVALID_ORGANIZATION_ID') {
      throw error;
    }

    throw createTenantRuntimeError('TENANT_TRANSACTION_FAILED');
  }
}
