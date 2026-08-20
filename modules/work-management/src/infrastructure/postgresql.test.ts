import { describe, expect, it, vi } from 'vitest';

import type { PostgreSqlAccess, PostgreSqlQueryExecutor } from '@workspace/database';

import { createPostgreSqlWorkManagementService } from './postgresql.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const membershipId = '33333333-3333-4333-8333-333333333333';

function accessWith(permission = true) {
  const statements: string[] = [];
  const query = vi.fn(async (text: string) => {
    statements.push(text);

    if (text.includes("current_setting('orgawork.organization_id'")) {
      return { rows: [{ organization_id: organizationId }], rowCount: 1 };
    }
    if (text.includes('FROM public.orgawork_memberships AS membership')) {
      return {
        rows: [
          {
            membership_id: membershipId,
            membership_status: 'active',
            permissions: permission ? ['case.create_self'] : [],
            explicit_deny: false,
          },
        ],
        rowCount: 1,
      };
    }
    if (text.includes('SELECT request_fingerprint, state, result_snapshot')) {
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 1 };
  });

  const transaction = { query } as unknown as PostgreSqlQueryExecutor;
  const access = {
    query,
    transaction: vi.fn(
      async <Result>(
        operation: (transaction: PostgreSqlQueryExecutor) => Promise<Result>,
      ): Promise<Result> => operation(transaction),
    ),
    close: vi.fn(),
  } as unknown as PostgreSqlAccess;

  return { access, statements };
}

describe('PostgreSQL Work Management service', () => {
  it('creates Case + Responsibility + Action + Current Work in one organization transaction', async () => {
    const { access, statements } = accessWith(true);
    let sequence = 0;
    const service = createPostgreSqlWorkManagementService(access, {
      now: () => new Date('2026-08-19T08:45:00.000Z'),
      randomId: () =>
        [
          '44444444-4444-4444-8444-444444444444',
          '55555555-5555-4555-8555-555555555555',
          '66666666-6666-4666-8666-666666666666',
          '77777777-7777-4777-8777-777777777777',
          '88888888-8888-4888-8888-888888888888',
        ][sequence++] ?? '99999999-9999-4999-8999-999999999999',
    });

    const result = await service.createOwnCase({
      userId,
      organizationId,
      idempotencyKey: 'wm01:test:create:001',
      title: 'Customer renewal',
      description: 'Follow the renewal case',
      priority: 'high',
      initialAction: { title: 'Call customer' },
    });

    expect(result.status).toBe('open');
    expect(result.initialAction.status).toBe('pending');
    expect(result.replayed).toBe(false);
    expect(statements.some((text) => text.includes('INSERT INTO public.orgawork_cases'))).toBe(
      true,
    );
    expect(
      statements.some((text) => text.includes('INSERT INTO public.orgawork_case_responsibilities')),
    ).toBe(true);
    expect(statements.some((text) => text.includes('INSERT INTO public.orgawork_actions'))).toBe(
      true,
    );
    expect(
      statements.some((text) => text.includes('INSERT INTO public.orgawork_case_current_work')),
    ).toBe(true);
    expect(
      statements.some((text) => text.includes('UPDATE public.orgawork_idempotency_records')),
    ).toBe(true);
  });

  it('denies creation when transactional access-control denies the permission', async () => {
    const { access, statements } = accessWith(false);
    const service = createPostgreSqlWorkManagementService(access, {
      now: () => new Date('2026-08-19T08:45:00.000Z'),
    });

    await expect(
      service.createOwnCase({
        userId,
        organizationId,
        idempotencyKey: 'wm01:test:create:002',
        title: 'Denied case',
        description: 'Should not persist',
        priority: 'normal',
        initialAction: { title: 'Should not exist' },
      }),
    ).rejects.toMatchObject({
      code: 'AUTHORIZATION_DENIED',
    });

    expect(statements.some((text) => text.includes('INSERT INTO public.orgawork_cases'))).toBe(
      false,
    );
    expect(statements.some((text) => text.includes('orgawork_authorization_audit'))).toBe(true);
  });
});
