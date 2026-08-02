import { describe, expect, it } from 'vitest';

import { buildApplication } from '../application.js';
import type { ReadinessResponse } from './readiness.js';

describe('مسیر آمادگی رابط برنامه‌نویسی', () => {
  it('پاسخ آماده و بدون Cache برمی‌گرداند', async () => {
    const application = buildApplication();

    try {
      const response = await application.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['cache-control']).toBe('no-store');

      const payload = response.json<ReadinessResponse>();

      expect(payload.service).toBe('orgawork-api');
      expect(payload.status).toBe('ready');
      expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
    } finally {
      await application.close();
    }
  });

  it('هیچ فیلد ثبت‌نشده‌ای برنمی‌گرداند', async () => {
    const application = buildApplication();

    try {
      const response = await application.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(Object.keys(response.json<ReadinessResponse>()).sort()).toEqual([
        'service',
        'status',
        'timestamp',
      ]);
    } finally {
      await application.close();
    }
  });
});
