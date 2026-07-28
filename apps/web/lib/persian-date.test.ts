import { describe, expect, it } from 'vitest';

import { formatPersianDate } from './persian-date';

describe('نمایش تاریخ هجری شمسی', () => {
  it('آغاز سال ۱۴۰۳ را به‌درستی نمایش می‌دهد', () => {
    const value = new Date('2024-03-20T12:00:00.000Z');

    expect(formatPersianDate(value, 'Asia/Tehran')).toBe('۱۴۰۳/۰۱/۰۱');
  });

  it('فقط ارقام فارسی نمایش می‌دهد', () => {
    const value = new Date('2024-03-20T12:00:00.000Z');
    const result = formatPersianDate(value, 'Asia/Tehran');

    expect(result).not.toMatch(/[0-9]/u);
    expect(result).toMatch(/^[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}$/u);
  });

  it('تاریخ نامعتبر را نمی‌پذیرد', () => {
    expect(() => formatPersianDate(new Date(Number.NaN), 'Asia/Tehran')).toThrow(
      'تاریخ واردشده معتبر نیست.',
    );
  });

  it('منطقه زمانی خالی را نمی‌پذیرد', () => {
    const value = new Date('2024-03-20T12:00:00.000Z');

    expect(() => formatPersianDate(value, '   ')).toThrow('منطقه زمانی نمی‌تواند خالی باشد.');
  });
});
