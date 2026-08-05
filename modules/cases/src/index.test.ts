import { describe, expect, it } from 'vitest';

import { createActionItemId } from '@workspace/contracts';

import {
  CaseDomainError,
  applyOutcomeAndContinuation,
  assertFollowUpCaseInvariant,
  changeCurrentWork,
  changePrimaryAssignment,
  closeCase,
  createFollowUpCase,
  reopenCase,
} from './index.js';

const ids = {
  case: '11111111-1111-4111-8111-111111111111',
  organization: '22222222-2222-4222-8222-222222222222',
  creator: '33333333-3333-4333-8333-333333333333',
  subject: '44444444-4444-4444-8444-444444444444',
  assignment: '55555555-5555-4555-8555-555555555555',
  nextAssignment: '66666666-6666-4666-8666-666666666666',
  action: '77777777-7777-4777-8777-777777777777',
  nextAction: '88888888-8888-4888-8888-888888888888',
} as const;

function openCase() {
  return createFollowUpCase({
    id: ids.case,
    organizationId: ids.organization,
    title: '  پیگیری تمدید قرارداد  ',
    createdByUserId: ids.creator,
    subjectUserId: ids.subject,
    primaryAssignmentId: ids.assignment,
    currentWork: { kind: 'action', id: createActionItemId(ids.action) },
    now: '2026-08-05T10:00:00.000Z',
  });
}

describe('follow-up case contract', () => {
  it('creates an open case with exactly one primary assignment and current work', () => {
    const value = openCase();

    expect(value.title).toBe('پیگیری تمدید قرارداد');
    expect(value.primaryAssignmentId).toBe(ids.assignment);
    expect(value.currentWork).toEqual({ kind: 'action', id: ids.action });
    expect(value.subjectUserId).toBe(ids.subject);
  });

  it('supports creation for the creator when no separate subject is supplied', () => {
    const value = createFollowUpCase({
      id: ids.case,
      organizationId: ids.organization,
      title: 'پرونده شخصی',
      createdByUserId: ids.creator,
      primaryAssignmentId: ids.assignment,
      currentWork: { kind: 'action', id: createActionItemId(ids.action) },
      now: '2026-08-05T10:00:00.000Z',
    });

    expect(value.subjectUserId).toBe(ids.creator);
  });

  it('changes primary assignment without creating a second primary slot', () => {
    const changed = changePrimaryAssignment(
      openCase(),
      ids.nextAssignment,
      '2026-08-05T10:01:00.000Z',
    );

    expect(changed.primaryAssignmentId).toBe(ids.nextAssignment);
    expect(changed.version).toBe(2);
  });

  it('keeps repeated current-work commands idempotent', () => {
    const value = openCase();

    const currentWork = { kind: 'action', id: createActionItemId(ids.action) } as const;

    expect(changeCurrentWork(value, currentWork, '2026-08-05T10:01:00.000Z')).toBe(value);
  });

  it('records outcome and next action atomically', () => {
    const changed = applyOutcomeAndContinuation(
      openCase(),
      {
        outcome: 'مدارک اولیه دریافت شد',
        continuation: { kind: 'action', id: createActionItemId(ids.nextAction) },
      },
      '2026-08-05T10:02:00.000Z',
    );

    expect(changed.lastOutcome).toBe('مدارک اولیه دریافت شد');
    expect(changed.currentWork).toEqual({ kind: 'action', id: ids.nextAction });
  });

  it('resolves and closes a case through controlled transitions', () => {
    const resolved = applyOutcomeAndContinuation(
      openCase(),
      { outcome: 'موضوع حل شد', continuation: { kind: 'resolved' } },
      '2026-08-05T10:03:00.000Z',
    );
    const closed = closeCase(resolved, '2026-08-05T10:04:00.000Z');

    expect(resolved.currentWork).toBeNull();
    expect(resolved.primaryAssignmentId).toBeNull();
    expect(closed.status).toBe('closed');
  });

  it('reopens a resolved case only with a new assignment and current work', () => {
    const resolved = applyOutcomeAndContinuation(
      openCase(),
      { outcome: 'موضوع حل شد', continuation: { kind: 'resolved' } },
      '2026-08-05T10:03:00.000Z',
    );
    const reopened = reopenCase(resolved, {
      primaryAssignmentId: ids.nextAssignment,
      currentWork: { kind: 'action', id: createActionItemId(ids.nextAction) },
      now: '2026-08-05T10:05:00.000Z',
    });

    expect(reopened.status).toBe('open');
    expect(reopened.primaryAssignmentId).toBe(ids.nextAssignment);
  });

  it('rejects an open case that loses its current work', () => {
    expect(() => assertFollowUpCaseInvariant({ ...openCase(), currentWork: null })).toThrow(
      CaseDomainError,
    );
  });

  it('requires a cancellation reason in the same atomic update', () => {
    expect(() =>
      applyOutcomeAndContinuation(
        openCase(),
        { outcome: 'لغو شد', continuation: { kind: 'cancelled', reason: ' ' } },
        '2026-08-05T10:06:00.000Z',
      ),
    ).toThrow('دلیل روشن');
  });
});
