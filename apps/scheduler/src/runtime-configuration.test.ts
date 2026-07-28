import { describe, expect, it } from 'vitest';

import { resolveSchedulerRuntimeConfiguration } from './runtime-configuration.js';

describe('پیکربندی زمان‌بند', () => {
  it('مقادیر پیش‌فرض را برمی‌گرداند', () => {
    expect(resolveSchedulerRuntimeConfiguration({})).toEqual({
      name: 'orgawork-scheduler',
      intervalMilliseconds: 60000,
      runOnce: false,
    });
  });

  it('مقادیر معتبر محیط اجرا را می‌پذیرد', () => {
    expect(
      resolveSchedulerRuntimeConfiguration({
        SCHEDULER_NAME: ' زمان‌بند-آزمایشی ',
        SCHEDULER_INTERVAL_MS: '250',
        SCHEDULER_RUN_ONCE: 'true',
      }),
    ).toEqual({
      name: 'زمان‌بند-آزمایشی',
      intervalMilliseconds: 250,
      runOnce: true,
    });
  });

  it.each(['0', '99', '86400001', '12.5', 'نامعتبر'])('فاصله نامعتبر %s را رد می‌کند', (value) => {
    expect(() =>
      resolveSchedulerRuntimeConfiguration({
        SCHEDULER_INTERVAL_MS: value,
      }),
    ).toThrow('فاصله اجرای زمان‌بند باید عددی صحیح بین ۱۰۰ تا ۸۶۴۰۰۰۰۰ میلی‌ثانیه باشد.');
  });

  it('مقدار نادرست اجرای تک‌مرحله‌ای را می‌پذیرد', () => {
    expect(
      resolveSchedulerRuntimeConfiguration({
        SCHEDULER_RUN_ONCE: 'false',
      }).runOnce,
    ).toBe(false);
  });

  it('مقدار ناشناخته اجرای تک‌مرحله‌ای را رد می‌کند', () => {
    expect(() =>
      resolveSchedulerRuntimeConfiguration({
        SCHEDULER_RUN_ONCE: 'بله',
      }),
    ).toThrow('مقدار اجرای تک‌مرحله‌ای زمان‌بند باید برابر درست یا نادرست باشد.');
  });
});
