import { describe, expect, it } from 'vitest';
import { MetricRegistry } from '@workspace/observability';
import { observePostgreSqlOperation } from './observability.js';

describe('سنجه پایگاه داده', () => {
  it('موفقیت و شکست Query و Transaction را ثبت می‌کند', async () => {
    const registry = new MetricRegistry();
    const values = [0, 5, 10, 18] as const;
    let index = 0;
    const clock = (): number => {
      const value = values[index];
      if (value === undefined) throw new Error('زمان کافی نیست');
      index += 1;
      return value;
    };
    await expect(
      observePostgreSqlOperation('query', () => Promise.resolve('ok'), registry, clock),
    ).resolves.toBe('ok');
    await expect(
      observePostgreSqlOperation(
        'transaction',
        () => Promise.reject(new Error('fail')),
        registry,
        clock,
      ),
    ).rejects.toThrow('fail');
    const output = registry.renderPrometheus();
    expect(output).toContain('operation="query",outcome="success"');
    expect(output).toContain('operation="transaction",outcome="failure"');
  });
});
