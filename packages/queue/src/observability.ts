import { defaultMetricRegistry, type MetricRegistry } from '@workspace/observability';
export async function observeQueueOperation<Result>(
  descriptor: { readonly queue: string; readonly operation: string },
  callback: () => Promise<Result>,
  registry: MetricRegistry = defaultMetricRegistry,
  clock: () => number = () => performance.now(),
): Promise<Result> {
  const startedAt = clock();
  try {
    const result = await callback();
    registry.recordQueueOperation(
      descriptor.queue,
      descriptor.operation,
      'success',
      Math.max(0, clock() - startedAt),
    );
    return result;
  } catch (error: unknown) {
    registry.recordQueueOperation(
      descriptor.queue,
      descriptor.operation,
      'failure',
      Math.max(0, clock() - startedAt),
    );
    throw error;
  }
}
export function recordQueueDepth(
  queueName: string,
  depth: number,
  registry: MetricRegistry = defaultMetricRegistry,
): void {
  registry.setQueueDepth(queueName, depth);
}
