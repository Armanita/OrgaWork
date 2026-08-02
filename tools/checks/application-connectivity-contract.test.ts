import { describe, expect, it } from 'vitest';

import {
  applicationConnectivityPlan,
  assertApplicationConnectivityPlan,
  connectivityClientPlan,
  connectivityServiceNames,
  deferredConnectivityScope,
} from './application-connectivity-plan.js';

describe('قرارداد اتصال واقعی برنامه‌ها به زیرساخت محلی', () => {
  it('سه Client خواندنی را با نسخه ثابت انتخاب می‌کند', () => {
    expect(connectivityClientPlan).toEqual([
      expect.objectContaining({
        service: 'postgresql',
        workspace: '@workspace/database',
        clientPackage: 'pg',
        clientVersion: '8.22.0',
        typePackage: '@types/pg',
        typeVersion: '8.20.0',
        probeOperation: 'SELECT 1',
        readOnly: true,
      }),
      expect.objectContaining({
        service: 'redis',
        workspace: '@workspace/queue',
        clientPackage: 'redis',
        clientVersion: '6.1.0',
        probeOperation: 'PING',
        readOnly: true,
      }),
      expect.objectContaining({
        service: 'minio',
        workspace: '@workspace/storage',
        clientPackage: '@aws-sdk/client-s3',
        clientVersion: '3.1090.0',
        probeOperation: 'HeadBucketCommand',
        readOnly: true,
      }),
    ]);
  });

  it('هر چهار برنامه را با کانال شاهد مستقل پوشش می‌دهد', () => {
    expect(applicationConnectivityPlan.map((entry) => entry.application)).toEqual([
      'web',
      'api',
      'worker',
      'scheduler',
    ]);
    expect(new Set(applicationConnectivityPlan.map((entry) => entry.evidenceChannel)).size).toBe(3);
  });

  it('برای Web و API شاهد HTTP و برای Worker و Scheduler شاهد رخداد تعریف می‌کند', () => {
    expect(applicationConnectivityPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ application: 'web', executionPhase: 'request' }),
        expect.objectContaining({ application: 'api', executionPhase: 'request' }),
        expect.objectContaining({ application: 'worker', executionPhase: 'startup' }),
        expect.objectContaining({ application: 'scheduler', executionPhase: 'startup' }),
      ]),
    );
  });

  it('Probeها را به PostgreSQL، Redis و MinIO محدود می‌کند', () => {
    expect(connectivityServiceNames).toEqual(['postgresql', 'redis', 'minio']);
    expect(connectivityClientPlan.every((entry) => entry.readOnly)).toBe(true);
  });

  it('Migration، Schema، RLS و عملیات تجاری را به مراحل بعد واگذار می‌کند', () => {
    expect(deferredConnectivityScope).toEqual(
      expect.arrayContaining([
        'database migrations',
        'database schema changes',
        'row-level security',
        'business data reads and writes',
        'persistence acceptance after restart',
      ]),
    );
  });

  it('تمام قیود ساختاری برنامه را معتبر نگه می‌دارد', () => {
    expect(() => assertApplicationConnectivityPlan()).not.toThrow();
  });
});
