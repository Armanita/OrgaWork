import { describe, expect, it } from 'vitest';
import { decideAuthorization, organizationRoleCatalog } from './index.js';

const base = {
  authenticated: true,
  sessionActive: true,
  organizationId: 'organization',
  membershipStatus: 'active' as const,
  permission: 'task.view' as const,
  rolePermissions: ['task.view' as const],
  explicitDeny: false,
};

describe('authorization decision order', () => {
  it('gives explicit deny the highest authorization priority', () => {
    expect(decideAuthorization({ ...base, explicitDeny: true })).toEqual({
      allowed: false,
      reasonCode: 'EXPLICIT_DENY',
    });
  });
  it('does not grant tenant data access to platform operators', () => {
    expect(organizationRoleCatalog.platform_operator).toEqual([]);
  });
  it('separates permission relationship and resource-state checks', () => {
    expect(decideAuthorization({ ...base, relationshipAllowed: false }).reasonCode).toBe(
      'RELATIONSHIP_DENIED',
    );
    expect(decideAuthorization({ ...base, resourceStatusAllowed: false }).reasonCode).toBe(
      'RESOURCE_STATE_DENIED',
    );
  });
});
