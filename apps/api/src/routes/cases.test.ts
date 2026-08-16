import { describe, expect, it, vi } from 'vitest';
import { buildApplication } from '../application.js';
import type { AuthenticationService, AuthenticationSessionView } from '@workspace/authentication';
import type { PostgreSqlAccess } from '@workspace/database';

describe('Cases API Routes', () => {
  const mockSession: AuthenticationSessionView = {
    sessionId: 'session-123',
    userId: 'user-123',
    email: 'user@example.com',
    currentOrganizationId: 'org-123',
    csrfToken: 'valid-csrf-token',
    idleExpiresAt: new Date(),
    absoluteExpiresAt: new Date(),
  };

  const mockAuthentication: AuthenticationService = {
    getSession: vi.fn().mockResolvedValue(mockSession),
  } as unknown as AuthenticationService;

  const mockDatabase: PostgreSqlAccess = {
    transaction: vi.fn().mockImplementation(async (callback) => {
      const mockTx = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };
      return callback(mockTx);
    }),
  } as unknown as PostgreSqlAccess;

  it('rejects case creation when session cookie is missing', async () => {
    const app = buildApplication({
      cases: {
        database: mockDatabase,
        authentication: mockAuthentication,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        'x-csrf-token': 'valid-csrf-token',
      },
      payload: {
        title: 'پرونده نمونه',
        initialWork: { kind: 'action', id: 'action-1' },
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('creates case successfully when valid session and payload are provided', async () => {
    const app = buildApplication({
      cases: {
        database: mockDatabase,
        authentication: mockAuthentication,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        cookie: 'orgawork-session=valid-secret',
        'x-csrf-token': 'valid-csrf-token',
      },
      payload: {
        title: 'پرونده نمونه جدید',
        initialWork: { kind: 'action', id: 'action-1' },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('پرونده نمونه جدید');
    expect(body.data.organizationId).toBe('org-123');
  });
});
