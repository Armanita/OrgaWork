import { describe, expect, it } from 'vitest';

import { buildApplication } from './application.js';
import type { HealthResponse } from './routes/health.js';

describe('برنامه رابط برنامه‌نویسی', () => {
  it('مسیر سلامت را با پاسخ معتبر ارائه می‌کند', async () => {
    const application = buildApplication();

    try {
      const response = await application.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['cache-control']).toBe('no-store');

      const payload = response.json<HealthResponse>();

      expect(payload.service).toBe('orgawork-api');
      expect(payload.status).toBe('ok');
      expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
    } finally {
      await application.close();
    }
  });

  it('برای مسیر ناشناخته پاسخ پیدا نشد برمی‌گرداند', async () => {
    const application = buildApplication();

    try {
      const response = await application.inject({
        method: 'GET',
        url: '/unknown',
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await application.close();
    }
  });
});
