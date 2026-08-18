import { describe, expect, it } from 'vitest';

import { createActionItemId, createCaseResponsibilityId } from '@workspace/contracts';

import {
  CaseDomainError,
  assertFollowUpCaseInvariant,
  cancelCase,
  changeCurrentWork,
  changePrimaryResponsibility,
  closeCase,
  createFollowUpCase,
  reopenCase,
  resolveCase,
} from './index.js';

const ids = {
  case: '11111111-1111-4111-8111-111111111111',
  organization: '22222222-2222-4222-8222-222222222222',
  creatorMembership: '33333333-3333-4333-8333-333333333333',
  responsibility: '55555555-5555-4555-8555-555555555555',
  nextResponsibility: '66666666-6666-4666-8666-666666666666',
  action: '77777777-7777-4777-8777-777777777777',
  nextAction: '88888888-8888-4888-8888-888888888888',
} as const;

function openCase() {
  return createFollowUpCase({
    id: ids.case,
    organizationId: ids.organization,
    title: '  پیگیری تمدید قرارداد  ',
    description: '  بررسی و تمدید قرارداد جاری  ',
    priority: 'normal',
    dueAt: '2026-08-20T10:00:00.000Z',
    createdByMembershipId: ids.creatorMembership,
    primaryResponsibilityId: ids.responsibility,
    currentWork: { kind: 'action', id: createActionItemId(ids.action) },
    now: '2026-08-05T10:00:00.000Z',
  });
}

describe('follow-up case contract v2', () => {
  it('creates an open case with business fields, primary responsibility and current work', () => {
    const value = openCase();
    expect(value.title).toBe('پیگیری تمدید قرارداد');
    expect(value.description).toBe('بررسی و تمدید قرارداد جاری');
    expect(value.priority).toBe('normal');
    expect(value.createdByMembershipId).toBe(ids.creatorMembership);
    expect(value.primaryResponsibilityId).toBe(ids.responsibility);
    expect(value.currentWork).toEqual({ kind: 'action', id: ids.action });
  });

  it('requires a non-empty description and explicit valid priority', () => {
    expect(() =>
      createFollowUpCase({
        id: ids.case,
        organizationId: ids.organization,
        title: 'پرونده',
        description: ' ',
        priority: 'normal',
        createdByMembershipId: ids.creatorMembership,
        primaryResponsibilityId: ids.responsibility,
        currentWork: { kind: 'action', id: createActionItemId(ids.action) },
        now: '2026-08-05T10:00:00.000Z',
      }),
    ).toThrow(CaseDomainError);

    expect(() =>
      createFollowUpCase({
        id: ids.case,
        organizationId: ids.organization,
        title: 'پرونده',
        description: 'شرح',
        priority: 'urgent',
        createdByMembershipId: ids.creatorMembership,
        primaryResponsibilityId: ids.responsibility,
        currentWork: { kind: 'action', id: createActionItemId(ids.action) },
        now: '2026-08-05T10:00:00.000Z',
      }),
    ).toThrow(CaseDomainError);
  });

  it('supports responsibility acceptance as case current work without changing P4 current-work kinds', () => {
    const value = createFollowUpCase({
      id: ids.case,
      organizationId: ids.organization,
      title: 'ارجاع پرونده',
      description: 'منتظر پذیرش مسئولیت',
      priority: 'high',
      createdByMembershipId: ids.creatorMembership,
      primaryResponsibilityId: ids.responsibility,
      currentWork: {
        kind: 'responsibility_acceptance',
        id: createCaseResponsibilityId(ids.responsibility),
      },
      now: '2026-08-05T10:00:00.000Z',
    });

    expect(value.currentWork).toEqual({
      kind: 'responsibility_acceptance',
      id: ids.responsibility,
    });
  });

  it('changes primary responsibility without creating a second primary slot', () => {
    const changed = changePrimaryResponsibility(
      openCase(),
      ids.nextResponsibility,
      '2026-08-05T10:01:00.000Z',
    );
    expect(changed.primaryResponsibilityId).toBe(ids.nextResponsibility);
    expect(changed.version).toBe(2);
  });

  it('keeps repeated current-work commands idempotent', () => {
    const value = openCase();
    const currentWork = { kind: 'action', id: createActionItemId(ids.action) } as const;
    expect(changeCurrentWork(value, currentWork, '2026-08-05T10:01:00.000Z')).toBe(value);
  });

  it('resolves and closes a case through controlled transitions', () => {
    const resolved = resolveCase(openCase(), '2026-08-05T10:03:00.000Z');
    const closed = closeCase(resolved, '2026-08-05T10:04:00.000Z');
    expect(resolved.currentWork).toBeNull();
    expect(resolved.primaryResponsibilityId).toBeNull();
    expect(closed.status).toBe('closed');
  });

  it('reopens a resolved case only with a new responsibility and current work', () => {
    const resolved = resolveCase(openCase(), '2026-08-05T10:03:00.000Z');
    const reopened = reopenCase(resolved, {
      primaryResponsibilityId: ids.nextResponsibility,
      currentWork: { kind: 'action', id: createActionItemId(ids.nextAction) },
      now: '2026-08-05T10:05:00.000Z',
    });
    expect(reopened.status).toBe('open');
    expect(reopened.primaryResponsibilityId).toBe(ids.nextResponsibility);
  });

  it('rejects an open case that loses responsibility or current work', () => {
    expect(() =>
      assertFollowUpCaseInvariant({ ...openCase(), primaryResponsibilityId: null }),
    ).toThrow(CaseDomainError);
    expect(() => assertFollowUpCaseInvariant({ ...openCase(), currentWork: null })).toThrow(
      CaseDomainError,
    );
  });

  it('requires a cancellation reason and clears active pointers atomically', () => {
    expect(() => cancelCase(openCase(), ' ', '2026-08-05T10:06:00.000Z')).toThrow('دلیل روشن');
    const cancelled = cancelCase(openCase(), 'درخواست ایجادکننده', '2026-08-05T10:06:00.000Z');
    expect(cancelled.primaryResponsibilityId).toBeNull();
    expect(cancelled.currentWork).toBeNull();
  });
});
