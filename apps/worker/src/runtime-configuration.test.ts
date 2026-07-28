import { describe, expect, it } from 'vitest';

import { resolveWorkerRuntimeConfiguration } from './runtime-configuration.js';

describe('پیکربندی پردازشگر پس‌زمینه', () => {
  it('مقادیر پیش‌فرض را برمی‌گرداند', () => {
    expect(resolveWorkerRuntimeConfiguration({})).toEqual({
      name: 'orgawork-worker',
      pollingIntervalMilliseconds: 5000,
      runOnce: false,
    });
  });

  it('مقادیر معتبر محیط اجرا را می‌پذیرد', () => {
    expect(
      resolveWorkerRuntimeConfiguration({
        WORKER_NAME: ' پردازشگر-آزمایشی ',
        WORKER_POLL_INTERVAL_MS: '250',
        WORKER_RUN_ONCE: 'true',
      }),
    ).toEqual({
      name: 'پردازشگر-آزمایشی',
      pollingIntervalMilliseconds: 250,
      runOnce: true,
    });
  });

  it.each(['0', '99', '300001', '12.5', 'نامعتبر'])(
    'فاصله بررسی نامعتبر %s را رد می‌کند',
    (value) => {
      expect(() =>
        resolveWorkerRuntimeConfiguration({
          WORKER_POLL_INTERVAL_MS: value,
        }),
      ).toThrow('فاصله بررسی پردازشگر باید عددی صحیح بین ۱۰۰ تا ۳۰۰۰۰۰ میلی‌ثانیه باشد.');
    },
  );

  it('مقدار نادرست اجرای تک‌مرحله‌ای را می‌پذیرد', () => {
    expect(
      resolveWorkerRuntimeConfiguration({
        WORKER_RUN_ONCE: 'false',
      }).runOnce,
    ).toBe(false);
  });

  it('مقدار ناشناخته اجرای تک‌مرحله‌ای را رد می‌کند', () => {
    expect(() =>
      resolveWorkerRuntimeConfiguration({
        WORKER_RUN_ONCE: 'بله',
      }),
    ).toThrow('مقدار اجرای تک‌مرحله‌ای باید برابر درست یا نادرست باشد.');
  });
});
