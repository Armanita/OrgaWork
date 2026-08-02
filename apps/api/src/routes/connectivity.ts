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
import type { FastifyInstance } from 'fastify';

export interface ConnectivityRouteDependencies {
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

export interface ApiConnectivityResponse {
  readonly service: 'orgawork-api';
  readonly status: 'connected';
  readonly services: {
    readonly postgresql: {
      readonly status: 'connected';
      readonly operation: 'SELECT 1';
    };
    readonly redis: {
      readonly status: 'connected';
      readonly operation: 'PING';
    };
    readonly minio: {
      readonly status: 'connected';
      readonly operation: 'HEAD_BUCKET';
      readonly bucket: string;
    };
  };
  readonly timestamp: string;
}

const defaultDependencies: ConnectivityRouteDependencies = {
  resolveConfiguration: resolveApplicationConnectivityConfiguration,
  probePostgreSql: probePostgreSqlConnectivity,
  probeRedis: probeRedisConnectivity,
  probeMinio: probeMinioConnectivity,
  now: () => new Date(),
};

export function createConnectivityRoute(
  dependencies: ConnectivityRouteDependencies = defaultDependencies,
): (application: FastifyInstance) => void {
  return function connectivityRoute(application: FastifyInstance): void {
    application.get('/connectivity', async (_request, reply): Promise<ApiConnectivityResponse> => {
      const configuration = dependencies.resolveConfiguration();
      const [postgresql, redis, minio] = await Promise.all([
        dependencies.probePostgreSql(configuration.postgresql),
        dependencies.probeRedis(configuration.redis),
        dependencies.probeMinio(configuration.minio),
      ]);

      reply.header('cache-control', 'no-store');

      return {
        service: 'orgawork-api',
        status: 'connected',
        services: {
          postgresql: { status: postgresql.status, operation: postgresql.operation },
          redis: { status: redis.status, operation: redis.operation },
          minio: {
            status: minio.status,
            operation: minio.operation,
            bucket: minio.bucket,
          },
        },
        timestamp: dependencies.now().toISOString(),
      };
    });
  };
}
