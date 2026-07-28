export interface SchedulerRunReport {
  readonly service: string;
  readonly sequence: number;
  readonly status: 'completed';
  readonly scheduledFor: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly nextRunAt: string;
}

export interface SchedulerRunOptions {
  readonly name: string;
  readonly intervalMilliseconds: number;
  readonly runOnce: boolean;
  readonly signal: AbortSignal;
  readonly now?: () => Date;
  readonly wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  readonly onRun?: (report: SchedulerRunReport) => void | Promise<void>;
}

export function calculateNextRunAt(scheduledFor: Date, intervalMilliseconds: number): Date {
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new RangeError('موعد فعلی زمان‌بند معتبر نیست.');
  }

  if (!Number.isInteger(intervalMilliseconds) || intervalMilliseconds < 1) {
    throw new RangeError('فاصله محاسبه موعد بعدی باید عددی صحیح و مثبت باشد.');
  }

  return new Date(scheduledFor.getTime() + intervalMilliseconds);
}

function waitForDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    function finish(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }

    const timer = setTimeout(finish, milliseconds);

    signal.addEventListener('abort', finish, {
      once: true,
    });
  });
}

export async function runScheduler(options: SchedulerRunOptions): Promise<void> {
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? waitForDelay;

  let sequence = 0;
  let scheduledFor = now();

  while (!options.signal.aborted) {
    sequence += 1;

    const startedAt = now();
    const completedAt = now();
    const nextRunAt = calculateNextRunAt(scheduledFor, options.intervalMilliseconds);

    await options.onRun?.({
      service: options.name,
      sequence,
      status: 'completed',
      scheduledFor: scheduledFor.toISOString(),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      nextRunAt: nextRunAt.toISOString(),
    });

    if (options.runOnce) {
      break;
    }

    const delayMilliseconds = Math.max(0, nextRunAt.getTime() - now().getTime());

    await wait(delayMilliseconds, options.signal);
    scheduledFor = nextRunAt;
  }
}
