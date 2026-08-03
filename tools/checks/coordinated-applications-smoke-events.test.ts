import { describe, expect, it } from 'vitest';

import {
  parseLifecycleEvents,
  validateSchedulerProcessOutput,
  validateWorkerProcessOutput,
  type CapturedProcessOutput,
} from './coordinated-applications-smoke-events.js';

function output(
  name: string,
  events: readonly Readonly<Record<string, unknown>>[],
): CapturedProcessOutput {
  return {
    name,
    stdout: `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    stderr: '',
  };
}

const timestamp = '2026-08-03T16:38:46.611Z';

describe('coordinated application lifecycle output', () => {
  it('accepts the three real worker lifecycle events', () => {
    const running = output('پردازشگر پس‌زمینه', [
      {
        service: 'orgawork-worker',
        event: 'worker-started',
        attributes: {
          pollingIntervalMilliseconds: 250,
          runOnce: true,
        },
      },
      {
        service: 'orgawork-worker',
        event: 'worker-cycle-completed',
        attributes: {
          service: 'orgawork-worker',
          sequence: 1,
          status: 'completed',
          startedAt: timestamp,
          completedAt: timestamp,
          heartbeatAt: timestamp,
        },
      },
      {
        service: 'orgawork-worker',
        event: 'worker-stopped',
        attributes: {
          reason: 'run-once',
        },
      },
    ]);

    expect(() => validateWorkerProcessOutput(running, 0)).not.toThrow();
  });

  it('accepts the three real scheduler lifecycle events', () => {
    const scheduledFor = '2026-08-03T16:38:46.611Z';
    const nextRunAt = '2026-08-03T16:38:46.861Z';

    const running = output('زمان‌بند', [
      {
        service: 'orgawork-scheduler',
        event: 'scheduler-started',
        attributes: {
          intervalMilliseconds: 250,
          runOnce: true,
        },
      },
      {
        service: 'orgawork-scheduler',
        event: 'schedule-run-completed',
        attributes: {
          service: 'orgawork-scheduler',
          sequence: 1,
          status: 'completed',
          startedAt: timestamp,
          completedAt: timestamp,
          heartbeatAt: timestamp,
          scheduledFor,
          nextRunAt,
        },
      },
      {
        service: 'orgawork-scheduler',
        event: 'scheduler-stopped',
        attributes: {
          reason: 'run-once',
        },
      },
    ]);

    expect(() => validateSchedulerProcessOutput(running, 0)).not.toThrow();
  });

  it('rejects the obsolete two-event lifecycle contract', () => {
    const running = output('پردازشگر پس‌زمینه', [
      {
        service: 'orgawork-worker',
        event: 'worker-cycle-completed',
        attributes: {},
      },
      {
        service: 'orgawork-worker',
        event: 'worker-stopped',
        attributes: {},
      },
    ]);

    expect(() =>
      parseLifecycleEvents(running, ['worker-started', 'worker-cycle-completed', 'worker-stopped']),
    ).toThrow('باید دقیقاً 3 رخداد ثبت کند');
  });

  it('rejects lifecycle events in the wrong order', () => {
    const running = output('پردازشگر پس‌زمینه', [
      {
        service: 'orgawork-worker',
        event: 'worker-cycle-completed',
        attributes: {},
      },
      {
        service: 'orgawork-worker',
        event: 'worker-started',
        attributes: {},
      },
      {
        service: 'orgawork-worker',
        event: 'worker-stopped',
        attributes: {},
      },
    ]);

    expect(() =>
      parseLifecycleEvents(running, ['worker-started', 'worker-cycle-completed', 'worker-stopped']),
    ).toThrow('ترتیب رخدادهای پردازشگر پس‌زمینه معتبر نیست');
  });

  it('rejects a nonzero process exit code', () => {
    const running: CapturedProcessOutput = {
      name: 'پردازشگر پس‌زمینه',
      stdout: '',
      stderr: 'controlled failure',
    };

    expect(() => validateWorkerProcessOutput(running, 1)).toThrow('پردازشگر پس‌زمینه متوقف شد');
  });
});
