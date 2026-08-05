import { describe, expect, it } from 'vitest';

import { createActionItemId } from '@workspace/contracts';

import {
  ActionDomainError,
  assertAtMostOneActivePrimaryAction,
  cancelAction,
  completeAction,
  createActionItem,
  startAction,
} from './index.js';

const ids = {
  action: '11111111-1111-4111-8111-111111111111',
  secondAction: '22222222-2222-4222-8222-222222222222',
  case: '33333333-3333-4333-8333-333333333333',
  organization: '44444444-4444-4444-8444-444444444444',
  assignment: '55555555-5555-4555-8555-555555555555',
  nextAction: '66666666-6666-4666-8666-666666666666',
} as const;

function pendingPrimary() {
  return createActionItem({
    id: ids.action,
    caseId: ids.case,
    organizationId: ids.organization,
    assignmentId: ids.assignment,
    kind: 'primary',
    title: '  بررسی مدارک  ',
    now: '2026-08-05T12:00:00.000Z',
  });
}

describe('action item contract', () => {
  it('creates a normalized primary action', () => {
    const value = pendingPrimary();

    expect(value.title).toBe('بررسی مدارک');
    expect(value.parentActionId).toBeNull();
  });

  it('requires a parent for every secondary action', () => {
    expect(() =>
      createActionItem({
        id: ids.secondAction,
        caseId: ids.case,
        organizationId: ids.organization,
        assignmentId: ids.assignment,
        kind: 'secondary',
        title: 'اقدام فرعی',
        now: '2026-08-05T12:00:00.000Z',
      }),
    ).toThrow(ActionDomainError);
  });

  it('starts a pending action', () => {
    expect(startAction(pendingPrimary(), '2026-08-05T12:01:00.000Z').status).toBe('in_progress');
  });

  it('records outcome and continuation in one completion value', () => {
    const started = startAction(pendingPrimary(), '2026-08-05T12:01:00.000Z');
    const completed = completeAction(
      started,
      {
        outcome: 'مدارک بررسی شد',
        continuation: { kind: 'action', id: createActionItemId(ids.nextAction) },
      },
      '2026-08-05T12:02:00.000Z',
    );

    expect(completed.completion).toMatchObject({
      outcome: 'مدارک بررسی شد',
      continuation: { kind: 'action', id: ids.nextAction },
    });
  });

  it('rejects completion without a result', () => {
    const started = startAction(pendingPrimary(), '2026-08-05T12:01:00.000Z');

    expect(() =>
      completeAction(
        started,
        { outcome: ' ', continuation: { kind: 'resolved' } },
        '2026-08-05T12:02:00.000Z',
      ),
    ).toThrow('بدون نتیجه');
  });

  it('cancels only active actions with a reason', () => {
    expect(cancelAction(pendingPrimary(), 'تغییر برنامه', '2026-08-05T12:02:00.000Z').status).toBe(
      'cancelled',
    );
    expect(() => cancelAction(pendingPrimary(), ' ', '2026-08-05T12:02:00.000Z')).toThrow(
      'دلیل روشن',
    );
  });

  it('rejects repeated completion', () => {
    const started = startAction(pendingPrimary(), '2026-08-05T12:01:00.000Z');
    const completed = completeAction(
      started,
      { outcome: 'تمام شد', continuation: { kind: 'resolved' } },
      '2026-08-05T12:02:00.000Z',
    );

    expect(() =>
      completeAction(
        completed,
        { outcome: 'تکرار', continuation: { kind: 'resolved' } },
        '2026-08-05T12:03:00.000Z',
      ),
    ).toThrow(ActionDomainError);
  });

  it('rejects multiple active primary actions for one case', () => {
    const second = createActionItem({
      id: ids.secondAction,
      caseId: ids.case,
      organizationId: ids.organization,
      assignmentId: ids.assignment,
      kind: 'primary',
      title: 'اقدام دوم',
      now: '2026-08-05T12:00:00.000Z',
    });

    expect(() => assertAtMostOneActivePrimaryAction([pendingPrimary(), second])).toThrow(
      'فقط یک اقدام اصلی فعال',
    );
  });
});
