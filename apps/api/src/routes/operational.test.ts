import { describe, expect, it } from 'vitest';
import { defaultMetricRegistry, type DependencyHealthCheck } from '@workspace/observability';
import { buildApplication } from '../application.js';

describe('مسیرهای عملیاتی API', () => {
  it('زنده‌بودن و سنجه‌ها را منتشر می‌کند', async () => {
    defaultMetricRegistry.reset();
    const application = buildApplication();
    try {
      const live = await application.inject({ method: 'GET', url: '/live' });
      expect(live.statusCode).toBe(200);
      expect(live.json()).toMatchObject({ status: 'alive' });
      await application.inject({ method: 'GET', url: '/health' });
      const metrics = await application.inject({ method: 'GET', url: '/metrics' });
      expect(metrics.statusCode).toBe(200);
      expect(metrics.body).toContain('orgawork_api_requests_total');
      expect(metrics.body).toContain('route="/health"');
    } finally {
      await application.close();
      defaultMetricRegistry.reset();
    }
  });

  it('شکست وابستگی و بازیابی را در Health منعکس می‌کند', async () => {
    let failing = true;
    const dependencies: readonly DependencyHealthCheck[] = [
      {
        name: 'postgresql',
        required: true,
        check: (): Promise<void> =>
          failing ? Promise.reject(new Error('offline')) : Promise.resolve(),
      },
    ];
    const application = buildApplication({ operationalHealthDependencies: dependencies });
    try {
      const failed = await application.inject({ method: 'GET', url: '/health/details' });
      expect(failed.statusCode).toBe(503);
      failing = false;
      const recovered = await application.inject({ method: 'GET', url: '/health/details' });
      expect(recovered.statusCode).toBe(200);
      expect(recovered.json()).toMatchObject({ status: 'healthy' });
    } finally {
      await application.close();
    }
  });
});
