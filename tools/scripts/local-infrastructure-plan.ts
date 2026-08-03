export const infrastructureProjectName = 'orgawork-data-local';
export const infrastructureEnvironmentFile = '.env.local';

export const infrastructureComposeFiles = [
  'infra/compose/postgresql.compose.yaml',
  'infra/compose/redis.compose.yaml',
  'infra/compose/minio.compose.yaml',
] as const;

export const persistentVolumeNames = [
  'orgawork-postgres-data',
  'orgawork-redis-data',
  'orgawork-minio-data',
] as const;

export type InfrastructureAction = 'start' | 'stop' | 'report' | 'cleanup';

export interface DockerCommandStep {
  readonly description: string;
  readonly arguments: readonly string[];
  readonly expectedOutput?: string;
}

const composePrefix = [
  'compose',
  '--project-name',
  infrastructureProjectName,
  '--env-file',
  infrastructureEnvironmentFile,
  ...infrastructureComposeFiles.flatMap((file) => ['-f', file]),
] as const;

export function buildComposeArguments(...arguments_: readonly string[]): readonly string[] {
  return [...composePrefix, ...arguments_];
}

export function parseInfrastructureAction(value: string | undefined): InfrastructureAction {
  if (value === 'start' || value === 'stop' || value === 'report' || value === 'cleanup') {
    return value;
  }

  throw new Error('فرمان زیرساخت باید یکی از start، stop، report یا cleanup باشد.');
}

export function buildInfrastructureCommandPlan(
  action: InfrastructureAction,
): readonly DockerCommandStep[] {
  switch (action) {
    case 'start':
      return [
        {
          description: 'آغاز سرویس‌های داده و انتظار برای آمادگی آن‌ها',
          arguments: buildComposeArguments(
            'up',
            '-d',
            '--wait',
            '--wait-timeout',
            '120',
            'postgres',
            'redis',
            'minio',
          ),
        },
        {
          description: 'آغاز جداشده Initializer یک‌باره Bucket خصوصی',
          arguments: buildComposeArguments(
            'up',
            '-d',
            '--no-deps',
            '--force-recreate',
            'minio_bucket_init',
          ),
        },
        {
          description: 'انتظار کنترل‌شده برای پایان موفق Initializer خصوصی',
          arguments: ['wait', 'orgawork-minio-bucket-init'],
          expectedOutput: '0',
        },
      ];

    case 'stop':
      return [
        {
          description: 'توقف کنترل‌شده سرویس‌های زیرساخت',
          arguments: buildComposeArguments('stop'),
        },
      ];

    case 'cleanup':
      return [
        {
          description: 'حذف Containerها و شبکه Compose با حفظ Volumeهای پایدار',
          arguments: buildComposeArguments('down'),
        },
      ];

    case 'report':
      return [];
  }
}

export function assertSafeInfrastructurePlan(plan: readonly DockerCommandStep[]): void {
  const forbiddenArguments = new Set(['--volumes', '-v', '--remove-orphans']);

  for (const step of plan) {
    for (const argument of step.arguments) {
      if (forbiddenArguments.has(argument)) {
        throw new Error(`آرگومان ناامن در برنامه فرمان زیرساخت پیدا شد: ${argument}`);
      }
    }
  }
}
