import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { PostgreSqlAccess, PostgreSqlQueryExecutor } from './index.js';

export type VersionedMigrationErrorCode =
  | 'MIGRATION_DIRECTORY_UNAVAILABLE'
  | 'INVALID_MIGRATION_FILE_NAME'
  | 'DUPLICATE_MIGRATION_VERSION'
  | 'EMPTY_MIGRATION_SQL'
  | 'INVALID_APPLIED_VERSION'
  | 'MIGRATION_EXECUTION_FAILED';

export class VersionedMigrationError extends Error {
  public readonly code: VersionedMigrationErrorCode;
  public readonly fileName: string | undefined;
  public readonly version: number | undefined;

  public constructor(
    code: VersionedMigrationErrorCode,
    message: string,
    context: { readonly fileName?: string; readonly version?: number } = {},
  ) {
    super(message);
    this.name = 'VersionedMigrationError';
    this.code = code;
    this.fileName = context.fileName;
    this.version = context.version;
  }
}

export interface VersionedMigration {
  readonly version: number;
  readonly name: string;
  readonly fileName: string;
  readonly absolutePath: string;
  readonly sql: string;
}

export interface VersionedMigrationRunResult {
  readonly discoveredVersions: readonly number[];
  readonly appliedVersions: readonly number[];
  readonly skippedVersions: readonly number[];
}

const migrationFilePattern = /^(\d{4})_([a-z0-9][a-z0-9-]*)\.sql$/u;

function createMigrationError(
  code: VersionedMigrationErrorCode,
  context: { readonly fileName?: string; readonly version?: number } = {},
): VersionedMigrationError {
  const messages: Readonly<Record<VersionedMigrationErrorCode, string>> = {
    MIGRATION_DIRECTORY_UNAVAILABLE: 'خواندن پوشه Migration ناموفق بود.',
    INVALID_MIGRATION_FILE_NAME: 'نام فایل Migration معتبر نیست.',
    DUPLICATE_MIGRATION_VERSION: 'نسخه Migration تکراری است.',
    EMPTY_MIGRATION_SQL: 'متن Migration نباید خالی باشد.',
    INVALID_APPLIED_VERSION: 'نسخه اعمال‌شده Migration معتبر نیست.',
    MIGRATION_EXECUTION_FAILED: 'اجرای Migration نسخه‌دار ناموفق بود.',
  };

  return new VersionedMigrationError(code, messages[code], context);
}

function parseMigrationFileName(fileName: string): {
  readonly version: number;
  readonly name: string;
} {
  const match = migrationFilePattern.exec(fileName);
  const rawVersion = match?.[1];
  const name = match?.[2];

  if (rawVersion === undefined || name === undefined) {
    throw createMigrationError('INVALID_MIGRATION_FILE_NAME', { fileName });
  }

  const version = Number(rawVersion);

  if (!Number.isInteger(version) || version < 1) {
    throw createMigrationError('INVALID_MIGRATION_FILE_NAME', { fileName });
  }

  return { version, name };
}

function validateUniqueVersions(migrations: readonly VersionedMigration[]): void {
  const versions = new Set<number>();

  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      throw createMigrationError('DUPLICATE_MIGRATION_VERSION', {
        fileName: migration.fileName,
        version: migration.version,
      });
    }

    versions.add(migration.version);
  }
}

function normalizeAppliedVersions(appliedVersions: ReadonlySet<number>): ReadonlySet<number> {
  const normalized = new Set<number>();

  for (const version of appliedVersions) {
    if (!Number.isInteger(version) || version < 1) {
      throw createMigrationError('INVALID_APPLIED_VERSION', { version });
    }

    normalized.add(version);
  }

  return normalized;
}

export async function loadVersionedMigrations(
  directory: string,
): Promise<readonly VersionedMigration[]> {
  const absoluteDirectory = resolve(directory);
  let entries: Dirent[];

  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch {
    throw createMigrationError('MIGRATION_DIRECTORY_UNAVAILABLE');
  }

  const migrations: VersionedMigration[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.sql')) {
      continue;
    }

    const { version, name } = parseMigrationFileName(entry.name);
    const absolutePath = join(absoluteDirectory, entry.name);
    let sql: string;

    try {
      sql = await readFile(absolutePath, 'utf8');
    } catch {
      throw createMigrationError('MIGRATION_DIRECTORY_UNAVAILABLE', {
        fileName: entry.name,
        version,
      });
    }

    if (sql.trim() === '') {
      throw createMigrationError('EMPTY_MIGRATION_SQL', {
        fileName: entry.name,
        version,
      });
    }

    migrations.push({
      version,
      name,
      fileName: entry.name,
      absolutePath,
      sql,
    });
  }

  validateUniqueVersions(migrations);

  return migrations.sort((left, right) => left.version - right.version);
}

export async function runVersionedMigrations(
  access: PostgreSqlAccess,
  migrations: readonly VersionedMigration[],
  appliedVersions: ReadonlySet<number> = new Set<number>(),
): Promise<VersionedMigrationRunResult> {
  validateUniqueVersions(migrations);
  const normalizedAppliedVersions = normalizeAppliedVersions(appliedVersions);
  const orderedMigrations = [...migrations].sort((left, right) => left.version - right.version);
  const pendingMigrations = orderedMigrations.filter(
    (migration) => !normalizedAppliedVersions.has(migration.version),
  );
  const skippedVersions = orderedMigrations
    .filter((migration) => normalizedAppliedVersions.has(migration.version))
    .map((migration) => migration.version);

  if (pendingMigrations.length === 0) {
    return {
      discoveredVersions: orderedMigrations.map((migration) => migration.version),
      appliedVersions: [],
      skippedVersions,
    };
  }

  let currentMigration: VersionedMigration | undefined;

  try {
    await access.transaction(async (transaction: PostgreSqlQueryExecutor): Promise<void> => {
      for (const migration of pendingMigrations) {
        currentMigration = migration;
        await transaction.query(migration.sql);
      }
    });
  } catch {
    const errorDetails =
      currentMigration === undefined
        ? {}
        : { fileName: currentMigration.fileName, version: currentMigration.version };

    throw createMigrationError('MIGRATION_EXECUTION_FAILED', errorDetails);
  }

  return {
    discoveredVersions: orderedMigrations.map((migration) => migration.version),
    appliedVersions: pendingMigrations.map((migration) => migration.version),
    skippedVersions,
  };
}
