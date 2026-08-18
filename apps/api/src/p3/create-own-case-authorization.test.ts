import { describe, expect, it } from 'vitest';

import { decideCreateOwnCaseAuthorization } from './create-own-case-authorization.js';

const allowed = {
  authenticated: true,
  sessionActive: true,
  organizationId: '11111111-1111-4111-8111-111111111111',
  membershipStatus: 'active' as const,
  rolePermissions: ['case.create_self' as const],
  explicitDeny: false,
};

describe('CreateOwnCase authorization policy', () => {
  it('allows an active member only when the P3 permission is present', () => {
    expect(decideCreateOwnCaseAuthorization(allowed)).toEqual({
      allowed: true,
      reasonCode: 'ALLOWED',
    });
  });

  it('does not reuse legacy task permissions as CreateOwnCase permission', () => {
    expect(
      decideCreateOwnCaseAuthorization({
        ...allowed,
        rolePermissions: ['task.view'],
      }),
    ).toEqual({
      allowed: false,
      reasonCode: 'PERMISSION_MISSING',
    });
  });

  it('preserves explicit deny and membership state as independent gates', () => {
    expect(decideCreateOwnCaseAuthorization({ ...allowed, explicitDeny: true })).toMatchObject({
      allowed: false,
      reasonCode: 'EXPLICIT_DENY',
    });

    expect(
      decideCreateOwnCaseAuthorization({
        ...allowed,
        membershipStatus: 'revoked',
      }),
    ).toMatchObject({
      allowed: false,
      reasonCode: 'MEMBERSHIP_INACTIVE',
    });
  });

  it('requires organization context', () => {
    const withoutOrganization = {
      authenticated: allowed.authenticated,
      sessionActive: allowed.sessionActive,
      membershipStatus: allowed.membershipStatus,
      rolePermissions: allowed.rolePermissions,
      explicitDeny: allowed.explicitDeny,
    };

    expect(decideCreateOwnCaseAuthorization(withoutOrganization)).toEqual({
      allowed: false,
      reasonCode: 'ORGANIZATION_REQUIRED',
    });
  });
});
