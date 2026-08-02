import type { PostgreSqlQueryExecutor } from './index.js';
import {
  computeVersionedMigrationFingerprint,
  readMigrationHistory,
  type MigrationHistoryRecord,
} from './migration-history.js';
import type { VersionedMigration } from './migrations.js';

export type MigrationIntegrityErrorCode =
  | 'MIGRATION_INTEGRITY_UNAVAILABLE'
  | 'MIGRATION_SET_INVALID'
  | 'MIGRATION_HISTORY_COUNT_MISMATCH'
  | 'MIGRATION_HISTORY_ORDER_MISMATCH'
  | 'MIGRATION_HISTORY_FINGERPRINT_MISMATCH';

export class MigrationIntegrityError extends Error {
  public readonly code: MigrationIntegrityErrorCode;
  public readonly version: number | undefined;

  public constructor(
    code: MigrationIntegrityErrorCode,
    message: string,
    context: { readonly version?: number } = {},
  ) {
    super(message);
    this.name = 'MigrationIntegrityError';
    this.code = code;
    this.version = context.version;
  }
}

export interface MigrationIntegrityResult {
  readonly migrationCount: number;
  readonly historyCount: number;
  readonly versions: readonly number[];
  readonly fingerprints: readonly string[];
}

function createIntegrityError(
  code: MigrationIntegrityErrorCode,
  context: { readonly version?: number } = {},
): MigrationIntegrityError {
  const messages: Readonly<Record<MigrationIntegrityErrorCode, string>> = {
    MIGRATION_INTEGRITY_UNAVAILABLE: 'بررسی یکپارچگی Migrationها ناموفق بود.',
    MIGRATION_SET_INVALID: 'مجموعه Migrationهای نسخه‌دار معتبر نیست.',
    MIGRATION_HISTORY_COUNT_MISMATCH: 'تعداد Migrationها با تاریخچه ثبت‌شده سازگار نیست.',
    MIGRATION_HISTORY_ORDER_MISMATCH: 'ترتیب Migrationها با تاریخچه ثبت‌شده سازگار نیست.',
    MIGRATION_HISTORY_FINGERPRINT_MISMATCH: 'اثر انگشت Migration با تاریخچه ثبت‌شده سازگار نیست.',
  };

  return new MigrationIntegrityError(code, messages[code], context);
}

function normalizeMigrations(
  migrations: readonly VersionedMigration[],
): readonly VersionedMigration[] {
  const ordered = [...migrations].sort((left, right) => left.version - right.version);
  const versions = new Set<number>();

  for (const migration of ordered) {
    if (
      !Number.isInteger(migration.version) ||
      migration.version < 1 ||
      versions.has(migration.version) ||
      migration.name.trim() === '' ||
      migration.fileName.trim() === '' ||
      migration.sql.trim() === ''
    ) {
      throw createIntegrityError('MIGRATION_SET_INVALID', { version: migration.version });
    }

    versions.add(migration.version);
  }

  return ordered;
}

function assertHistoryRecord(
  migration: VersionedMigration,
  record: MigrationHistoryRecord,
): string {
  if (
    record.version !== migration.version ||
    record.name !== migration.name ||
    record.fileName !== migration.fileName
  ) {
    throw createIntegrityError('MIGRATION_HISTORY_ORDER_MISMATCH', {
      version: migration.version,
    });
  }

  const fingerprint = computeVersionedMigrationFingerprint(migration);

  if (record.fingerprint !== fingerprint) {
    throw createIntegrityError('MIGRATION_HISTORY_FINGERPRINT_MISMATCH', {
      version: migration.version,
    });
  }

  return fingerprint;
}

export async function inspectMigrationIntegrity(
  executor: PostgreSqlQueryExecutor,
  migrations: readonly VersionedMigration[],
): Promise<MigrationIntegrityResult> {
  const orderedMigrations = normalizeMigrations(migrations);
  let history: readonly MigrationHistoryRecord[];

  try {
    history = await readMigrationHistory(executor);
  } catch {
    throw createIntegrityError('MIGRATION_INTEGRITY_UNAVAILABLE');
  }

  if (history.length !== orderedMigrations.length) {
    throw createIntegrityError('MIGRATION_HISTORY_COUNT_MISMATCH');
  }

  const fingerprints: string[] = [];

  for (let index = 0; index < orderedMigrations.length; index += 1) {
    const migration = orderedMigrations[index];
    const record = history[index];

    if (migration === undefined || record === undefined) {
      throw createIntegrityError('MIGRATION_HISTORY_COUNT_MISMATCH');
    }

    fingerprints.push(assertHistoryRecord(migration, record));
  }

  return {
    migrationCount: orderedMigrations.length,
    historyCount: history.length,
    versions: orderedMigrations.map((migration) => migration.version),
    fingerprints,
  };
}
