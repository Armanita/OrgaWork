import { describe, expect, it } from 'vitest';
import {
  decideAuthorization,
  decideP3Authorization,
  organizationRoleCatalog,
  p3PermissionCatalog,
} from './index.js';

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

describe('P3 authorization contract', () => {
  const p3Base = {
    authenticated: true,
    sessionActive: true,
    organizationId: 'organization',
    membershipStatus: 'active' as const,
    permission: 'case.create_self' as const,
    rolePermissions: ['case.create_self' as const],
    explicitDeny: false,
    relationshipAllowed: true,
    resourceStatusAllowed: true,
  };

  it('registers only the current P3.2 permission without granting it through legacy role defaults', () => {
    expect(p3PermissionCatalog).toEqual(['case.create_self']);
    expect(organizationRoleCatalog.member).toContain('case.create_self');
    expect(organizationRoleCatalog.manager).toContain('case.create_self');
    expect(organizationRoleCatalog.organization_admin).not.toContain('case.create_self');
    expect(organizationRoleCatalog.platform_operator).not.toContain('case.create_self');
  });

  it('allows CreateOwnCase only when permission, relationship and state checks are all satisfied', () => {
    expect(decideP3Authorization(p3Base)).toEqual({
      allowed: true,
      reasonCode: 'ALLOWED',
    });
  });

  it('keeps explicit deny above P3 permissions', () => {
    expect(decideP3Authorization({ ...p3Base, explicitDeny: true })).toEqual({
      allowed: false,
      reasonCode: 'EXPLICIT_DENY',
    });
  });

  it('fails closed when the required P3 relationship check denies access', () => {
    expect(decideP3Authorization({ ...p3Base, relationshipAllowed: false })).toEqual({
      allowed: false,
      reasonCode: 'RELATIONSHIP_DENIED',
    });
  });

  it('fails closed when the required P3 resource-state check denies access', () => {
    expect(decideP3Authorization({ ...p3Base, resourceStatusAllowed: false })).toEqual({
      allowed: false,
      reasonCode: 'RESOURCE_STATE_DENIED',
    });
  });

  it('rejects inactive membership and missing permission independently', () => {
    expect(decideP3Authorization({ ...p3Base, membershipStatus: 'suspended' })).toMatchObject({
      allowed: false,
      reasonCode: 'MEMBERSHIP_INACTIVE',
    });

    expect(decideP3Authorization({ ...p3Base, rolePermissions: [] })).toMatchObject({
      allowed: false,
      reasonCode: 'PERMISSION_MISSING',
    });
  });
});
