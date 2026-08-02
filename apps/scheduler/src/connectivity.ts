import {
  resolveApplicationConnectivityConfiguration,
  type ApplicationConnectivityConfiguration,
} from '@workspace/configuration';
import {
  probePostgreSqlConnectivity,
  type PostgreSqlConnectivityResult,
} from '@workspace/database';
import { probeRedisConnectivity, type RedisConnectivityResult } from '@workspace/queue';
import { probeMinioConnectivity, type MinioConnectivityResult } from '@workspace/storage';

export interface SchedulerConnectivityDependencies {
  readonly resolveConfiguration: () => ApplicationConnectivityConfiguration;
  readonly probePostgreSql: (
    configuration: ApplicationConnectivityConfiguration['postgresql'],
  ) => Promise<PostgreSqlConnectivityResult>;
  readonly probeRedis: (
    configuration: ApplicationConnectivityConfiguration['redis'],
  ) => Promise<RedisConnectivityResult>;
  readonly probeMinio: (
    configuration: ApplicationConnectivityConfiguration['minio'],
  ) => Promise<MinioConnectivityResult>;
  readonly now: () => Date;
}

export interface SchedulerConnectivityReport {
  readonly service: 'orgawork-scheduler';
  readonly event: 'connectivity-verified';
  readonly message: string;
  readonly status: 'connected';
  readonly services: {
    readonly postgresql: { readonly status: 'connected'; readonly operation: 'SELECT 1' };
    readonly redis: { readonly status: 'connected'; readonly operation: 'PING' };
    readonly minio: {
      readonly status: 'connected';
      readonly operation: 'HEAD_BUCKET';
      readonly bucket: string;
    };
  };
  readonly timestamp: string;
}

const defaultDependencies: SchedulerConnectivityDependencies = {
  resolveConfiguration: resolveApplicationConnectivityConfiguration,
  probePostgreSql: probePostgreSqlConnectivity,
  probeRedis: probeRedisConnectivity,
  probeMinio: probeMinioConnectivity,
  now: () => new Date(),
};

export async function verifySchedulerConnectivity(
  dependencies: SchedulerConnectivityDependencies = defaultDependencies,
): Promise<SchedulerConnectivityReport> {
  const configuration = dependencies.resolveConfiguration();

  try {
    const [postgresql, redis, minio] = await Promise.all([
      dependencies.probePostgreSql(configuration.postgresql),
      dependencies.probeRedis(configuration.redis),
      dependencies.probeMinio(configuration.minio),
    ]);

    return {
      service: 'orgawork-scheduler',
      event: 'connectivity-verified',
      message: 'اتصال زمان‌بند به سرویس‌های محلی تأیید شد.',
      status: 'connected',
      services: {
        postgresql: { status: postgresql.status, operation: postgresql.operation },
        redis: { status: redis.status, operation: redis.operation },
        minio: { status: minio.status, operation: minio.operation, bucket: minio.bucket },
      },
      timestamp: dependencies.now().toISOString(),
    };
  } catch {
    throw new Error('بررسی اتصال زمان‌بند به سرویس‌های محلی ناموفق بود.');
  }
}
