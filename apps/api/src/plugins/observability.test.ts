import { describe, expect, it } from 'vitest';

import { buildApplication } from '../application.js';

describe('مشاهده‌پذیری رابط برنامه‌نویسی', () => {
  it('شناسه درخواست، همبستگی و traceparent را برمی‌گرداند', async () => {
    const application = buildApplication();

    try {
      const response = await application.inject({
        method: 'GET',
        url: '/health',
        headers: {
          'x-request-id': '11111111-1111-4111-8111-111111111111',
          'x-correlation-id': '22222222-2222-4222-8222-222222222222',
          traceparent: '00-33333333333333333333333333333333-4444444444444444-01',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBe('11111111-1111-4111-8111-111111111111');
      expect(response.headers['x-correlation-id']).toBe('22222222-2222-4222-8222-222222222222');
      expect(response.headers['traceparent']).toMatch(
        /^00-33333333333333333333333333333333-[0-9a-f]{16}-01$/u,
      );
    } finally {
      await application.close();
    }
  });

  it('برای سرآیند نامعتبر شناسه امن تازه تولید می‌کند', async () => {
    const application = buildApplication();

    try {
      const response = await application.inject({
        method: 'GET',
        url: '/health',
        headers: {
          'x-request-id': 'invalid',
          traceparent: 'invalid',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/u);
      expect(response.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
    } finally {
      await application.close();
    }
  });
});
