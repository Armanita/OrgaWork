import { describe, expect, it, vi } from 'vitest';

import {
  verifySchedulerConnectivity,
  type SchedulerConnectivityDependencies,
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

function createDependencies(): SchedulerConnectivityDependencies {
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
    now: () => new Date('2026-08-01T17:00:00.000Z'),
  };
}

describe('اتصال واقعی زمان‌بند', () => {
  it('سه Probe را اجرا و رخداد بدون Secret برمی‌گرداند', async () => {
    const dependencies = createDependencies();
    const report = await verifySchedulerConnectivity(dependencies);

    expect(report).toEqual({
      service: 'orgawork-scheduler',
      event: 'connectivity-verified',
      message: 'اتصال زمان‌بند به سرویس‌های محلی تأیید شد.',
      status: 'connected',
      services: {
        postgresql: { status: 'connected', operation: 'SELECT 1' },
        redis: { status: 'connected', operation: 'PING' },
        minio: { status: 'connected', operation: 'HEAD_BUCKET', bucket: 'orgawork-files' },
      },
      timestamp: '2026-08-01T17:00:00.000Z',
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('postgres-secret');
    expect(serialized).not.toContain('redis-secret');
    expect(serialized).not.toContain('minio-secret');
    expect(dependencies.probePostgreSql).toHaveBeenCalledWith(configuration.postgresql);
    expect(dependencies.probeRedis).toHaveBeenCalledWith(configuration.redis);
    expect(dependencies.probeMinio).toHaveBeenCalledWith(configuration.minio);
  });

  it('جزئیات خطای شامل Secret را با پیام عمومی جایگزین می‌کند', async () => {
    const failingDependencies: SchedulerConnectivityDependencies = {
      ...createDependencies(),
      probeMinio: vi.fn(() => Promise.reject(new Error('minio-secret'))),
    };

    try {
      await verifySchedulerConnectivity(failingDependencies);
      throw new Error('انتظار می‌رفت بررسی اتصال ناموفق شود.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);

      if (!(error instanceof Error)) {
        throw error;
      }

      expect(error.message).toBe('بررسی اتصال زمان‌بند به سرویس‌های محلی ناموفق بود.');
      expect(error.message).not.toContain('minio-secret');
    }
  });
});
