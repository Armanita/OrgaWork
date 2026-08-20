import { describe, expect, it } from 'vitest';

import { buildApplication } from '../application.js';
import type { OrganizationAdministrationRouteOptions } from './organization-administration.js';

const session = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  email: 'user@example.com',
  status: 'active' as const,
  sessionRevision: 1,
  currentOrganizationId: '33333333-3333-4333-8333-333333333333',
  csrfToken: 'csrf-token',
  idleExpiresAt: '2026-08-04T08:00:00.000Z',
  absoluteExpiresAt: '2026-08-11T00:00:00.000Z',
};

function options(allowed: boolean): OrganizationAdministrationRouteOptions {
  return {
    authentication: {
      setPasswordCredential: async () => undefined,
      login: async () => ({ sessionSecret: 'session-secret', session }),
      getSession: async () => session,
      logout: async () => undefined,
      logoutAll: async () => 1,
      requestPasswordReset: async () => ({}),
      confirmPasswordReset: async () => undefined,
    },
    authorization: {
      authorize: async () => ({ allowed, reasonCode: allowed ? 'PERMITTED' : 'EXPLICIT_DENY' }),
    },
    administration: {
      listMemberships: async () => [{ id: 'membership-1' }],
      listTeams: async () => [{ id: 'team-1' }],
      createInvitation: async () => ({ id: 'invitation-1' }),
      acceptInvitation: async () => ({ membershipId: 'membership-1' }),
      revokeInvitation: async () => true,
      updateMembership: async () => true,
      replaceMembershipRoles: async () => true,
      createTeam: async () => ({ id: 'team-1' }),
      renameTeam: async () => true,
      addTeamMember: async () => true,
      removeTeamMember: async () => true,
    },
    production: false,
    now: () => new Date('2026-08-04T00:00:00.000Z'),
  };
}

describe('organization administration routes', () => {
  it('rejects a modifying request without a matching CSRF token', async () => {
    const app = buildApplication({ organizationAdministration: options(true) });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/organizations/33333333-3333-4333-8333-333333333333/invitations',
      headers: { cookie: 'orgawork-session=session-secret' },
      payload: { email: 'member@example.com' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects organization_admin from tenant invitation and role replacement', async () => {
    const app = buildApplication({ organizationAdministration: options(true) });
    const headers = {
      cookie: 'orgawork-session=session-secret',
      'x-csrf-token': 'csrf-token',
    };
    const invitation = await app.inject({
      method: 'POST',
      url: '/v1/organizations/33333333-3333-4333-8333-333333333333/invitations',
      headers,
      payload: { email: 'admin@example.com', roleKey: 'organization_admin' },
    });
    expect(invitation.statusCode).toBe(400);

    const replacement = await app.inject({
      method: 'PATCH',
      url:
        '/v1/organizations/33333333-3333-4333-8333-333333333333/' +
        'memberships/44444444-4444-4444-8444-444444444444/roles',
      headers,
      payload: { roleKeys: ['organization_admin'] },
    });
    expect(replacement.statusCode).toBe(400);
    await app.close();
  });

  it('enforces authorization before listing memberships', async () => {
    const app = buildApplication({ organizationAdministration: options(false) });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/organizations/33333333-3333-4333-8333-333333333333/memberships',
      headers: {
        cookie: 'orgawork-session=session-secret',
        'x-csrf-token': 'csrf-token',
      },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
