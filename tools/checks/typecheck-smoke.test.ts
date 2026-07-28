import { describe, expect, it } from 'vitest';

import { getCurrentStage } from './typecheck-smoke.js';

describe('بررسی پایه فضای کاری', () => {
  it('مرحله جاری را بدون تغییر برمی‌گرداند', () => {
    expect(getCurrentStage()).toEqual({
      code: 'P1.2',
      title: 'تنظیم ابزارهای پایه توسعه',
      completed: false,
    });
  });
});
