export interface WorkerCycleReport {
  readonly service: string;
  readonly sequence: number;
  readonly status: 'completed';
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface WorkerRunOptions {
  readonly name: string;
  readonly pollingIntervalMilliseconds: number;
  readonly runOnce: boolean;
  readonly signal: AbortSignal;
  readonly now?: () => Date;
  readonly wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  readonly onCycle?: (report: WorkerCycleReport) => void | Promise<void>;
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

export async function runWorker(options: WorkerRunOptions): Promise<void> {
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? waitForDelay;

  let sequence = 0;

  while (!options.signal.aborted) {
    sequence += 1;

    const startedAt = now().toISOString();

    const report: WorkerCycleReport = {
      service: options.name,
      sequence,
      status: 'completed',
      startedAt,
      completedAt: now().toISOString(),
    };

    await options.onCycle?.(report);

    if (options.runOnce) {
      break;
    }

    await wait(options.pollingIntervalMilliseconds, options.signal);
  }
}
