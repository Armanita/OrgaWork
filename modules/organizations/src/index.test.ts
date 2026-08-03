import { describe, expect, it } from 'vitest';

import {
  OrganizationDomainError,
  activateMembership,
  createMembership,
  createOrganization,
  isMembershipActive,
  renameOrganization,
  revokeMembership,
  suspendMembership,
  transitionMembershipStatus,
} from './index.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const secondOrganizationId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const membershipId = '44444444-4444-4444-8444-444444444444';

describe('organization and membership domain model', () => {
  it('creates and renames an organization immutably', () => {
    const organization = createOrganization({
      id: organizationId,
      name: '  شرکت   نمونه  ',
      now: '2026-08-03T18:00:00.000Z',
    });
    const renamed = renameOrganization(organization, 'سازمان نمونه', '2026-08-03T18:01:00.000Z');

    expect(organization.name).toBe('شرکت نمونه');
    expect(renamed.name).toBe('سازمان نمونه');
    expect(renamed.version).toBe(2);
  });

  it('rejects an empty organization name', () => {
    expect(() =>
      createOrganization({
        id: organizationId,
        name: '   ',
        now: '2026-08-03T18:00:00.000Z',
      }),
    ).toThrow(OrganizationDomainError);
  });

  it('creates an invited membership by default', () => {
    const membership = createMembership({
      id: membershipId,
      userId,
      organizationId,
      now: '2026-08-03T18:00:00.000Z',
    });

    expect(membership.status).toBe('invited');
    expect(membership.organizationId).toBe(organizationId);
    expect(isMembershipActive(membership)).toBe(false);
  });

  it('supports invited active suspended active lifecycle', () => {
    const invited = createMembership({
      id: membershipId,
      userId,
      organizationId,
      now: '2026-08-03T18:00:00.000Z',
    });
    const active = activateMembership(invited, '2026-08-03T18:01:00.000Z');
    const suspended = suspendMembership(active, '2026-08-03T18:02:00.000Z');
    const reactivated = activateMembership(suspended, '2026-08-03T18:03:00.000Z');

    expect(active.status).toBe('active');
    expect(suspended.status).toBe('suspended');
    expect(reactivated.status).toBe('active');
    expect(reactivated.version).toBe(4);
  });

  it('treats revoked membership as terminal', () => {
    const invited = createMembership({
      id: membershipId,
      userId,
      organizationId,
      now: '2026-08-03T18:00:00.000Z',
    });
    const revoked = revokeMembership(invited, '2026-08-03T18:01:00.000Z');

    expect(() => activateMembership(revoked, '2026-08-03T18:02:00.000Z')).toThrow(
      'تغییر وضعیت عضویت',
    );
  });

  it('rejects suspending an invited membership', () => {
    const invited = createMembership({
      id: membershipId,
      userId,
      organizationId,
      now: '2026-08-03T18:00:00.000Z',
    });

    expect(() =>
      transitionMembershipStatus(invited, 'suspended', '2026-08-03T18:01:00.000Z'),
    ).toThrow(OrganizationDomainError);
  });

  it('keeps memberships in different organizations independent', () => {
    const first = activateMembership(
      createMembership({
        id: membershipId,
        userId,
        organizationId,
        now: '2026-08-03T18:00:00.000Z',
      }),
      '2026-08-03T18:01:00.000Z',
    );
    const second = createMembership({
      id: '55555555-5555-4555-8555-555555555555',
      userId,
      organizationId: secondOrganizationId,
      now: '2026-08-03T18:00:00.000Z',
    });
    const suspended = suspendMembership(first, '2026-08-03T18:02:00.000Z');

    expect(suspended.status).toBe('suspended');
    expect(second.status).toBe('invited');
    expect(second.organizationId).toBe(secondOrganizationId);
  });
});
