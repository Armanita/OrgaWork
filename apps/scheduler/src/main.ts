import { resolveSchedulerRuntimeConfiguration } from './runtime-configuration.js';
import { runScheduler, type SchedulerRunReport } from './scheduler.js';

interface SchedulerLogEvent {
  readonly service: string;
  readonly event: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

function writeOutput(event: SchedulerLogEvent): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function writeError(error: unknown): void {
  const detail = error instanceof Error ? error.message : 'خطای ناشناخته رخ داد.';

  process.stderr.write(
    `${JSON.stringify({
      service: 'orgawork-scheduler',
      event: 'scheduler-failed',
      message: 'اجرای زمان‌بند ناموفق بود.',
      detail,
    })}\n`,
  );
}

async function main(): Promise<void> {
  const configuration = resolveSchedulerRuntimeConfiguration();

  const controller = new AbortController();

  function requestShutdown(): void {
    controller.abort();
  }

  process.once('SIGINT', requestShutdown);
  process.once('SIGTERM', requestShutdown);

  try {
    await runScheduler({
      name: configuration.name,
      intervalMilliseconds: configuration.intervalMilliseconds,
      runOnce: configuration.runOnce,
      signal: controller.signal,
      onRun: (report: SchedulerRunReport) => {
        writeOutput({
          ...report,
          event: 'schedule-run-completed',
          message: 'اجرای زمان‌بندی‌شده با موفقیت انجام شد.',
        });
      },
    });

    writeOutput({
      service: configuration.name,
      event: 'scheduler-stopped',
      message: 'زمان‌بند با موفقیت متوقف شد.',
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
