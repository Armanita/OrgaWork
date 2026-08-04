import { describe, expect, it } from 'vitest';
import {
  createOrganizationContextService,
  organizationCacheKey,
  type OrganizationContextRepository,
} from './index.js';

describe('current organization service', () => {
  it('increments revision and rotates CSRF when switching an active organization', async () => {
    const repository: OrganizationContextRepository = {
      listActiveOrganizations: async () => [],
      switchCurrentOrganization: async () => ({ sessionRevision: 4 }),
    };
    const service = createOrganizationContextService(
      repository,
      () => new Date('2026-08-04T00:00:00.000Z'),
    );
    const result = await service.switchOrganization({
      sessionId: 'session',
      userId: 'user',
      organizationId: 'organization',
    });
    expect(result.sessionRevision).toBe(4);
    expect(result.csrfToken.length).toBeGreaterThan(30);
  });

  it('includes user revision organization and resource in cache keys', () => {
    expect(
      organizationCacheKey({
        userId: 'u',
        sessionRevision: 3,
        organizationId: 'o',
        resource: 'case:1',
      }),
    ).toMatch(/^u:3:o:[0-9a-f]{64}$/u);
  });
});
