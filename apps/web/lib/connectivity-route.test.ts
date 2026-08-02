import { describe, expect, it, vi } from 'vitest';

import {
  createWebConnectivityResponse,
  type WebConnectivityDependencies,
  type WebConnectivityResponse,
} from './connectivity-route';

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

function createDependencies(): WebConnectivityDependencies {
  return {
    resolveConfiguration: () => configuration,
    probePostgreSql: vi.fn(() =>
      Promise.resolve({
        service: 'postgresql' as const,
        status: 'connected' as const,
        operation: 'SELECT 1' as const,
        value: 1 as const,
      }),
    ),
    probeRedis: vi.fn(() =>
      Promise.resolve({
        service: 'redis' as const,
        status: 'connected' as const,
        operation: 'PING' as const,
        response: 'PONG' as const,
      }),
    ),
    probeMinio: vi.fn(() =>
      Promise.resolve({
        service: 'minio' as const,
        status: 'connected' as const,
        operation: 'HEAD_BUCKET' as const,
        bucket: 'orgawork-files',
      }),
    ),
    now: () => new Date('2026-08-01T17:15:00.000Z'),
  };
}

describe('مسیر اتصال واقعی رابط کاربری', () => {
  it('سه Probe را اجرا و پاسخ موفق بدون Secret برمی‌گرداند', async () => {
    const dependencies = createDependencies();
    const response = await createWebConnectivityResponse(dependencies);
    const body = (await response.json()) as WebConnectivityResponse;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      service: 'orgawork-web',
      status: 'connected',
      services: {
        postgresql: { status: 'connected', operation: 'SELECT 1' },
        redis: { status: 'connected', operation: 'PING' },
        minio: { status: 'connected', operation: 'HEAD_BUCKET', bucket: 'orgawork-files' },
      },
      timestamp: '2026-08-01T17:15:00.000Z',
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('postgres-secret');
    expect(serialized).not.toContain('redis-secret');
    expect(serialized).not.toContain('minio-secret');
    expect(dependencies.probePostgreSql).toHaveBeenCalledWith(configuration.postgresql);
    expect(dependencies.probeRedis).toHaveBeenCalledWith(configuration.redis);
    expect(dependencies.probeMinio).toHaveBeenCalledWith(configuration.minio);
  });

  it('خطای شامل Secret را با پاسخ عمومی و کد ۵۰۳ جایگزین می‌کند', async () => {
    const failingDependencies: WebConnectivityDependencies = {
      ...createDependencies(),
      probeMinio: vi.fn(() => Promise.reject(new Error('minio-secret'))),
    };

    const response = await createWebConnectivityResponse(failingDependencies);
    const body = (await response.json()) as WebConnectivityResponse;
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      service: 'orgawork-web',
      status: 'unavailable',
      message: 'بررسی اتصال رابط کاربری به سرویس‌های محلی ناموفق بود.',
      timestamp: '2026-08-01T17:15:00.000Z',
    });
    expect(serialized).not.toContain('minio-secret');
  });
});
