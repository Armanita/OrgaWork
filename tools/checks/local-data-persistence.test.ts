import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertSafePersistenceAcceptancePlan,
  buildPersistenceAcceptancePlan,
  forbiddenPersistenceArguments,
  forbiddenPersistenceCommands,
  normalizePersistenceMarkerId,
  persistenceAcceptanceBucket,
  persistenceAcceptanceLifecycleCommands,
  persistenceAcceptanceObjectPrefix,
  persistenceAcceptanceRedisKeyPrefix,
  persistenceAcceptanceStage,
  persistenceAcceptanceTable,
} from '../scripts/local-data-persistence-plan.js';

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/g, '\n');

const packageSource = readSource('package.json');
const runtimeSource = readSource('tools/scripts/local-data-persistence.ts');
describe('local data persistence acceptance contract', () => {
  it('freezes the P1.4.11 stage and non-destructive lifecycle', () => {
    expect(persistenceAcceptanceStage).toBe('P1.4.11');
    expect(persistenceAcceptanceLifecycleCommands).toEqual(['infra:stop', 'infra:start']);
    expect(forbiddenPersistenceCommands).toEqual(['infra:cleanup']);
    expect(forbiddenPersistenceArguments).toEqual(['--volumes', '-v', '--remove-orphans']);
  });

  it('normalizes valid marker identifiers and rejects unsafe identifiers', () => {
    expect(normalizePersistenceMarkerId(' P1411-ACCEPTANCE-01 ')).toBe('p1411-acceptance-01');
    expect(() => normalizePersistenceMarkerId('short')).toThrow();
    expect(() => normalizePersistenceMarkerId('p1411_invalid_marker')).toThrow();
    expect(() => normalizePersistenceMarkerId('p1411 marker value')).toThrow();
  });

  it('builds isolated and identifiable acceptance data for all three services', () => {
    const markerId = 'p1411-acceptance-01';
    const plan = buildPersistenceAcceptancePlan(markerId);

    expect(plan.stage).toBe('P1.4.11');
    expect(plan.markerId).toBe(markerId);
    expect(plan.markerValue).toBe('orgawork-persistence-' + markerId);
    expect(plan.postgresql.table).toBe(persistenceAcceptanceTable);
    expect(plan.postgresql.createTableSql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(plan.postgresql.writeSql).toContain('ON CONFLICT');
    expect(plan.postgresql.readSql).toContain('WHERE marker_id = ');
    expect(plan.postgresql.deleteSql).toContain('WHERE marker_id = ');
    expect(plan.postgresql.dropTableSql).toContain('DROP TABLE IF EXISTS');
    expect(plan.redis.key).toBe(persistenceAcceptanceRedisKeyPrefix + markerId);
    expect(plan.minio.bucket).toBe(persistenceAcceptanceBucket);
    expect(plan.minio.objectKey).toBe(persistenceAcceptanceObjectPrefix + markerId + '.txt');
    expect(plan.cleanupRequired).toBe(true);
    expect(plan.preserveNamedVolumes).toBe(true);
    expect(plan.preserveBucketPrivacy).toBe(true);
    expect(() => assertSafePersistenceAcceptancePlan(plan)).not.toThrow();
  });

  it('keeps destructive commands and arguments outside the acceptance lifecycle', () => {
    const plan = buildPersistenceAcceptancePlan('p1411-acceptance-02');
    const lifecycle = plan.lifecycleCommands as readonly string[];
    const serializedPlan = JSON.stringify(plan);

    for (const command of forbiddenPersistenceCommands) {
      expect(lifecycle).not.toContain(command);
    }

    for (const argument of forbiddenPersistenceArguments) {
      expect(serializedPlan).not.toContain(argument);
    }
  });

  it('exposes the persistence acceptance command', () => {
    expect(packageSource).toContain(
      '"infra:persistence": "tsx tools/scripts/local-data-persistence.ts"',
    );
  });

  it('keeps the runtime lifecycle rollback-safe and non-destructive', () => {
    expect(runtimeSource).toContain("runPersistenceLifecycle('infra:stop')");
    expect(runtimeSource).toContain("runPersistenceLifecycle('infra:start')");
    expect(runtimeSource).toContain('PRE_STOP_DATA: VERIFIED_3_OF_3');
    expect(runtimeSource).toContain('POST_START_DATA: VERIFIED_3_OF_3');
    expect(runtimeSource).toContain('ACCEPTANCE_DATA_CLEANUP: VERIFIED');
    expect(runtimeSource).not.toContain("runPersistenceLifecycle('infra:cleanup')");
    expect(runtimeSource).not.toContain('--volumes');
    expect(runtimeSource).not.toContain('--remove-orphans');
  });

  it('preserves authenticated MinIO shell variables', () => {
    expect(runtimeSource).toContain('rm -rf "$config_dir"');
    expect(runtimeSource).toContain('export MC_CONFIG_DIR="$config_dir"');
    expect(runtimeSource).toContain(
      'mc alias set acceptance http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null',
    );
    expect(runtimeSource).not.toContain('rm -rf ""');
    expect(runtimeSource).not.toContain(
      'mc alias set acceptance http://127.0.0.1:9000 "" "" >/dev/null',
    );
  });

  it('uses cmd.exe for pnpm lifecycle commands on Windows', () => {
    expect(runtimeSource).toContain("if (process.platform === 'win32')");
    expect(runtimeSource).toContain(
      "const commandShell = process.env['ComSpec']?.trim() || 'cmd.exe'",
    );
    expect(runtimeSource).toContain("['/d', '/s', '/c', persistencePnpmExecutable + ' ' + script]");
    expect(runtimeSource).toContain(
      'runPersistenceCommand(persistencePnpmExecutable, [script], false)',
    );
  });
});
