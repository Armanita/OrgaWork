import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertSafePersistenceAcceptancePlan,
  buildPersistenceAcceptancePlan,
  type PersistenceAcceptancePlan,
} from './local-data-persistence-plan.js';

export const persistenceProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const persistenceDockerExecutable = process.env['DOCKER_EXECUTABLE']?.trim() || 'docker';
export const persistencePnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export const persistenceDataContainers = [
  'orgawork-postgres',
  'orgawork-redis',
  'orgawork-minio',
] as const;

export const persistenceVolumeNames = [
  'orgawork-postgres-data',
  'orgawork-redis-data',
  'orgawork-minio-data',
] as const;

export type PersistenceVolumeIdentities = Readonly<Record<string, string>>;

export function writePersistenceMessage(message: string): void {
  process.stdout.write(message + '\n');
}

export function runPersistenceCommand(
  executable: string,
  arguments_: readonly string[],
  captureOutput = true,
): string {
  const result = spawnSync(executable, [...arguments_], {
    cwd: persistenceProjectRoot,
    encoding: 'utf8',
    env: process.env,
    stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
  });

  if (result.error !== undefined) {
    throw new Error('اجرای فرمان ممکن نشد: ' + result.error.message);
  }

  if (result.status !== 0) {
    const details = captureOutput
      ? (String(result.stderr).trim() + ' ' + String(result.stdout).trim()).trim()
      : '';

    throw new Error(
      'فرمان با کد ' +
        String(result.status) +
        ' ناموفق بود' +
        (details === '' ? '' : ': ' + details),
    );
  }

  return captureOutput ? String(result.stdout).trim() : '';
}

export function runPersistenceDocker(arguments_: readonly string[]): string {
  return runPersistenceCommand(persistenceDockerExecutable, arguments_);
}

