import { describe, expect, it } from 'vitest';

import { planCreateOwnCase } from './create-own-case.js';

const ids = {
  organization: '11111111-1111-4111-8111-111111111111',
  membership: '22222222-2222-4222-8222-222222222222',
  case: '33333333-3333-4333-8333-333333333333',
  responsibility: '44444444-4444-4444-8444-444444444444',
  action: '55555555-5555-4555-8555-555555555555',
} as const;

function createPlan() {
  return planCreateOwnCase(
    {
      organizationId: ids.organization,
      actorMembershipId: ids.membership,
      title: 'پرونده تمدید قرارداد',
      description: 'پیگیری تمدید قرارداد جاری',
      priority: 'normal',
      dueAt: '2026-08-25T10:00:00.000Z',
      initialAction: {
        title: 'بررسی مدارک قرارداد',
        dueAt: '2026-08-20T10:00:00.000Z',
      },
    },
    {
      identity: {
        caseId: ids.case,
        responsibilityId: ids.responsibility,
        actionId: ids.action,
      },
      now: '2026-08-18T15:00:00.000Z',
    },
  );
}

describe('CreateOwnCase application orchestration', () => {
  it('creates one coherent self-owned case plan', () => {
    const plan = createPlan();

    expect(plan.case).toMatchObject({
      id: ids.case,
      organizationId: ids.organization,
      createdByMembershipId: ids.membership,
      status: 'open',
      priority: 'normal',
      primaryResponsibilityId: ids.responsibility,
      currentWork: {
        kind: 'action',
        id: ids.action,
      },
      version: 1,
    });

    expect(plan.primaryResponsibility).toMatchObject({
      id: ids.responsibility,
      caseId: ids.case,
      organizationId: ids.organization,
      status: 'accepted',
      acceptanceMode: 'self',
      role: 'primary',
      target: {
        kind: 'membership',
        membershipId: ids.membership,
      },
      assignedByMembershipId: ids.membership,
      acceptedByMembershipId: ids.membership,
      version: 1,
    });

    expect(plan.initialAction).toMatchObject({
      id: ids.action,
      caseId: ids.case,
      organizationId: ids.organization,
      sourceAssignmentId: ids.responsibility,
      responsible: {
        kind: 'membership',
        membershipId: ids.membership,
      },
      createdByMembershipId: ids.membership,
      kind: 'primary',
      status: 'pending',
      version: 1,
    });
  });

  it('uses the same business timestamp for all newly created records', () => {
    const plan = createPlan();

    expect(plan.case.createdAt).toBe('2026-08-18T15:00:00.000Z');
    expect(plan.primaryResponsibility.createdAt).toBe(plan.case.createdAt);
    expect(plan.initialAction.createdAt).toBe(plan.case.createdAt);
  });

  it('does not allow the client to choose a different self responsibility target', () => {
    const plan = createPlan();

    expect(plan.primaryResponsibility.target).toEqual({
      kind: 'membership',
      membershipId: ids.membership,
    });
    expect(plan.initialAction.responsible).toEqual({
      kind: 'membership',
      membershipId: ids.membership,
    });
  });

  it('omits optional due dates instead of passing explicit undefined values', () => {
    const plan = planCreateOwnCase(
      {
        organizationId: ids.organization,
        actorMembershipId: ids.membership,
        title: 'پرونده بدون موعد',
        description: 'شرح معتبر بدون موعد',
        priority: 'low',
        initialAction: {
          title: 'اقدام بدون موعد',
        },
      },
      {
        identity: {
          caseId: ids.case,
          responsibilityId: ids.responsibility,
          actionId: ids.action,
        },
        now: '2026-08-18T15:00:00.000Z',
      },
    );

    expect(plan.case.dueAt).toBeNull();
    expect(plan.initialAction.dueAt).toBeNull();
  });

  it('propagates domain validation instead of creating a partial plan', () => {
    expect(() =>
      planCreateOwnCase(
        {
          organizationId: ids.organization,
          actorMembershipId: ids.membership,
          title: 'پرونده',
          description: 'شرح معتبر',
          priority: 'normal',
          initialAction: {
            title: '   ',
          },
        },
        {
          identity: {
            caseId: ids.case,
            responsibilityId: ids.responsibility,
            actionId: ids.action,
          },
          now: '2026-08-18T15:00:00.000Z',
        },
      ),
    ).toThrow('عنوان اقدام');
  });
});
