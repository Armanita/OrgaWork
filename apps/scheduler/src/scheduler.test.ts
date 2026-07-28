import { describe, expect, it } from 'vitest';

import { calculateNextRunAt, runScheduler, type SchedulerRunReport } from './scheduler.js';

describe('محاسبه موعد زمان‌بند', () => {
  it('موعد بعدی را از موعد برنامه‌ریزی‌شده محاسبه می‌کند', () => {
    const scheduledFor = new Date('2026-07-28T10:00:00.000Z');

    expect(calculateNextRunAt(scheduledFor, 60_000).toISOString()).toBe('2026-07-28T10:01:00.000Z');
  });

  it('موعد نامعتبر را رد می‌کند', () => {
    expect(() => calculateNextRunAt(new Date(Number.NaN), 60_000)).toThrow(
      'موعد فعلی زمان‌بند معتبر نیست.',
    );
  });

  it.each([0, -1, 12.5])('فاصله نامعتبر %s را رد می‌کند', (interval) => {
    expect(() => calculateNextRunAt(new Date('2026-07-28T10:00:00.000Z'), interval)).toThrow(
      'فاصله محاسبه موعد بعدی باید عددی صحیح و مثبت باشد.',
    );
  });
});

describe('چرخه زمان‌بند', () => {
  it('در حالت تک‌مرحله‌ای دقیقاً یک اجرا ثبت می‌کند', async () => {
    const controller = new AbortController();
    const reports: SchedulerRunReport[] = [];

    const instants = [
      '2026-07-28T10:00:00.000Z',
      '2026-07-28T10:00:00.010Z',
      '2026-07-28T10:00:00.025Z',
    ] as const;

    let instantIndex = 0;

    await runScheduler({
      name: 'orgawork-scheduler',
      intervalMilliseconds: 60_000,
      runOnce: true,
      signal: controller.signal,
      now: () => {
        const value = instants[instantIndex];

        if (value === undefined) {
          throw new Error('تعداد زمان‌های آزمایشی برای اجرای زمان‌بند کافی نیست.');
        }

        instantIndex += 1;

        return new Date(value);
      },
      onRun: (report) => {
        reports.push(report);
      },
    });

    expect(reports).toEqual([
      {
        service: 'orgawork-scheduler',
        sequence: 1,
        status: 'completed',
        scheduledFor: '2026-07-28T10:00:00.000Z',
        startedAt: '2026-07-28T10:00:00.010Z',
        completedAt: '2026-07-28T10:00:00.025Z',
        nextRunAt: '2026-07-28T10:01:00.000Z',
      },
    ]);
  });

  it('هنگام توقف پیش از اجرا هیچ گزارشی ایجاد نمی‌کند', async () => {
    const controller = new AbortController();
    const reports: SchedulerRunReport[] = [];

    controller.abort();

    await runScheduler({
      name: 'orgawork-scheduler',
      intervalMilliseconds: 60_000,
      runOnce: false,
      signal: controller.signal,
      onRun: (report) => {
        reports.push(report);
      },
    });

    expect(reports).toEqual([]);
  });

  it('پس از درخواست توقف وارد اجرای بعدی نمی‌شود', async () => {
    const controller = new AbortController();
    const reports: SchedulerRunReport[] = [];

    await runScheduler({
      name: 'orgawork-scheduler',
      intervalMilliseconds: 100,
      runOnce: false,
      signal: controller.signal,
      wait: () => {
        controller.abort();
        return Promise.resolve();
      },
      onRun: (report) => {
        reports.push(report);
      },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.sequence).toBe(1);
  });
});
