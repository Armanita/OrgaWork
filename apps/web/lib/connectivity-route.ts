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

export interface WebConnectivityDependencies {
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

export interface WebConnectivitySuccessResponse {
  readonly service: 'orgawork-web';
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

export interface WebConnectivityFailureResponse {
  readonly service: 'orgawork-web';
  readonly status: 'unavailable';
  readonly message: string;
  readonly timestamp: string;
}

export type WebConnectivityResponse =
  WebConnectivitySuccessResponse | WebConnectivityFailureResponse;

const defaultDependencies: WebConnectivityDependencies = {
  resolveConfiguration: resolveApplicationConnectivityConfiguration,
  probePostgreSql: probePostgreSqlConnectivity,
  probeRedis: probeRedisConnectivity,
  probeMinio: probeMinioConnectivity,
  now: () => new Date(),
};

const responseHeaders = {
  'cache-control': 'no-store',
} as const;

export async function createWebConnectivityResponse(
  dependencies: WebConnectivityDependencies = defaultDependencies,
): Promise<Response> {
  const timestamp = dependencies.now().toISOString();

  try {
    const configuration = dependencies.resolveConfiguration();
    const [postgresql, redis, minio] = await Promise.all([
      dependencies.probePostgreSql(configuration.postgresql),
      dependencies.probeRedis(configuration.redis),
      dependencies.probeMinio(configuration.minio),
    ]);

    const body: WebConnectivitySuccessResponse = {
      service: 'orgawork-web',
      status: 'connected',
      services: {
        postgresql: { status: postgresql.status, operation: postgresql.operation },
        redis: { status: redis.status, operation: redis.operation },
        minio: { status: minio.status, operation: minio.operation, bucket: minio.bucket },
      },
      timestamp,
    };

    return Response.json(body, { status: 200, headers: responseHeaders });
  } catch {
    const body: WebConnectivityFailureResponse = {
      service: 'orgawork-web',
      status: 'unavailable',
      message: 'بررسی اتصال رابط کاربری به سرویس‌های محلی ناموفق بود.',
      timestamp,
    };

    return Response.json(body, { status: 503, headers: responseHeaders });
  }
}
