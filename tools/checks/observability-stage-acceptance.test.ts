import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { MetricRegistry } from '../../packages/observability/src/operational.js';

const files = {
  app: readFileSync('apps/api/src/application.ts', 'utf8'),
  db: readFileSync('packages/database/src/observability.ts', 'utf8'),
  queue: readFileSync('packages/queue/src/observability.ts', 'utf8'),
  worker: readFileSync('apps/worker/src/main.ts', 'utf8'),
  scheduler: readFileSync('apps/scheduler/src/main.ts', 'utf8'),
};

describe('پذیرش نهایی P1.7', () => {
  it('سنجه‌های همه اجزای عملیاتی را در خروجی واقعی دارد', () => {
    const registry = new MetricRegistry();

    registry.recordApiRequest('GET', '/health', 200, 4);
    registry.recordDatabaseOperation('query', 'success', 3);
    registry.recordQueueOperation('reminders', 'dequeue', 'success', 2);
    registry.recordProcessCycle('worker', 'success', 1);

    const output = registry.renderPrometheus();

    expect(output).toContain('orgawork_api_requests_total');
    expect(output).toContain('orgawork_database_operations_total');
    expect(output).toContain('orgawork_queue_operations_total');
    expect(output).toContain('orgawork_process_cycles_total');
    expect(files.db).toContain('recordDatabaseOperation');
    expect(files.queue).toContain('recordQueueOperation');
    expect(files.worker).toContain('defaultHeartbeatRegistry.record');
    expect(files.scheduler).toContain('defaultHeartbeatRegistry.record');
  });

  it('Liveness و Health و Metrics ثبت شده‌اند', () => {
    expect(files.app).toContain('createOperationalRoutes');
    const routes = readFileSync('apps/api/src/routes/operational.ts', 'utf8');

    expect(routes).toContain("'/live'");
    expect(routes).toContain("'/metrics'");
    expect(routes).toContain("'/health/details'");
  });

  it('داشبورد و هشدار پایه وجود دارند', () => {
    const dashboard = JSON.parse(
      readFileSync('infra/observability/p1.7-dashboard.json', 'utf8'),
    ) as {
      readonly panels: readonly {
        readonly metric: string;
      }[];
    };
    const alerts = JSON.parse(readFileSync('infra/observability/p1.7-alerts.json', 'utf8')) as {
      readonly rules: readonly {
        readonly code: string;
      }[];
    };

    expect(dashboard.panels.map((item) => item.metric)).toContain('orgawork_dependency_health');
    expect(alerts.rules.map((item) => item.code)).toContain('DEPENDENCY_UNHEALTHY');
  });
});
