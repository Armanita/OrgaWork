import { describe, expect, it } from 'vitest';

import { createActionItemId } from '@workspace/contracts';

import {
  ActionDomainError,
  assertAtMostOneActivePrimaryAction,
  cancelAction,
  completeAction,
  createActionItem,
  recordActionProgress,
  startAction,
} from './index.js';

const ids = {
  action: '11111111-1111-4111-8111-111111111111',
  secondAction: '22222222-2222-4222-8222-222222222222',
  case: '33333333-3333-4333-8333-333333333333',
  organization: '44444444-4444-4444-8444-444444444444',
  sourceAssignment: '55555555-5555-4555-8555-555555555555',
  responsibleMembership: '66666666-6666-4666-8666-666666666666',
  creatorMembership: '77777777-7777-4777-8777-777777777777',
  nextAction: '88888888-8888-4888-8888-888888888888',
} as const;

function pendingPrimary() {
  return createActionItem({
    id: ids.action,
    caseId: ids.case,
    organizationId: ids.organization,
    sourceAssignmentId: ids.sourceAssignment,
    responsible: {
      kind: 'membership',
      membershipId: ids.responsibleMembership,
    },
    createdByMembershipId: ids.creatorMembership,
    kind: 'primary',
    title: '  بررسی مدارک  ',
    dueAt: '2026-08-20T12:00:00.000Z',
    now: '2026-08-05T12:00:00.000Z',
  });
}

describe('action item contract v2', () => {
  it('creates a normalized primary action with independent responsibility', () => {
    const value = pendingPrimary();
    expect(value.title).toBe('بررسی مدارک');
    expect(value.parentActionId).toBeNull();
    expect(value.sourceAssignmentId).toBe(ids.sourceAssignment);
    expect(value.responsible).toEqual({
      kind: 'membership',
      membershipId: ids.responsibleMembership,
    });
    expect(value.createdByMembershipId).toBe(ids.creatorMembership);
  });

  it('requires a parent for every secondary action', () => {
    expect(() =>
      createActionItem({
        id: ids.secondAction,
        caseId: ids.case,
        organizationId: ids.organization,
        responsible: {
          kind: 'membership',
          membershipId: ids.responsibleMembership,
        },
        createdByMembershipId: ids.creatorMembership,
        kind: 'secondary',
        title: 'اقدام فرعی',
        now: '2026-08-05T12:00:00.000Z',
      }),
    ).toThrow(ActionDomainError);
  });

  it('starts a pending action', () => {
    expect(startAction(pendingPrimary(), '2026-08-05T12:01:00.000Z').status).toBe('in_progress');
  });

  it('records append-only progress with an actor without mutating the action', () => {
    const action = pendingPrimary();
    const progress = recordActionProgress(action, {
      recordedByMembershipId: ids.responsibleMembership,
      note: '  مدارک دریافت شد  ',
      now: '2026-08-05T12:01:30.000Z',
    });
    expect(progress.note).toBe('مدارک دریافت شد');
    expect(progress.actionId).toBe(ids.action);
    expect(action.version).toBe(1);
  });

  it('records a structured outcome and continuation in one completion value', () => {
    const started = startAction(pendingPrimary(), '2026-08-05T12:01:00.000Z');
    const completed = completeAction(started, {
      outcome: {
        summary: 'مدارک بررسی شد',
        details: 'مدارک کامل است',
      },
      continuation: { kind: 'action', id: createActionItemId(ids.nextAction) },
      completedByMembershipId: ids.responsibleMembership,
      now: '2026-08-05T12:02:00.000Z',
    });
    expect(completed.completion).toMatchObject({
      outcome: {
        summary: 'مدارک بررسی شد',
        details: 'مدارک کامل است',
      },
      continuation: { kind: 'action', id: ids.nextAction },
      completedByMembershipId: ids.responsibleMembership,
    });
  });

  it('rejects completion without a result', () => {
    const started = startAction(pendingPrimary(), '2026-08-05T12:01:00.000Z');
    expect(() =>
      completeAction(started, {
        outcome: { summary: ' ' },
        continuation: { kind: 'resolved' },
        completedByMembershipId: ids.responsibleMembership,
        now: '2026-08-05T12:02:00.000Z',
      }),
    ).toThrow('بدون نتیجه');
  });

  it('cancels only active actions with a reason and actor', () => {
    expect(
      cancelAction(pendingPrimary(), {
        reason: 'تغییر برنامه',
        cancelledByMembershipId: ids.creatorMembership,
        now: '2026-08-05T12:02:00.000Z',
      }).status,
    ).toBe('cancelled');

    expect(() =>
      cancelAction(pendingPrimary(), {
        reason: ' ',
        cancelledByMembershipId: ids.creatorMembership,
        now: '2026-08-05T12:02:00.000Z',
      }),
    ).toThrow('دلیل روشن');
  });

  it('rejects repeated completion', () => {
    const started = startAction(pendingPrimary(), '2026-08-05T12:01:00.000Z');
    const completed = completeAction(started, {
      outcome: { summary: 'تمام شد' },
      continuation: { kind: 'resolved' },
      completedByMembershipId: ids.responsibleMembership,
      now: '2026-08-05T12:02:00.000Z',
    });

    expect(() =>
      completeAction(completed, {
        outcome: { summary: 'تکرار' },
        continuation: { kind: 'resolved' },
        completedByMembershipId: ids.responsibleMembership,
        now: '2026-08-05T12:03:00.000Z',
      }),
    ).toThrow(ActionDomainError);
  });

  it('rejects multiple active primary actions for one case', () => {
    const second = createActionItem({
      id: ids.secondAction,
      caseId: ids.case,
      organizationId: ids.organization,
      responsible: {
        kind: 'membership',
        membershipId: ids.responsibleMembership,
      },
      createdByMembershipId: ids.creatorMembership,
      kind: 'primary',
      title: 'اقدام دوم',
      now: '2026-08-05T12:00:00.000Z',
    });

    expect(() => assertAtMostOneActivePrimaryAction([pendingPrimary(), second])).toThrow(
      'فقط یک اقدام اصلی فعال',
    );
  });
});
