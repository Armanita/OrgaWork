import { describe, expect, it, vi } from 'vitest';

import type { PostgreSqlAccess, PostgreSqlQueryExecutor } from './index.js';
import { withRuntimeTransaction, withUserTransaction } from './tenant-runtime.js';

function accessWith(executor: PostgreSqlQueryExecutor): PostgreSqlAccess {
  return {
    query: executor.query.bind(executor),
    transaction: async (operation) => operation(executor),
    close: async () => undefined,
  };
}

describe('P2 runtime transaction contexts', () => {
  it('sets only the runtime role for authentication operations', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const executor = { query } as unknown as PostgreSqlQueryExecutor;

    await withRuntimeTransaction(accessWith(executor), async () => 'done');

    expect(query).toHaveBeenCalledWith('SET LOCAL ROLE orgawork_runtime');
  });

  it('sets the normalized user context inside one transaction', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const executor = { query } as unknown as PostgreSqlQueryExecutor;

    await withUserTransaction(
      accessWith(executor),
      '22222222-2222-4222-8222-222222222222',
      async (_transaction, userId) => userId,
    );

    expect(query).toHaveBeenCalledWith("SELECT set_config('orgawork.user_id', $1, true)", [
      '22222222-2222-4222-8222-222222222222',
    ]);
  });
});
