import { createHash } from 'node:crypto';

import type { QueryResult, QueryResultRow } from 'pg';

import type { PostgreSqlAccess, PostgreSqlQueryExecutor } from './index.js';
import type { VersionedMigration, VersionedMigrationRunResult } from './migrations.js';

export type MigrationHistoryErrorCode =
  | 'MIGRATION_HISTORY_UNAVAILABLE'
  | 'INVALID_MIGRATION_HISTORY'
  | 'MIGRATION_HISTORY_ORDER_MISMATCH'
  | 'MIGRATION_HISTORY_FINGERPRINT_MISMATCH'
  | 'MIGRATION_HISTORY_EXECUTION_FAILED';

export class MigrationHistoryError extends Error {
  public readonly code: MigrationHistoryErrorCode;
  public readonly version: number | undefined;

  public constructor(
    code: MigrationHistoryErrorCode,
    message: string,
    context: { readonly version?: number } = {},
  ) {
    super(message);
    this.name = 'MigrationHistoryError';
    this.code = code;
    this.version = context.version;
  }
}

export interface MigrationHistoryRecord {
  readonly version: number;
  readonly name: string;
  readonly fileName: string;
  readonly fingerprint: string;
  readonly appliedOrder: number;
  readonly appliedAt: string;
}

export interface TrackedVersionedMigrationRunResult extends VersionedMigrationRunResult {
  readonly historyTable: 'orgawork_migration_history';
  readonly fingerprints: readonly string[];
}

interface MigrationHistoryRow extends QueryResultRow {
  readonly version: number;
  readonly name: string;
  readonly file_name: string;
  readonly fingerprint: string;
  readonly applied_order: string;
  readonly applied_at: Date | string;
}

interface MigrationHistoryTableStateRow extends QueryResultRow {
  readonly exists: boolean;
}

const historyTableName = 'orgawork_migration_history';
const qualifiedHistoryTable = 'public.orgawork_migration_history';
const fingerprintPattern = /^[0-9a-f]{64}$/u;

function createHistoryError(
  code: MigrationHistoryErrorCode,
  context: { readonly version?: number } = {},
): MigrationHistoryError {
  const messages: Readonly<Record<MigrationHistoryErrorCode, string>> = {
    MIGRATION_HISTORY_UNAVAILABLE: 'خواندن تاریخچه Migration ناموفق بود.',
    INVALID_MIGRATION_HISTORY: 'رکورد تاریخچه Migration معتبر نیست.',
    MIGRATION_HISTORY_ORDER_MISMATCH: 'ترتیب تاریخچه Migration با فایل‌های نسخه‌دار سازگار نیست.',
    MIGRATION_HISTORY_FINGERPRINT_MISMATCH: 'اثر انگشت Migration با تاریخچه ثبت‌شده سازگار نیست.',
    MIGRATION_HISTORY_EXECUTION_FAILED: 'اجرای Migration و ثبت تاریخچه آن ناموفق بود.',
  };

  return new MigrationHistoryError(code, messages[code], context);
}

function normalizeAppliedAt(value: Date | string, version: number): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createHistoryError('INVALID_MIGRATION_HISTORY', { version });
  }

  return date.toISOString();
}

function validateMigrationSequence(
  migrations: readonly VersionedMigration[],
): readonly VersionedMigration[] {
  const ordered = [...migrations].sort((left, right) => left.version - right.version);
  const versions = new Set<number>();

  for (const migration of ordered) {
    if (
      !Number.isInteger(migration.version) ||
      migration.version < 1 ||
      versions.has(migration.version)
    ) {
      throw createHistoryError('MIGRATION_HISTORY_ORDER_MISMATCH', {
        version: migration.version,
      });
    }

    versions.add(migration.version);
  }

  return ordered;
}

function validateHistoryPrefix(
  migrations: readonly VersionedMigration[],
  history: readonly MigrationHistoryRecord[],
): void {
  if (history.length > migrations.length) {
    throw createHistoryError('MIGRATION_HISTORY_ORDER_MISMATCH');
  }

  for (let index = 0; index < history.length; index += 1) {
    const record = history[index];
    const migration = migrations[index];

    if (record === undefined || migration === undefined) {
      throw createHistoryError('MIGRATION_HISTORY_ORDER_MISMATCH');
    }

    if (
      record.version !== migration.version ||
      record.name !== migration.name ||
      record.fileName !== migration.fileName
    ) {
      throw createHistoryError('MIGRATION_HISTORY_ORDER_MISMATCH', {
        version: record.version,
      });
    }

    if (record.fingerprint !== computeVersionedMigrationFingerprint(migration)) {
      throw createHistoryError('MIGRATION_HISTORY_FINGERPRINT_MISMATCH', {
        version: record.version,
      });
    }
  }
}

