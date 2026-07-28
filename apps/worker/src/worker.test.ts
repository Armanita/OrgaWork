import { describe, expect, it } from 'vitest';

import { runWorker, type WorkerCycleReport } from './worker.js';

describe('چرخه پردازشگر پس‌زمینه', () => {
  it('در حالت تک‌مرحله‌ای دقیقاً یک چرخه اجرا می‌کند', async () => {
    const controller = new AbortController();
    const reports: WorkerCycleReport[] = [];

    const instants = ['2026-07-28T10:00:00.000Z', '2026-07-28T10:00:00.125Z'] as const;

    let instantIndex = 0;

    await runWorker({
      name: 'orgawork-worker',
      pollingIntervalMilliseconds: 5000,
      runOnce: true,
      signal: controller.signal,
      now: () => {
        const value = instants[instantIndex];

        if (value === undefined) {
          throw new Error('تعداد زمان‌های آزمایشی برای اجرای چرخه کافی نیست.');
        }

        instantIndex += 1;

        return new Date(value);
      },
      onCycle: (report) => {
        reports.push(report);
      },
    });

    expect(reports).toEqual([
      {
        service: 'orgawork-worker',
        sequence: 1,
        status: 'completed',
        startedAt: '2026-07-28T10:00:00.000Z',
        completedAt: '2026-07-28T10:00:00.125Z',
      },
    ]);
  });

  it('هنگام توقف پیش از اجرا هیچ چرخه‌ای ایجاد نمی‌کند', async () => {
    const controller = new AbortController();
    const reports: WorkerCycleReport[] = [];

    controller.abort();

    await runWorker({
      name: 'orgawork-worker',
      pollingIntervalMilliseconds: 5000,
      runOnce: false,
      signal: controller.signal,
      onCycle: (report) => {
        reports.push(report);
      },
    });

    expect(reports).toEqual([]);
  });

  it('پس از درخواست توقف، وارد چرخه بعدی نمی‌شود', async () => {
    const controller = new AbortController();
    const reports: WorkerCycleReport[] = [];

    await runWorker({
      name: 'orgawork-worker',
      pollingIntervalMilliseconds: 100,
      runOnce: false,
      signal: controller.signal,
      wait: () => {
        controller.abort();
        return Promise.resolve();
      },
      onCycle: (report) => {
        reports.push(report);
      },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.sequence).toBe(1);
  });
});
