import {
  createObservabilityContext,
  createStructuredLogger,
  runWithObservabilityContext,
} from '@workspace/observability';

import { resolveWorkerRuntimeConfiguration } from './runtime-configuration.js';
import { runWorker, type WorkerCycleReport } from './worker.js';

const logger = createStructuredLogger({
  service: 'orgawork-worker',
});

function writeError(error: unknown): void {
  logger.error('worker-failed', 'اجرای پردازشگر پس‌زمینه ناموفق بود.', { error });
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
    logger.info('worker-started', 'پردازشگر پس‌زمینه آغاز شد.', {
      pollingIntervalMilliseconds: configuration.pollingIntervalMilliseconds,
      runOnce: configuration.runOnce,
    });

    await runWorker({
      name: configuration.name,
      pollingIntervalMilliseconds: configuration.pollingIntervalMilliseconds,
      runOnce: configuration.runOnce,
      signal: controller.signal,
      onCycle: (report: WorkerCycleReport) => {
        runWithObservabilityContext(createObservabilityContext(), () => {
          logger.info('worker-cycle-completed', 'چرخه پردازشگر با موفقیت انجام شد.', {
            ...report,
            heartbeatAt: report.completedAt,
          });
        });
      },
    });

    logger.info('worker-stopped', 'پردازشگر پس‌زمینه با موفقیت متوقف شد.', {
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
