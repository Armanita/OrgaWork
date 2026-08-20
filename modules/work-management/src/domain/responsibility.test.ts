import { describe, expect, it } from 'vitest';

import {
  ResponsibilityDomainError,
  acceptResponsibility,
  assertAtMostOneActivePrimaryResponsibility,
  createCaseResponsibility,
  endResponsibility,
  rejectResponsibility,
  transferResponsibility,
} from './responsibility.js';

const ids = {
  responsibility: '11111111-1111-4111-8111-111111111111',
  secondResponsibility: '22222222-2222-4222-8222-222222222222',
  case: '33333333-3333-4333-8333-333333333333',
  organization: '44444444-4444-4444-8444-444444444444',
  assigneeMembership: '55555555-5555-4555-8555-555555555555',
  assignerMembership: '66666666-6666-4666-8666-666666666666',
  team: '77777777-7777-4777-8777-777777777777',
} as const;

function pendingPrimary() {
  return createCaseResponsibility({
    id: ids.responsibility,
    caseId: ids.case,
    organizationId: ids.organization,
    target: { kind: 'membership', membershipId: ids.assigneeMembership },
    assignedByMembershipId: ids.assignerMembership,
    acceptanceMode: 'explicit',
    role: 'primary',
    now: '2026-08-05T11:00:00.000Z',
  });
}

describe('case responsibility contract v2', () => {
  it('creates an explicit membership responsibility in pending state', () => {
    const value = pendingPrimary();
    expect(value.status).toBe('pending');
    expect(value.role).toBe('primary');
    expect(value.target).toEqual({
      kind: 'membership',
      membershipId: ids.assigneeMembership,
    });
  });

  it('creates self responsibility as accepted only for the same membership', () => {
    const value = createCaseResponsibility({
      id: ids.responsibility,
      caseId: ids.case,
      organizationId: ids.organization,
      target: { kind: 'membership', membershipId: ids.assigneeMembership },
      assignedByMembershipId: ids.assigneeMembership,
      acceptanceMode: 'self',
      role: 'primary',
      now: '2026-08-05T11:00:00.000Z',
    });
    expect(value.status).toBe('accepted');
    expect(value.acceptedByMembershipId).toBe(ids.assigneeMembership);

    expect(() =>
      createCaseResponsibility({
        id: ids.secondResponsibility,
        caseId: ids.case,
        organizationId: ids.organization,
        target: { kind: 'membership', membershipId: ids.assigneeMembership },
        assignedByMembershipId: ids.assignerMembership,
        acceptanceMode: 'self',
        role: 'primary',
        now: '2026-08-05T11:00:00.000Z',
      }),
    ).toThrow('self');
  });

  it('supports a team target and preserves forced acceptance semantics', () => {
    const value = createCaseResponsibility({
      id: ids.responsibility,
      caseId: ids.case,
      organizationId: ids.organization,
      target: { kind: 'team', teamId: ids.team },
      assignedByMembershipId: ids.assignerMembership,
      acceptanceMode: 'forced',
      role: 'primary',
      now: '2026-08-05T11:00:00.000Z',
    });
    expect(value.status).toBe('accepted');
    expect(value.target).toEqual({ kind: 'team', teamId: ids.team });
    expect(value.acceptedByMembershipId).toBeNull();
  });

  it('accepts a pending responsibility with an explicit actor', () => {
    const accepted = acceptResponsibility(
      pendingPrimary(),
      ids.assigneeMembership,
      '2026-08-05T11:01:00.000Z',
    );
    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptedByMembershipId).toBe(ids.assigneeMembership);
  });

  it('rejects a pending responsibility only with actor and reason', () => {
    expect(() =>
      rejectResponsibility(pendingPrimary(), {
        rejectedByMembershipId: ids.assigneeMembership,
        reason: ' ',
        now: '2026-08-05T11:01:00.000Z',
      }),
    ).toThrow('دلیل روشن');

    const rejected = rejectResponsibility(pendingPrimary(), {
      rejectedByMembershipId: ids.assigneeMembership,
      reason: 'تعارض ظرفیت',
      now: '2026-08-05T11:01:00.000Z',
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectedByMembershipId).toBe(ids.assigneeMembership);
  });

  it('transfers an accepted responsibility to a different record', () => {
    const accepted = acceptResponsibility(
      pendingPrimary(),
      ids.assigneeMembership,
      '2026-08-05T11:01:00.000Z',
    );
    const transferred = transferResponsibility(
      accepted,
      ids.secondResponsibility,
      '2026-08-05T11:02:00.000Z',
    );
    expect(transferred.status).toBe('transferred');
    expect(transferred.transferredToResponsibilityId).toBe(ids.secondResponsibility);
  });

  it('can end a pending or accepted responsibility without pretending it was rejected', () => {
    expect(endResponsibility(pendingPrimary(), '2026-08-05T11:02:00.000Z').status).toBe('ended');
    const accepted = acceptResponsibility(
      pendingPrimary(),
      ids.assigneeMembership,
      '2026-08-05T11:01:00.000Z',
    );
    expect(endResponsibility(accepted, '2026-08-05T11:02:00.000Z').status).toBe('ended');
  });

  it('rejects invalid lifecycle transitions', () => {
    const accepted = acceptResponsibility(
      pendingPrimary(),
      ids.assigneeMembership,
      '2026-08-05T11:01:00.000Z',
    );
    expect(() =>
      acceptResponsibility(accepted, ids.assigneeMembership, '2026-08-05T11:02:00.000Z'),
    ).toThrow(ResponsibilityDomainError);
  });

  it('rejects multiple active primary responsibilities for one case', () => {
    const second = createCaseResponsibility({
      id: ids.secondResponsibility,
      caseId: ids.case,
      organizationId: ids.organization,
      target: { kind: 'membership', membershipId: ids.assigneeMembership },
      assignedByMembershipId: ids.assignerMembership,
      acceptanceMode: 'explicit',
      role: 'primary',
      now: '2026-08-05T11:00:00.000Z',
    });

    expect(() => assertAtMostOneActivePrimaryResponsibility([pendingPrimary(), second])).toThrow(
      'فقط یک مسئولیت اصلی فعال',
    );
  });
});
