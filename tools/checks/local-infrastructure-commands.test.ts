import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertSafeInfrastructurePlan,
  buildComposeArguments,
  buildInfrastructureCommandPlan,
  infrastructureComposeFiles,
  infrastructureEnvironmentFile,
  infrastructureProjectName,
  persistentVolumeNames,
} from '../scripts/local-infrastructure-plan.js';

const read = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/g, '\n');

const packageJson = JSON.parse(read('package.json')) as {
  readonly scripts: Readonly<Record<string, string>>;
};

const commandScript = read('tools/scripts/local-infrastructure.ts');

describe('local infrastructure command contract', () => {
  it('uses one project, one environment file and all three Compose files', () => {
    expect(infrastructureProjectName).toBe('orgawork-data-local');
    expect(infrastructureEnvironmentFile).toBe('.env.local');
    expect(infrastructureComposeFiles).toEqual([
      'infra/compose/postgresql.compose.yaml',
      'infra/compose/redis.compose.yaml',
      'infra/compose/minio.compose.yaml',
    ]);

    expect(buildComposeArguments('ps', '-a')).toEqual([
      'compose',
      '--project-name',
      'orgawork-data-local',
      '--env-file',
      '.env.local',
      '-f',
      'infra/compose/postgresql.compose.yaml',
      '-f',
      'infra/compose/redis.compose.yaml',
      '-f',
      'infra/compose/minio.compose.yaml',
      'ps',
      '-a',
    ]);
  });

  it('starts healthy data services and waits for the detached bucket initializer', () => {
    const plan = buildInfrastructureCommandPlan('start');

    expect(plan).toHaveLength(3);
    expect(plan[0]?.arguments).toContain('--wait');
    expect(plan[0]?.arguments).toContain('--wait-timeout');
    expect(plan[0]?.arguments).toEqual(expect.arrayContaining(['postgres', 'redis', 'minio']));
    expect(plan[1]?.arguments).toEqual(
      expect.arrayContaining(['up', '-d', '--no-deps', '--force-recreate', 'minio_bucket_init']),
    );
    expect(plan[1]?.arguments).not.toContain('--abort-on-container-exit');
    expect(plan[1]?.arguments).not.toContain('--exit-code-from');
    expect(plan[2]).toEqual({
      description: 'انتظار کنترل‌شده برای پایان موفق Initializer خصوصی',
      arguments: ['wait', 'orgawork-minio-bucket-init'],
      expectedOutput: '0',
    });
  });

  it('stops services without deleting persistent resources', () => {
    const plan = buildInfrastructureCommandPlan('stop');

    expect(plan).toHaveLength(1);
    expect(plan[0]?.arguments.at(-1)).toBe('stop');
    expect(() => assertSafeInfrastructurePlan(plan)).not.toThrow();
  });

  it('cleans only Compose containers and network while preserving named volumes', () => {
    const plan = buildInfrastructureCommandPlan('cleanup');

    expect(plan).toHaveLength(1);
    expect(plan[0]?.arguments.at(-1)).toBe('down');
    expect(persistentVolumeNames).toEqual([
      'orgawork-postgres-data',
      'orgawork-redis-data',
      'orgawork-minio-data',
    ]);
    expect(() => assertSafeInfrastructurePlan(plan)).not.toThrow();
  });

  it('never permits volume deletion or remove-orphans in managed plans', () => {
    for (const action of ['start', 'stop', 'report', 'cleanup'] as const) {
      const plan = buildInfrastructureCommandPlan(action);
      const allArguments = plan.flatMap((step) => step.arguments);

      expect(allArguments).not.toContain('--volumes');
      expect(allArguments).not.toContain('-v');
      expect(allArguments).not.toContain('--remove-orphans');
      expect(() => assertSafeInfrastructurePlan(plan)).not.toThrow();
    }
  });

  it('exposes four explicit package commands', () => {
    expect(packageJson.scripts['infra:start']).toBe(
      'tsx tools/scripts/local-infrastructure.ts start',
    );
    expect(packageJson.scripts['infra:stop']).toBe(
      'tsx tools/scripts/local-infrastructure.ts stop',
    );
    expect(packageJson.scripts['infra:report']).toBe(
      'tsx tools/scripts/local-infrastructure.ts report',
    );
    expect(packageJson.scripts['infra:cleanup']).toBe(
      'tsx tools/scripts/local-infrastructure.ts cleanup',
    );
  });

  it('handles a missing MinIO container case-insensitively after cleanup', () => {
    expect(commandScript).toContain("error.message.toLowerCase().includes('no such object')");
  });

  it('validates the initializer exit code without attaching to its output stream', () => {
    expect(commandScript).toContain('step.expectedOutput !== undefined');
    expect(commandScript).toContain('خروجی فرمان Docker معتبر نیست');
    expect(commandScript).not.toContain('--abort-on-container-exit');
  });
  it('keeps report operations read-only and checks the private bucket and volumes', () => {
    expect(commandScript).toContain("buildComposeArguments('ps', '-a')");
    expect(commandScript).toContain('mc stat');
    expect(commandScript).toContain('mc anonymous get');
    expect(commandScript).toContain("['volume', 'inspect'");
    expect(commandScript).not.toContain('--remove-orphans');
    expect(commandScript).not.toContain("'--volumes'");
  });
});