async function queryHistoryTableState(executor: PostgreSqlQueryExecutor): Promise<boolean> {
  let result: QueryResult<MigrationHistoryTableStateRow>;

  try {
    result = await executor.query<MigrationHistoryTableStateRow>(
      "SELECT to_regclass('public.orgawork_migration_history') IS NOT NULL AS exists",
    );
  } catch {
    throw createHistoryError('MIGRATION_HISTORY_UNAVAILABLE');
  }

  const exists = result.rows[0]?.exists;

  if (result.rowCount !== 1 || typeof exists !== 'boolean') {
    throw createHistoryError('MIGRATION_HISTORY_UNAVAILABLE');
  }

  return exists;
}

export function computeVersionedMigrationFingerprint(
  migration: Pick<VersionedMigration, 'sql'>,
): string {
  return createHash('sha256').update(migration.sql, 'utf8').digest('hex');
}

export async function readMigrationHistory(
  executor: PostgreSqlQueryExecutor,
): Promise<readonly MigrationHistoryRecord[]> {
  let result: QueryResult<MigrationHistoryRow>;

  try {
    result = await executor.query<MigrationHistoryRow>(
      `SELECT
        version,
        name,
        file_name,
        fingerprint,
        applied_order::text AS applied_order,
        applied_at
      FROM ${qualifiedHistoryTable}
      ORDER BY applied_order ASC`,
    );
  } catch {
    throw createHistoryError('MIGRATION_HISTORY_UNAVAILABLE');
  }

  const records: MigrationHistoryRecord[] = [];
  const versions = new Set<number>();
  let previousOrder = 0;

  for (const row of result.rows) {
    const appliedOrder = Number(row.applied_order);

    if (
      !Number.isInteger(row.version) ||
      row.version < 1 ||
      versions.has(row.version) ||
      row.name.trim() === '' ||
      row.file_name.trim() === '' ||
      !fingerprintPattern.test(row.fingerprint) ||
      !Number.isSafeInteger(appliedOrder) ||
      appliedOrder <= previousOrder
    ) {
      throw createHistoryError('INVALID_MIGRATION_HISTORY', {
        version: row.version,
      });
    }

    records.push({
      version: row.version,
      name: row.name,
      fileName: row.file_name,
      fingerprint: row.fingerprint,
      appliedOrder,
      appliedAt: normalizeAppliedAt(row.applied_at, row.version),
    });
    versions.add(row.version);
    previousOrder = appliedOrder;
  }

  return records;
}

export async function runTrackedVersionedMigrations(
  access: PostgreSqlAccess,
  migrations: readonly VersionedMigration[],
): Promise<TrackedVersionedMigrationRunResult> {
  const orderedMigrations = validateMigrationSequence(migrations);
  const tableExists = await queryHistoryTableState(access);
  const history = tableExists ? await readMigrationHistory(access) : [];

  validateHistoryPrefix(orderedMigrations, history);

  const pendingMigrations = orderedMigrations.slice(history.length);
  const skippedVersions = history.map((record) => record.version);

  if (pendingMigrations.length === 0) {
    return {
      discoveredVersions: orderedMigrations.map((migration) => migration.version),
      appliedVersions: [],
      skippedVersions,
      historyTable: historyTableName,
      fingerprints: orderedMigrations.map(computeVersionedMigrationFingerprint),
    };
  }

  let currentMigration: VersionedMigration | undefined;

  try {
    await access.transaction(async (transaction: PostgreSqlQueryExecutor): Promise<void> => {
      for (const migration of pendingMigrations) {
        currentMigration = migration;
        const fingerprint = computeVersionedMigrationFingerprint(migration);

        await transaction.query(migration.sql);
        await transaction.query(
          `INSERT INTO ${qualifiedHistoryTable}
              (version, name, file_name, fingerprint)
             VALUES ($1, $2, $3, $4)`,
          [migration.version, migration.name, migration.fileName, fingerprint],
        );
      }
    });
  } catch {
    const context = currentMigration === undefined ? {} : { version: currentMigration.version };
    throw createHistoryError('MIGRATION_HISTORY_EXECUTION_FAILED', context);
  }

  return {
    discoveredVersions: orderedMigrations.map((migration) => migration.version),
    appliedVersions: pendingMigrations.map((migration) => migration.version),
    skippedVersions,
    historyTable: historyTableName,
    fingerprints: orderedMigrations.map(computeVersionedMigrationFingerprint),
  };
}
