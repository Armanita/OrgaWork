import {
  createObservabilityContext,
  createStructuredLogger,
  defaultHeartbeatRegistry,
  defaultMetricRegistry,
  runWithObservabilityContext,
} from '@workspace/observability';

import { resolveWorkerRuntimeConfiguration } from './runtime-configuration.js';
import { runWorker, type WorkerCycleReport } from './worker.js';

const logger = createStructuredLogger({
  service: 'orgawork-worker',
});

function writeError(error: unknown): void {
  defaultMetricRegistry.recordProcessCycle('worker', 'failure', 0);
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
          const completedAt = new Date(report.completedAt);
          const duration = Math.max(
            0,
            completedAt.getTime() - new Date(report.startedAt).getTime(),
          );
          defaultHeartbeatRegistry.record(configuration.name, completedAt);
          defaultMetricRegistry.recordProcessCycle('worker', 'success', duration);

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
