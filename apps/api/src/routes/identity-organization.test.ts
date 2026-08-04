import { describe, expect, it } from 'vitest';
import { buildApplication } from '../application.js';

const session = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  email: 'user@example.com',
  status: 'active' as const,
  sessionRevision: 1,
  currentOrganizationId: null,
  csrfToken: 'csrf-token',
  idleExpiresAt: '2026-08-04T08:00:00.000Z',
  absoluteExpiresAt: '2026-08-11T00:00:00.000Z',
};
const authentication = {
  setPasswordCredential: async () => {},
  login: async () => ({ sessionSecret: 'session-secret', session }),
  getSession: async () => session,
  logout: async () => {},
  logoutAll: async () => 1,
  requestPasswordReset: async () => ({}),
  confirmPasswordReset: async () => {},
};
const organizationContext = {
  listOrganizations: async () => [
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'سازمان نمونه',
      membershipId: '44444444-4444-4444-8444-444444444444',
      membershipStatus: 'active' as const,
    },
  ],
  switchOrganization: async () => ({
    organizationId: '33333333-3333-4333-8333-333333333333',
    sessionRevision: 2,
    csrfToken: 'new-csrf',
  }),
};

describe('identity and organization routes', () => {
  it('sets an HttpOnly SameSite cookie on login', async () => {
    const app = buildApplication({
      identityOrganization: {
        authentication,
        organizationContext,
        production: false,
        now: () => new Date('2026-08-04T00:00:00.000Z'),
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'user@example.com', password: 'password' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Lax');
    await app.close();
  });
  it('requires CSRF for changing the current organization', async () => {
    const app = buildApplication({
      identityOrganization: {
        authentication,
        organizationContext,
        production: false,
        now: () => new Date('2026-08-04T00:00:00.000Z'),
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/current-organization',
      headers: { cookie: 'orgawork-session=session-secret' },
      payload: { organizationId: '33333333-3333-4333-8333-333333333333' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
  it('lists only organizations returned for the authenticated user', async () => {
    const app = buildApplication({
      identityOrganization: {
        authentication,
        organizationContext,
        production: false,
        now: () => new Date('2026-08-04T00:00:00.000Z'),
      },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/organizations',
      headers: { cookie: 'orgawork-session=session-secret' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.organizations).toHaveLength(1);
    await app.close();
  });
});
