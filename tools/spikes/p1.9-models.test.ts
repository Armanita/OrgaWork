import { describe, expect, it } from 'vitest';

import {
  compositeIdentity,
  OrganizationSessionCache,
  OutboxLeaseModel,
  TransactionContextPoolModel,
} from './p1.9-models.js';

describe('P1.9 Outbox و Lease', () => {
  it('اثر Outbox تکراری را در محدوده همان سازمان رد می‌کند', () => {
    const model = new OutboxLeaseModel();

    expect(
      model.enqueue({
        messageId: 'message-a',
        organizationId: 'organization-a',
        idempotencyKey: 'same-key',
      }),
    ).toEqual({ status: 'created', messageId: 'message-a' });

    expect(
      model.enqueue({
        messageId: 'message-b',
        organizationId: 'organization-a',
        idempotencyKey: 'same-key',
      }),
    ).toEqual({ status: 'duplicate', messageId: 'message-a' });
  });

  it('یک کلید مشابه را برای دو سازمان مستقل می‌پذیرد', () => {
    const model = new OutboxLeaseModel();

    expect(
      model.enqueue({
        messageId: 'message-a',
        organizationId: 'organization-a',
        idempotencyKey: 'shared-key',
      }).status,
    ).toBe('created');
    expect(
      model.enqueue({
        messageId: 'message-b',
        organizationId: 'organization-b',
        idempotencyKey: 'shared-key',
      }).status,
    ).toBe('created');
  });

  it('مالک دوم را تا پایان Lease متوقف و پس از انقضا بازیابی می‌کند', () => {
    const model = new OutboxLeaseModel();
    model.enqueue({
      messageId: 'message-a',
      organizationId: 'organization-a',
      idempotencyKey: 'key-a',
    });

    expect(model.claim('message-a', 'worker-a', 1_000, 500)).toEqual({
      status: 'claimed',
      owner: 'worker-a',
    });
    expect(model.claim('message-a', 'worker-b', 1_100, 500)).toEqual({
      status: 'busy',
      owner: 'worker-a',
    });
    expect(model.claim('message-a', 'worker-b', 1_501, 500)).toEqual({
      status: 'claimed',
      owner: 'worker-b',
    });
  });

  it('تحویل تکراری Consumer اثر تجاری دوم ایجاد نمی‌کند', () => {
    const model = new OutboxLeaseModel();
    model.enqueue({
      messageId: 'message-a',
      organizationId: 'organization-a',
      idempotencyKey: 'key-a',
    });
    model.claim('message-a', 'worker-a', 1_000, 500);

    expect(model.complete('message-a', 'worker-a', 'consumer-a', 'delivery-a', 1_100)).toBe(
      'processed',
    );
    expect(model.complete('message-a', 'worker-a', 'consumer-a', 'delivery-a', 1_200)).toBe(
      'duplicate',
    );
    expect(model.deliveryCount('message-a')).toBe(1);
  });
});

describe('P1.9 نشست، سازمان جاری و Cache', () => {
  it('تعویض سازمان Cache سازمان قبلی را پاک می‌کند', () => {
    const cache = new OrganizationSessionCache<string>();
    cache.activate({
      sessionRevision: 'session-1',
      subjectId: 'user-a',
      organizationId: 'organization-a',
    });
    cache.write('cases', 'organization-a-data');

    cache.activate({
      sessionRevision: 'session-1',
      subjectId: 'user-a',
      organizationId: 'organization-b',
    });

    expect(cache.read('cases')).toBeUndefined();
    expect(cache.size()).toBe(0);
  });

  it('چرخش نشست Cache قبلی را نامعتبر می‌کند', () => {
    const cache = new OrganizationSessionCache<string>();
    cache.activate({
      sessionRevision: 'session-1',
      subjectId: 'user-a',
      organizationId: 'organization-a',
    });
    cache.write('dashboard', 'old');

    cache.activate({
      sessionRevision: 'session-2',
      subjectId: 'user-a',
      organizationId: 'organization-a',
    });

    expect(cache.read('dashboard')).toBeUndefined();
  });
});

describe('P1.9 زمینه تراکنش و روابط مرکب', () => {
  it('زمینه سازمان را پس از موفقیت و شکست از Pool پاک می‌کند', async () => {
    const pool = new TransactionContextPoolModel(1);

    await pool.run('organization-a', (context) => {
      expect(context.organizationId).toBe('organization-a');
    });

    await expect(
      pool.run('organization-b', () => {
        throw new Error('controlled failure');
      }),
    ).rejects.toThrow('controlled failure');

    expect(pool.inspect()).toEqual([
      {
        id: 1,
        organizationId: undefined,
        busy: false,
      },
    ]);
  });

  it('دو تراکنش هم‌زمان زمینه سازمان مستقل دارند', async () => {
    const pool = new TransactionContextPoolModel(2);
    let release: (() => void) | undefined;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = pool.run('organization-a', async (context) => {
      await barrier;
      return context.organizationId;
    });
    const second = pool.run('organization-b', (context) => {
      release?.();
      return context.organizationId;
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      'organization-a',
      'organization-b',
    ]);
    expect(pool.inspect().every((slot) => !slot.busy)).toBe(true);
  });

  it('هویت مرکب مرز سازمان را بخشی از یکتایی می‌کند', () => {
    expect(compositeIdentity('organization-a', 'consumer-a', 'message-a')).not.toBe(
      compositeIdentity('organization-b', 'consumer-a', 'message-a'),
    );
    expect(() => compositeIdentity('only-one')).toThrow(RangeError);
  });
});
