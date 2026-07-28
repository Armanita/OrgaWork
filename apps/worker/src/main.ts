import { resolveWorkerRuntimeConfiguration } from './runtime-configuration.js';
import { runWorker, type WorkerCycleReport } from './worker.js';

interface WorkerLogEvent {
  readonly service: string;
  readonly event: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

function writeOutput(event: WorkerLogEvent): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function writeError(error: unknown): void {
  const detail = error instanceof Error ? error.message : 'خطای ناشناخته رخ داد.';

  process.stderr.write(
    `${JSON.stringify({
      service: 'orgawork-worker',
      event: 'worker-failed',
      message: 'اجرای پردازشگر پس‌زمینه ناموفق بود.',
      detail,
    })}\n`,
  );
}

async function main(): Promise<void> {
  const configuration = resolveWorkerRuntimeConfiguration();
  const controller = new AbortController();

  function requestShutdown(): void {
    controller.abort();
  }

  process.once('SIGINT', requestShutdown);
  process.once('SIGTERM', requestShutdown);

  try {
    await runWorker({
      name: configuration.name,
      pollingIntervalMilliseconds: configuration.pollingIntervalMilliseconds,
      runOnce: configuration.runOnce,
      signal: controller.signal,
      onCycle: (report: WorkerCycleReport) => {
        writeOutput({
          ...report,
          event: 'cycle-completed',
          message: 'چرخه پردازشگر با موفقیت انجام شد.',
        });
      },
    });

    writeOutput({
      service: configuration.name,
      event: 'worker-stopped',
      message: 'پردازشگر پس‌زمینه با موفقیت متوقف شد.',
      reason: configuration.runOnce ? 'run-once' : 'shutdown-signal',
    });
  } finally {
    process.removeListener('SIGINT', requestShutdown);
    process.removeListener('SIGTERM', requestShutdown);
  }
}

void main().catch((error: unknown) => {
  writeError(error);
  process.exitCode = 1;
});
