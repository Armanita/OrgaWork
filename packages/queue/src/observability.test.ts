import { describe, expect, it } from 'vitest';
import { MetricRegistry } from '@workspace/observability';
import { observeQueueOperation, recordQueueDepth } from './observability.js';

describe('سنجه صف', () => {
  it('عملیات و عمق صف را ثبت می‌کند', async () => {
    const registry = new MetricRegistry();
    recordQueueDepth('reminders', 3, registry);
    const values = [0, 4] as const;
    let index = 0;
    const clock = (): number => {
      const value = values[index];
      if (value === undefined) throw new Error('زمان کافی نیست');
      index += 1;
      return value;
    };
    await expect(
      observeQueueOperation(
        { queue: 'reminders', operation: 'dequeue' },
        () => Promise.resolve('message'),
        registry,
        clock,
      ),
    ).resolves.toBe('message');
    const output = registry.renderPrometheus();
    expect(output).toContain('orgawork_queue_depth{queue="reminders"} 3');
    expect(output).toContain('operation="dequeue",outcome="success",queue="reminders"');
  });
});
