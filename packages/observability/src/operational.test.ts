import { describe, expect, it } from 'vitest';
import {
  evaluateBaselineAlerts,
  evaluateOperationalHealth,
  HealthStateTracker,
  HeartbeatRegistry,
  MetricRegistry,
} from './operational.js';

describe('سنجه و سلامت عملیاتی', () => {
  it('سنجه‌های API، داده، صف و فرایند را منتشر می‌کند', () => {
    const registry = new MetricRegistry();
    registry.recordApiRequest('GET', '/cases/123?view=full', 200, 12);
    registry.recordDatabaseOperation('transaction', 'success', 5);
    registry.recordQueueOperation('reminders', 'dequeue', 'success', 3);
    registry.setQueueDepth('reminders', 7);
    registry.recordProcessCycle('worker', 'success', 8);
    const output = registry.renderPrometheus();
    expect(output).toContain(
      'orgawork_api_requests_total{method="GET",route="/cases/:id",status="200"} 1',
    );
    expect(output).toContain('orgawork_database_operations_total');
    expect(output).toContain('orgawork_queue_depth{queue="reminders"} 7');
    expect(output).toContain('orgawork_process_cycles_total');
  });

  it('ضربان تازه، قدیمی و مفقود را تشخیص می‌دهد', () => {
    const registry = new HeartbeatRegistry(new MetricRegistry());
    registry.record('orgawork-worker', new Date('2026-08-03T00:00:00.000Z'));
    expect(
      registry.inspect('orgawork-worker', 60000, new Date('2026-08-03T00:00:30.000Z')).status,
    ).toBe('healthy');
    expect(
      registry.inspect('orgawork-worker', 10000, new Date('2026-08-03T00:00:30.000Z')).status,
    ).toBe('stale');
    expect(registry.inspect('orgawork-scheduler', 10000).status).toBe('missing');
  });

  it('شکست وابستگی و بازیابی سلامت را ثبت می‌کند', async () => {
    let failing = true;
    const dependency = {
      name: 'postgresql',
      required: true,
      check: (): Promise<void> =>
        failing ? Promise.reject(new Error('secret-must-not-leak')) : Promise.resolve(),
    };
    const tracker = new HealthStateTracker();
    const failed = await evaluateOperationalHealth([dependency], { metrics: new MetricRegistry() });
    expect(failed.status).toBe('unhealthy');
    expect(JSON.stringify(failed)).not.toContain('secret-must-not-leak');
    expect(tracker.update(failed.status)).toBeUndefined();
    failing = false;
    const recovered = await evaluateOperationalHealth([dependency], {
      metrics: new MetricRegistry(),
    });
    expect(tracker.update(recovered.status, new Date('2026-08-03T00:01:00.000Z'))).toEqual({
      previous: 'unhealthy',
      current: 'healthy',
      changedAt: '2026-08-03T00:01:00.000Z',
    });
  });

  it('هشدارهای پایه را ارزیابی می‌کند', () => {
    const alerts = evaluateBaselineAlerts({
      health: {
        service: 'orgawork-api',
        status: 'unhealthy',
        timestamp: '2026-08-03T00:00:00.000Z',
        dependencies: [
          {
            name: 'postgresql',
            required: true,
            status: 'unhealthy',
            durationMilliseconds: 2,
            code: 'DEPENDENCY_CHECK_FAILED',
          },
        ],
      },
      heartbeats: [
        {
          process: 'orgawork-worker',
          status: 'stale',
          maximumAgeMilliseconds: 10000,
          recordedAt: '2026-08-03T00:00:00.000Z',
          ageMilliseconds: 30000,
        },
      ],
      apiErrorRate: 0.2,
    });
    expect(alerts.map((alert) => alert.code)).toEqual([
      'DEPENDENCY_UNHEALTHY',
      'PROCESS_HEARTBEAT_STALE',
      'API_ERROR_RATE_HIGH',
    ]);
  });
});
