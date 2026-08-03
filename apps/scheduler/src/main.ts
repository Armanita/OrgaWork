import {
  createObservabilityContext,
  createStructuredLogger,
  defaultHeartbeatRegistry,
  defaultMetricRegistry,
  runWithObservabilityContext,
} from '@workspace/observability';

import { resolveSchedulerRuntimeConfiguration } from './runtime-configuration.js';
import { runScheduler, type SchedulerRunReport } from './scheduler.js';

const logger = createStructuredLogger({
  service: 'orgawork-scheduler',
});

function writeError(error: unknown): void {
  defaultMetricRegistry.recordProcessCycle('scheduler', 'failure', 0);
  logger.error('scheduler-failed', 'اجرای زمان‌بند ناموفق بود.', { error });
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
    logger.info('scheduler-started', 'زمان‌بند آغاز شد.', {
      intervalMilliseconds: configuration.intervalMilliseconds,
      runOnce: configuration.runOnce,
    });

    await runScheduler({
      name: configuration.name,
      intervalMilliseconds: configuration.intervalMilliseconds,
      runOnce: configuration.runOnce,
      signal: controller.signal,
      onRun: (report: SchedulerRunReport) => {
        runWithObservabilityContext(createObservabilityContext(), () => {
          const completedAt = new Date(report.completedAt);
          const duration = Math.max(
            0,
            completedAt.getTime() - new Date(report.startedAt).getTime(),
          );
          defaultHeartbeatRegistry.record(configuration.name, completedAt);
          defaultMetricRegistry.recordProcessCycle('scheduler', 'success', duration);

          logger.info('schedule-run-completed', 'اجرای زمان‌بندی‌شده با موفقیت انجام شد.', {
            ...report,
            heartbeatAt: report.completedAt,
          });
        });
      },
    });

    logger.info('scheduler-stopped', 'زمان‌بند با موفقیت متوقف شد.', {
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