export function runPersistenceLifecycle(script: 'infra:stop' | 'infra:start'): void {
  if (process.platform === 'win32') {
    const commandShell = process.env['ComSpec']?.trim() || 'cmd.exe';
    runPersistenceCommand(
      commandShell,
      ['/d', '/s', '/c', persistencePnpmExecutable + ' ' + script],
      false,
    );
    return;
  }

  runPersistenceCommand(persistencePnpmExecutable, [script], false);
}
export function isPersistenceContainerRunning(containerName: string): boolean {
  const result = spawnSync(
    persistenceDockerExecutable,
    ['inspect', '--format', '{{.State.Running}}', containerName],
    {
      cwd: persistenceProjectRoot,
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  return result.status === 0 && String(result.stdout).trim().toLowerCase() === 'true';
}

export function assertPersistenceContainersRunning(): void {
  for (const containerName of persistenceDataContainers) {
    if (!isPersistenceContainerRunning(containerName)) {
      throw new Error('Container مورد انتظار در حال اجرا نیست: ' + containerName);
    }
  }
}

export function assertPersistenceContainersStopped(): void {
  for (const containerName of persistenceDataContainers) {
    if (isPersistenceContainerRunning(containerName)) {
      throw new Error('Container پس از توقف همچنان در حال اجرا است: ' + containerName);
    }
  }
}

export function capturePersistenceVolumeIdentities(): PersistenceVolumeIdentities {
  const identities: Record<string, string> = {};

  for (const volumeName of persistenceVolumeNames) {
    identities[volumeName] = runPersistenceDocker([
      'volume',
      'inspect',
      '--format',
      '{{.Name}}|{{.CreatedAt}}|{{.Mountpoint}}',
      volumeName,
    ]);
  }

  return identities;
}

export function assertPersistenceVolumeIdentities(
  expected: PersistenceVolumeIdentities,
  actual: PersistenceVolumeIdentities,
): void {
  for (const volumeName of persistenceVolumeNames) {
    if (actual[volumeName] !== expected[volumeName]) {
      throw new Error('هویت Volume پایدار تغییر کرده است: ' + volumeName);
    }
  }
}

export function buildPersistenceAcceptanceEnvironment(
  plan: PersistenceAcceptancePlan,
): Readonly<Record<string, string>> {
  return {
    ORGAWORK_MARKER_ID: plan.markerId,
    ORGAWORK_MARKER_VALUE: plan.markerValue,
    ORGAWORK_REDIS_KEY: plan.redis.key,
    ORGAWORK_BUCKET: plan.minio.bucket,
    ORGAWORK_OBJECT_KEY: plan.minio.objectKey,
  };
}

export function runPersistenceDockerShell(
  containerName: string,
  environment: Readonly<Record<string, string>>,
  command: string,
): string {
  const environmentArguments: string[] = [];

  for (const [key, value] of Object.entries(environment)) {
    environmentArguments.push('--env', key + '=' + value);
  }

  return runPersistenceDocker([
    'exec',
    ...environmentArguments,
    containerName,
    'sh',
    '-c',
    command,
  ]);
}

export function buildPersistenceMinioCommand(operation: string): string {
  return [
    'set -eu',
    'config_dir=/tmp/orgawork-p1411-acceptance',
    'rm -rf "$config_dir"',
    'export MC_CONFIG_DIR="$config_dir"',
    'mc alias set acceptance http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null',
    operation,
    'rm -rf "$config_dir"',
  ].join('; ');
}

export interface PersistenceAcceptanceValues {
  readonly postgresql: string;
  readonly redis: string;
  readonly minio: string;
}

export function writePersistenceAcceptanceData(plan: PersistenceAcceptancePlan): void {
  const environment = buildPersistenceAcceptanceEnvironment(plan);

  runPersistenceDockerShell(
    'orgawork-postgres',
    environment,
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "' +
      plan.postgresql.createTableSql +
      '" >/dev/null',
  );
  runPersistenceDockerShell(
    'orgawork-postgres',
    environment,
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO public.orgawork_persistence_acceptance (marker_id, marker_value) VALUES (\'$ORGAWORK_MARKER_ID\', \'$ORGAWORK_MARKER_VALUE\') ON CONFLICT (marker_id) DO UPDATE SET marker_value = EXCLUDED.marker_value, created_at = now()" >/dev/null',
  );
  runPersistenceDockerShell(
    'orgawork-redis',
    environment,
    'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli --raw SET "$ORGAWORK_REDIS_KEY" "$ORGAWORK_MARKER_VALUE" >/dev/null',
  );
  runPersistenceDockerShell(
    'orgawork-minio',
    environment,
    buildPersistenceMinioCommand(
      'printf %s "$ORGAWORK_MARKER_VALUE" | mc pipe "acceptance/$ORGAWORK_BUCKET/$ORGAWORK_OBJECT_KEY" >/dev/null',
    ),
  );
}

export function readPersistencePostgreSqlValue(plan: PersistenceAcceptancePlan): string {
  return runPersistenceDockerShell(
    'orgawork-postgres',
    buildPersistenceAcceptanceEnvironment(plan),
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SELECT marker_value FROM public.orgawork_persistence_acceptance WHERE marker_id = \'$ORGAWORK_MARKER_ID\'"',
  );
}

export function readPersistenceRedisValue(plan: PersistenceAcceptancePlan): string {
  return runPersistenceDockerShell(
    'orgawork-redis',
    buildPersistenceAcceptanceEnvironment(plan),
    'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli --raw GET "$ORGAWORK_REDIS_KEY"',
  );
}

export function readPersistenceMinioValue(plan: PersistenceAcceptancePlan): string {
  return runPersistenceDockerShell(
    'orgawork-minio',
    buildPersistenceAcceptanceEnvironment(plan),
    buildPersistenceMinioCommand('mc cat "acceptance/$ORGAWORK_BUCKET/$ORGAWORK_OBJECT_KEY"'),
  );
}

export function readPersistenceAcceptanceValues(
  plan: PersistenceAcceptancePlan,
): PersistenceAcceptanceValues {
  return {
    postgresql: readPersistencePostgreSqlValue(plan),
    redis: readPersistenceRedisValue(plan),
    minio: readPersistenceMinioValue(plan),
  };
}

export function assertPersistenceBucketPrivate(plan: PersistenceAcceptancePlan): void {
  const output = runPersistenceDockerShell(
    'orgawork-minio',
    buildPersistenceAcceptanceEnvironment(plan),
    buildPersistenceMinioCommand('mc anonymous get "acceptance/$ORGAWORK_BUCKET"'),
  );

  if (!output.toLowerCase().includes('private')) {
    throw new Error('Bucket فایل‌ها خصوصی نیست.');
  }
}

export function assertPersistenceAcceptanceValues(plan: PersistenceAcceptancePlan): void {
  const values = readPersistenceAcceptanceValues(plan);

  for (const value of [values.postgresql, values.redis, values.minio]) {
    if (value !== plan.markerValue) {
      throw new Error('محتوای پذیرش با مقدار مورد انتظار یکسان نیست.');
    }
  }

  assertPersistenceBucketPrivate(plan);
}

export function cleanupPersistenceAcceptanceData(plan: PersistenceAcceptancePlan): void {
  const environment = buildPersistenceAcceptanceEnvironment(plan);

  runPersistenceDockerShell(
    'orgawork-postgres',
    environment,
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "' +
      plan.postgresql.dropTableSql +
      '" >/dev/null',
  );
  runPersistenceDockerShell(
    'orgawork-redis',
    environment,
    'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli --raw DEL "$ORGAWORK_REDIS_KEY" >/dev/null',
  );
  runPersistenceDockerShell(
    'orgawork-minio',
    environment,
    buildPersistenceMinioCommand(
      'mc rm --force "acceptance/$ORGAWORK_BUCKET/$ORGAWORK_OBJECT_KEY" >/dev/null 2>&1 || true',
    ),
  );

  const tableCount = runPersistenceDockerShell(
    'orgawork-postgres',
    environment,
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SELECT COUNT(*) FROM pg_tables WHERE schemaname = \'public\' AND tablename = \'orgawork_persistence_acceptance\'"',
  );
  const redisExists = runPersistenceDockerShell(
    'orgawork-redis',
    environment,
    'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli --raw EXISTS "$ORGAWORK_REDIS_KEY"',
  );
  runPersistenceDockerShell(
    'orgawork-minio',
    environment,
    buildPersistenceMinioCommand(
      'if mc stat "acceptance/$ORGAWORK_BUCKET/$ORGAWORK_OBJECT_KEY" >/dev/null 2>&1; then exit 1; fi',
    ),
  );

  if (tableCount !== '0' || redisExists !== '0') {
    throw new Error('پاک‌سازی داده پذیرش کامل نشد.');
  }

  assertPersistenceBucketPrivate(plan);
}

function toPersistenceError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === 'string') {
    return new Error(value);
  }

  return new Error('خطای ناشناخته در پذیرش ماندگاری داده.');
}

export function runPersistenceAcceptance(): void {
  const markerId = 'p1411-' + randomUUID().replaceAll('-', '').slice(0, 24);
  const plan = buildPersistenceAcceptancePlan(markerId);

  assertSafePersistenceAcceptancePlan(plan);
  assertPersistenceContainersRunning();

  const initialVolumes = capturePersistenceVolumeIdentities();
  let acceptancePassed = false;
  let primaryError: Error | undefined;

  try {
    writePersistenceAcceptanceData(plan);
    assertPersistenceAcceptanceValues(plan);
    writePersistenceMessage('PRE_STOP_DATA: VERIFIED_3_OF_3');

    runPersistenceLifecycle('infra:stop');
    assertPersistenceContainersStopped();
    assertPersistenceVolumeIdentities(initialVolumes, capturePersistenceVolumeIdentities());
    writePersistenceMessage('STOP_STATE: VERIFIED');

    runPersistenceLifecycle('infra:start');
    assertPersistenceContainersRunning();
    assertPersistenceVolumeIdentities(initialVolumes, capturePersistenceVolumeIdentities());
    assertPersistenceAcceptanceValues(plan);
    acceptancePassed = true;
    writePersistenceMessage('POST_START_DATA: VERIFIED_3_OF_3');
  } catch (error) {
    primaryError = toPersistenceError(error);
  } finally {
    try {
      if (
        persistenceDataContainers.some(
          (containerName) => !isPersistenceContainerRunning(containerName),
        )
      ) {
        runPersistenceLifecycle('infra:start');
      }

      assertPersistenceContainersRunning();
      assertPersistenceVolumeIdentities(initialVolumes, capturePersistenceVolumeIdentities());
      cleanupPersistenceAcceptanceData(plan);
      writePersistenceMessage('ACCEPTANCE_DATA_CLEANUP: VERIFIED');
    } catch (cleanupError) {
      const normalizedCleanupError = toPersistenceError(cleanupError);

      if (primaryError === undefined) {
        primaryError = normalizedCleanupError;
      } else {
        primaryError = new Error(
          primaryError.message + ' | خطای بازیابی یا پاک‌سازی: ' + normalizedCleanupError.message,
        );
      }
    }
  }

  if (primaryError !== undefined) {
    throw primaryError;
  }

  if (!acceptancePassed) {
    throw new Error('پذیرش ماندگاری داده کامل نشد.');
  }

  writePersistenceMessage('=== P1.4.11 PERSISTENCE ACCEPTANCE PASSED ===');
  writePersistenceMessage('SERVICES: POSTGRESQL | REDIS | MINIO');
  writePersistenceMessage('LIFECYCLE: INFRA_STOP | INFRA_START');
  writePersistenceMessage('VOLUME_IDENTITIES: PRESERVED_3_OF_3');
  writePersistenceMessage('BUCKET_POLICY: PRIVATE');
  writePersistenceMessage('DESTRUCTIVE_CLEANUP: NOT_USED');
  writePersistenceMessage('ACCEPTANCE_DATA_RETAINED: NO');
}

const persistenceScriptPath = process.argv[1];
const isPersistenceDirectExecution =
  persistenceScriptPath !== undefined &&
  resolve(persistenceScriptPath) === fileURLToPath(import.meta.url);

if (isPersistenceDirectExecution) {
  try {
    runPersistenceAcceptance();
  } catch (error) {
    const normalizedError = toPersistenceError(error);
    process.stderr.write('خطای پذیرش ماندگاری: ' + normalizedError.message + '\n');
    process.exitCode = 1;
  }
}
