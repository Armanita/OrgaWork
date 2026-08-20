import { describe, expect, it, vi } from 'vitest';

import type { PostgreSqlQueryExecutor } from '@workspace/database';

import {
  authorizeInTransaction,
  decideAuthorization,
  loadTransactionalAuthorizationContext,
  organizationRoleCatalog,
} from './index.js';

function executorWithRows(rows: readonly unknown[]) {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
  return {
    executor: { query } as unknown as PostgreSqlQueryExecutor,
    query,
  };
}

describe('cross-cutting access control', () => {
  it('keeps explicit deny ahead of granted permissions', () => {
    expect(
      decideAuthorization({
        authenticated: true,
        sessionActive: true,
        organizationId: 'organization',
        membershipStatus: 'active',
        permission: 'task.view',
        rolePermissions: ['task.view'],
        explicitDeny: true,
      }),
    ).toEqual({ allowed: false, reasonCode: 'EXPLICIT_DENY' });
  });

  it('does not grant tenant permissions to platform operators', () => {
    expect(organizationRoleCatalog.platform_operator).toEqual([]);
  });

  it('keeps Create Own Case permission limited to member and manager defaults', () => {
    expect(organizationRoleCatalog.member).toContain('case.create_self');
    expect(organizationRoleCatalog.manager).toContain('case.create_self');
    expect(organizationRoleCatalog.organization_admin).not.toContain('case.create_self');
    expect(organizationRoleCatalog.platform_operator).not.toContain('case.create_self');
  });

  it('loads membership identity and permission data from the provided transaction', async () => {
    const { executor, query } = executorWithRows([
      {
        membership_id: '22222222-2222-4222-8222-222222222222',
        membership_status: 'active',
        permissions: ['task.view'],
        explicit_deny: false,
      },
    ]);

    const context = await loadTransactionalAuthorizationContext(executor, {
      userId: '11111111-1111-4111-8111-111111111111',
      organizationId: '33333333-3333-4333-8333-333333333333',
      permission: 'task.view',
    });

    expect(context).toEqual({
      membershipId: '22222222-2222-4222-8222-222222222222',
      membershipStatus: 'active',
      rolePermissions: ['task.view'],
      explicitDeny: false,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('records the decision through the same provided transaction', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            membership_id: '22222222-2222-4222-8222-222222222222',
            membership_status: 'active',
            permissions: ['task.view'],
            explicit_deny: false,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const executor = { query } as unknown as PostgreSqlQueryExecutor;

    const result = await authorizeInTransaction(executor, {
      userId: '11111111-1111-4111-8111-111111111111',
      organizationId: '33333333-3333-4333-8333-333333333333',
      permission: 'task.view',
      now: '2026-08-19T00:00:00.000Z',
    });

    expect(result).toEqual({
      decision: { allowed: true, reasonCode: 'ALLOWED' },
      membershipId: '22222222-2222-4222-8222-222222222222',
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1]?.[0])).toContain('orgawork_authorization_audit');
  });
});
