import { describe, expect, it } from 'vitest';

import type { PlatformControlPlaneService } from '@workspace/organization-administration';
import { buildApplication } from '../application.js';

const session = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  email: 'platform@example.com',
  status: 'active' as const,
  sessionRevision: 1,
  currentOrganizationId: null,
  csrfToken: 'csrf-token',
  idleExpiresAt: '2026-08-19T20:00:00.000Z',
  absoluteExpiresAt: '2026-08-26T12:00:00.000Z',
};

function authentication() {
  return {
    setPasswordCredential: async () => undefined,
    login: async () => ({ sessionSecret: 'session-secret', session }),
    getSession: async () => session,
    logout: async () => undefined,
    logoutAll: async () => 1,
    requestPasswordReset: async () => ({}),
    confirmPasswordReset: async () => undefined,
  };
}

function platform(authorized: boolean): PlatformControlPlaneService {
  return {
    getOperator: async () => {
      if (!authorized) {
        const { PlatformControlPlaneError } =
          await import('@workspace/organization-administration');
        throw new PlatformControlPlaneError(
          'PLATFORM_AUTHORITY_REQUIRED',
          'دسترسی اپراتور سکو فعال نیست.',
        );
      }
      return { userId: session.userId, email: session.email, status: 'active' };
    },
    listAudit: async () => [],
    listOrganizations: async () => [],
    renameOrganization: async (input) => ({
      organization: { id: input.organizationId, name: input.name },
      replayed: false,
    }),
    revokeOrganizationAdmin: async (input) => ({
      organizationId: input.organizationId,
      userId: '66666666-6666-4666-8666-666666666666',
      email: 'admin@example.com',
      membershipId: input.membershipId,
      replayed: false,
    }),
    createOrganization: async () => ({
      organization: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'شرکت نمونه',
      },
      replayed: false,
    }),
    provisionInitialAdmin: async (input) => ({
      organizationId: input.organizationId,
      userId: '44444444-4444-4444-8444-444444444444',
      email: input.email,
      membershipId: '55555555-5555-4555-8555-555555555555',
      role: 'organization_admin',
      accountSetupRequired: true,
      replayed: false,
    }),
  };
}

describe('Platform Control Plane routes', () => {
  it('requires a normal OrgaWork session', async () => {
    const app = buildApplication({
      platformControlPlane: {
        authentication: authentication(),
        platformControlPlane: platform(true),
        production: false,
      },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/platform/session',
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('keeps platform authority default-deny for a normal authenticated user', async () => {
    const app = buildApplication({
      platformControlPlane: {
        authentication: authentication(),
        platformControlPlane: platform(false),
        production: false,
      },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/platform/session',
      headers: { cookie: 'orgawork-session=session-secret' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('requires CSRF for platform mutations', async () => {
    const app = buildApplication({
      platformControlPlane: {
        authentication: authentication(),
        platformControlPlane: platform(true),
        production: false,
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/platform/organizations',
      headers: {
        cookie: 'orgawork-session=session-secret',
        'idempotency-key': 'oa-create-1234',
      },
      payload: {
        name: 'شرکت نمونه',
        reason: 'ایجاد سازمان برای آزمون کنترل‌پلین',
      },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('creates an organization with CSRF and idempotency', async () => {
    const app = buildApplication({
      platformControlPlane: {
        authentication: authentication(),
        platformControlPlane: platform(true),
        production: false,
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/platform/organizations',
      headers: {
        cookie: 'orgawork-session=session-secret',
        'x-csrf-token': 'csrf-token',
        'idempotency-key': 'oa-create-1234',
      },
      payload: {
        name: 'شرکت نمونه',
        reason: 'ایجاد سازمان برای آزمون کنترل‌پلین',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        organization: {
          name: 'شرکت نمونه',
        },
      },
    });
    await app.close();
  });
});
