import { describe, expect, it, vi } from 'vitest';

import { buildApplication } from '../application.js';
import {
  type ApiConnectivityResponse,
  type ConnectivityRouteDependencies,
} from './connectivity.js';

const configuration = {
  postgresql: {
    host: '127.0.0.1',
    port: 5432,
    database: 'orgawork',
    user: 'orgawork',
    password: 'postgres-secret',
  },
  redis: { host: '127.0.0.1', port: 6379, password: 'redis-secret' },
  minio: {
    endpoint: 'http://127.0.0.1:9000',
    region: 'us-east-1',
    accessKeyId: 'orgawork-minio',
    secretAccessKey: 'minio-secret',
    bucket: 'orgawork-files',
  },
} as const;

describe('مسیر اتصال واقعی رابط برنامه‌نویسی', () => {
  it('هر سه Probe را اجرا و پاسخ بدون Secret برمی‌گرداند', async () => {
    const probePostgreSql = vi.fn(() =>
      Promise.resolve({
        service: 'postgresql' as const,
        status: 'connected' as const,
        operation: 'SELECT 1' as const,
        value: 1 as const,
      }),
    );
    const probeRedis = vi.fn(() =>
      Promise.resolve({
        service: 'redis' as const,
        status: 'connected' as const,
        operation: 'PING' as const,
        response: 'PONG' as const,
      }),
    );
    const probeMinio = vi.fn(() =>
      Promise.resolve({
        service: 'minio' as const,
        status: 'connected' as const,
        operation: 'HEAD_BUCKET' as const,
        bucket: 'orgawork-files',
      }),
    );

    const dependencies: ConnectivityRouteDependencies = {
      resolveConfiguration: () => configuration,
      probePostgreSql,
      probeRedis,
      probeMinio,
      now: () => new Date('2026-08-01T16:30:00.000Z'),
    };

    const application = buildApplication({ connectivityDependencies: dependencies });

    try {
      const response = await application.inject({ method: 'GET', url: '/connectivity' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json<ApiConnectivityResponse>()).toEqual({
        service: 'orgawork-api',
        status: 'connected',
        services: {
          postgresql: { status: 'connected', operation: 'SELECT 1' },
          redis: { status: 'connected', operation: 'PING' },
          minio: { status: 'connected', operation: 'HEAD_BUCKET', bucket: 'orgawork-files' },
        },
        timestamp: '2026-08-01T16:30:00.000Z',
      });
      expect(response.payload).not.toContain('postgres-secret');
      expect(response.payload).not.toContain('redis-secret');
      expect(response.payload).not.toContain('minio-secret');
      expect(probePostgreSql).toHaveBeenCalledOnce();
      expect(probePostgreSql).toHaveBeenCalledWith(configuration.postgresql);
      expect(probeRedis).toHaveBeenCalledOnce();
      expect(probeRedis).toHaveBeenCalledWith(configuration.redis);
      expect(probeMinio).toHaveBeenCalledOnce();
      expect(probeMinio).toHaveBeenCalledWith(configuration.minio);
    } finally {
      await application.close();
    }
  });
});
