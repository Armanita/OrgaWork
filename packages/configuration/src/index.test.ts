import { describe, expect, it } from 'vitest';

import { resolveApplicationConnectivityConfiguration } from './index.js';

const requiredSecrets = {
  POSTGRES_PASSWORD: 'postgres-secret',
  REDIS_PASSWORD: 'redis-secret',
  MINIO_ROOT_PASSWORD: 'minio-secret',
} as const;

describe('پیکربندی مشترک اتصال برنامه‌ها', () => {
  it('مقادیر عمومی پیش‌فرض و Secretهای محیط اجرا را ترکیب می‌کند', () => {
    expect(resolveApplicationConnectivityConfiguration(requiredSecrets)).toEqual({
      postgresql: {
        host: '127.0.0.1',
        port: 5432,
        database: 'orgawork',
        user: 'orgawork',
        password: 'postgres-secret',
      },
      redis: {
        host: '127.0.0.1',
        port: 6379,
        password: 'redis-secret',
      },
      minio: {
        endpoint: 'http://127.0.0.1:9000',
        region: 'us-east-1',
        accessKeyId: 'orgawork-minio',
        secretAccessKey: 'minio-secret',
        bucket: 'orgawork-files',
      },
    });
  });

  it('مقادیر معتبر محیط اجرا را Trim و اعمال می‌کند', () => {
    expect(
      resolveApplicationConnectivityConfiguration({
        ...requiredSecrets,
        POSTGRES_HOST: ' database.local ',
        POSTGRES_PORT: ' 5544 ',
        POSTGRES_DB: ' orgawork_test ',
        POSTGRES_USER: ' probe_user ',
        POSTGRES_PASSWORD: ' postgres-override ',
        REDIS_HOST: ' cache.local ',
        REDIS_PORT: ' 6380 ',
        REDIS_PASSWORD: ' redis-override ',
        MINIO_HOST: ' storage.local ',
        MINIO_API_PORT: ' 9100 ',
        MINIO_ROOT_USER: ' probe-access ',
        MINIO_ROOT_PASSWORD: ' minio-override ',
        MINIO_BUCKET: ' private-files ',
      }),
    ).toEqual({
      postgresql: {
        host: 'database.local',
        port: 5544,
        database: 'orgawork_test',
        user: 'probe_user',
        password: 'postgres-override',
      },
      redis: {
        host: 'cache.local',
        port: 6380,
        password: 'redis-override',
      },
      minio: {
        endpoint: 'http://storage.local:9100',
        region: 'us-east-1',
        accessKeyId: 'probe-access',
        secretAccessKey: 'minio-override',
        bucket: 'private-files',
      },
    });
  });

  it('نبودن هر Secret الزامی را بدون نمایش مقدار رد می‌کند', () => {
    expect(() =>
      resolveApplicationConnectivityConfiguration({
        REDIS_PASSWORD: 'redis-secret',
        MINIO_ROOT_PASSWORD: 'minio-secret',
      }),
    ).toThrow('POSTGRES_PASSWORD');

    expect(() =>
      resolveApplicationConnectivityConfiguration({
        POSTGRES_PASSWORD: 'postgres-secret',
        MINIO_ROOT_PASSWORD: 'minio-secret',
      }),
    ).toThrow('REDIS_PASSWORD');

    expect(() =>
      resolveApplicationConnectivityConfiguration({
        POSTGRES_PASSWORD: 'postgres-secret',
        REDIS_PASSWORD: 'redis-secret',
      }),
    ).toThrow('MINIO_ROOT_PASSWORD');
  });

  it('درگاه‌های نامعتبر را رد می‌کند', () => {
    expect(() =>
      resolveApplicationConnectivityConfiguration({
        ...requiredSecrets,
        POSTGRES_PORT: '0',
      }),
    ).toThrow('POSTGRES_PORT');

    expect(() =>
      resolveApplicationConnectivityConfiguration({
        ...requiredSecrets,
        REDIS_PORT: '65536',
      }),
    ).toThrow('REDIS_PORT');

    expect(() =>
      resolveApplicationConnectivityConfiguration({
        ...requiredSecrets,
        MINIO_API_PORT: '12.5',
      }),
    ).toThrow('MINIO_API_PORT');
  });
});
