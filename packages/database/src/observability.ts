import { defaultMetricRegistry, type MetricRegistry } from '@workspace/observability';
export async function observePostgreSqlOperation<Result>(
  operation: 'query' | 'transaction',
  callback: () => Promise<Result>,
  registry: MetricRegistry = defaultMetricRegistry,
  clock: () => number = () => performance.now(),
): Promise<Result> {
  const startedAt = clock();
  try {
    const result = await callback();
    registry.recordDatabaseOperation(operation, 'success', Math.max(0, clock() - startedAt));
    return result;
  } catch (error: unknown) {
    registry.recordDatabaseOperation(operation, 'failure', Math.max(0, clock() - startedAt));
    throw error;
  }
}
