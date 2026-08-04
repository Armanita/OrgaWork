import { describe, expect, it } from 'vitest';
import { decideAuthorization } from '../../modules/authorization/src/index.js';
import { organizationCacheKey } from '../../modules/organization-context/src/index.js';

const base = {
  authenticated: true,
  sessionActive: true,
  organizationId: 'org-a',
  membershipStatus: 'active' as const,
  permission: 'task.view' as const,
  rolePermissions: ['task.view' as const],
  explicitDeny: false,
};
describe('P2 negative access and cross-tenant acceptance', () => {
  it('rejects a suspended membership before permission evaluation', () => {
    expect(decideAuthorization({ ...base, membershipStatus: 'suspended' })).toEqual({
      allowed: false,
      reasonCode: 'MEMBERSHIP_INACTIVE',
    });
  });
  it('rejects explicit deny even when a role grants permission', () => {
    expect(decideAuthorization({ ...base, explicitDeny: true })).toEqual({
      allowed: false,
      reasonCode: 'EXPLICIT_DENY',
    });
  });
  it('isolates cache keys across session revisions and organizations', () => {
    const a = organizationCacheKey({
      userId: 'u',
      sessionRevision: 1,
      organizationId: 'a',
      resource: 'case:1',
    });
    const b = organizationCacheKey({
      userId: 'u',
      sessionRevision: 2,
      organizationId: 'a',
      resource: 'case:1',
    });
    const c = organizationCacheKey({
      userId: 'u',
      sessionRevision: 1,
      organizationId: 'b',
      resource: 'case:1',
    });
    expect(new Set([a, b, c]).size).toBe(3);
  });
  it('rejects relationship and resource-state bypass independently', () => {
    expect(decideAuthorization({ ...base, relationshipAllowed: false }).allowed).toBe(false);
    expect(decideAuthorization({ ...base, resourceStatusAllowed: false }).allowed).toBe(false);
  });
});
