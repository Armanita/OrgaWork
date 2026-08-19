import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticationSessionView } from '@workspace/authentication';
import type { CreateOwnCaseResult } from '@workspace/work-management';

import { createWorkManagementRoutes } from './work-management.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const session: AuthenticationSessionView = {
  id: '33333333-3333-4333-8333-333333333333',
  userId,
  email: 'wm01@example.test',
  status: 'active',
  sessionRevision: 1,
  currentOrganizationId: organizationId,
  csrfToken: 'csrf-token-value-1234567890',
  idleExpiresAt: '2026-08-19T10:00:00.000Z',
  absoluteExpiresAt: '2026-08-20T10:00:00.000Z',
};

const created: CreateOwnCaseResult = {
  caseId: '44444444-4444-4444-8444-444444444444',
  title: 'Customer renewal',
  status: 'open',
  priority: 'high',
  dueAt: null,
  responsibilityId: '55555555-5555-4555-8555-555555555555',
  initialAction: {
    id: '66666666-6666-4666-8666-666666666666',
    title: 'Call customer',
    status: 'pending',
    dueAt: null,
  },
  replayed: false,
};

const getSession = vi.fn();
const createOwnCase = vi.fn();

function buildRouteTestApplication() {
  const application = Fastify({ logger: false });

  application.register(cookie);

  // Production observability supplies these reply headers. Preserve only
  // that middleware contract so this route test stays isolated and fast.
  application.addHook('onRequest', (_request, reply, done) => {
    reply.header('x-request-id', requestId);
    reply.header('x-correlation-id', correlationId);
    done();
  });

  application.register(
    createWorkManagementRoutes({
      authentication: { getSession },
      workManagement: { createOwnCase },
      now: () => new Date('2026-08-19T08:45:00.000Z'),
    }),
  );

  return application;
}

describe('Work Management API route', () => {
  beforeEach(() => {
    getSession.mockReset();
    createOwnCase.mockReset();
    getSession.mockResolvedValue(session);
  });

  it('creates own case through the authenticated organization-scoped route', async () => {
    createOwnCase.mockResolvedValue(created);
    const application = buildRouteTestApplication();

    try {
      const response = await application.inject({
        method: 'POST',
        url: `/v1/organizations/${organizationId}/cases`,
        headers: {
          cookie: 'orgawork-session=session-secret',
          'x-csrf-token': session.csrfToken,
          'x-idempotency-key': 'wm01:route:create:001',
        },
        payload: {
          title: 'Customer renewal',
          description: 'Follow the renewal case',
          priority: 'high',
          initialActionTitle: 'Call customer',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<{
        data: CreateOwnCaseResult;
        meta: { requestId: string; correlationId: string };
      }>();
      expect(body.data.caseId).toBe(created.caseId);
      expect(body.meta.requestId).toBe(requestId);
      expect(body.meta.correlationId).toBe(correlationId);
      expect(createOwnCase).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          organizationId,
          idempotencyKey: 'wm01:route:create:001',
        }),
      );
    } finally {
      await application.close();
    }
  });

  it('rejects organization mismatch before calling Work Management', async () => {
    const application = buildRouteTestApplication();

    try {
      const response = await application.inject({
        method: 'POST',
        url: '/v1/organizations/77777777-7777-4777-8777-777777777777/cases',
        headers: {
          cookie: 'orgawork-session=session-secret',
          'x-csrf-token': session.csrfToken,
          'x-idempotency-key': 'wm01:route:create:002',
        },
        payload: {
          title: 'Wrong org',
          description: 'Should be rejected',
          priority: 'normal',
          initialActionTitle: 'Nothing',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json<{
        meta: { requestId: string; correlationId: string };
      }>();
      expect(body.meta.requestId).toBe(requestId);
      expect(body.meta.correlationId).toBe(correlationId);
      expect(createOwnCase).not.toHaveBeenCalled();
    } finally {
      await application.close();
    }
  });
});
