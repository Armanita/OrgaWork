import { describe, expect, it } from 'vitest';

import {
  FollowUpDomainError,
  assertFollowUpTransition,
  cancelDecisionRequest,
  closeDecisionRequest,
  completeFollowUpState,
  createBlockedState,
  createDecisionRequest,
  createExternalWait,
  createInternalWait,
  createPausedState,
  followUpTransitionMatrix,
  isFollowUpTransitionAllowed,
  recordDecisionResponse,
} from './index.js';

const ids = {
  state: '11111111-1111-4111-8111-111111111111',
  case: '22222222-2222-4222-8222-222222222222',
  organization: '33333333-3333-4333-8333-333333333333',
  user: '44444444-4444-4444-8444-444444444444',
  team: '55555555-5555-4555-8555-555555555555',
  decisionMaker: '66666666-6666-4666-8666-666666666666',
  decisionRequest: '77777777-7777-4777-8777-777777777777',
  response1: '88888888-8888-4888-8888-888888888888',
  response2: '99999999-9999-4999-8999-999999999999',
} as const;

function decisionRequest() {
  return createDecisionRequest({
    id: ids.decisionRequest,
    caseId: ids.case,
    organizationId: ids.organization,
    requestedByUserId: ids.user,
    decisionMakerUserId: ids.decisionMaker,
    question: 'آیا قرارداد تمدید شود؟',
    now: '2026-08-05T13:00:00.000Z',
  });
}

describe('follow-up state contract', () => {
  it('keeps internal wait distinct and requires exactly one internal target', () => {
    const value = createInternalWait({
      id: ids.state,
      caseId: ids.case,
      organizationId: ids.organization,
      summary: 'انتظار پاسخ واحد حقوقی',
      targetTeamId: ids.team,
      now: '2026-08-05T13:00:00.000Z',
    });

    expect(value.kind).toBe('internal_wait');
    expect(value.targetTeamId).toBe(ids.team);
    expect(() =>
      createInternalWait({
        id: ids.state,
        caseId: ids.case,
        organizationId: ids.organization,
        summary: 'نامعتبر',
        now: '2026-08-05T13:00:00.000Z',
      }),
    ).toThrow('دقیقاً یک کاربر یا تیم');
  });

  it('keeps external wait distinct from internal wait', () => {
    const value = createExternalWait({
      id: ids.state,
      caseId: ids.case,
      organizationId: ids.organization,
      summary: 'انتظار پاسخ فروشنده',
      externalParty: 'شرکت تأمین‌کننده',
      now: '2026-08-05T13:00:00.000Z',
    });

    expect(value.kind).toBe('external_wait');
    expect(value.externalParty).toBe('شرکت تأمین‌کننده');
  });

  it('keeps blocked and paused states semantically separate', () => {
    const blocked = createBlockedState({
      id: ids.state,
      caseId: ids.case,
      organizationId: ids.organization,
      summary: 'کمبود سند',
      blocker: 'گواهی مالیاتی موجود نیست',
      now: '2026-08-05T13:00:00.000Z',
    });
    const paused = createPausedState({
      id: ids.state,
      caseId: ids.case,
      organizationId: ids.organization,
      summary: 'توقف برنامه‌ریزی‌شده',
      reason: 'تعطیلات رسمی',
      now: '2026-08-05T13:00:00.000Z',
    });

    expect(blocked.kind).toBe('blocked');
    expect(paused.kind).toBe('paused');
  });

  it('completes a follow-up state only with outcome and continuation', () => {
    const wait = createExternalWait({
      id: ids.state,
      caseId: ids.case,
      organizationId: ids.organization,
      summary: 'انتظار پاسخ',
      externalParty: 'فروشنده',
      now: '2026-08-05T13:00:00.000Z',
    });
    const completed = completeFollowUpState(
      wait,
      { outcome: 'پاسخ دریافت شد', continuation: { kind: 'resolved' } },
      '2026-08-05T13:01:00.000Z',
    );

    expect(completed.status).toBe('completed');
    expect(completed.completion?.continuation.kind).toBe('resolved');
  });

  it('publishes an explicit allowed and forbidden transition matrix', () => {
    expect(followUpTransitionMatrix.cancelled).toEqual([]);
    expect(isFollowUpTransitionAllowed('blocked', 'blocked')).toBe(false);
    expect(isFollowUpTransitionAllowed('blocked', 'action')).toBe(true);
    expect(() => assertFollowUpTransition('cancelled', 'action')).toThrow(FollowUpDomainError);
  });
});

describe('versioned decision contract', () => {
  it('creates an open decision request', () => {
    const value = decisionRequest();

    expect(value.status).toBe('open');
    expect(value.latestResponseRevision).toBe(0);
  });

  it('records the first response as revision one', () => {
    const result = recordDecisionResponse(decisionRequest(), {
      id: ids.response1,
      expectedRevision: 0,
      answer: 'تمدید شود',
      respondedByUserId: ids.decisionMaker,
      now: '2026-08-05T13:01:00.000Z',
    });

    expect(result.response.revision).toBe(1);
    expect(result.response.supersedesResponseId).toBeNull();
    expect(result.request.status).toBe('answered');
  });

  it('amends a response by appending a new revision', () => {
    const first = recordDecisionResponse(decisionRequest(), {
      id: ids.response1,
      expectedRevision: 0,
      answer: 'تمدید شود',
      respondedByUserId: ids.decisionMaker,
      now: '2026-08-05T13:01:00.000Z',
    });
    const second = recordDecisionResponse(first.request, {
      id: ids.response2,
      expectedRevision: 1,
      answer: 'تمدید مشروط انجام شود',
      respondedByUserId: ids.decisionMaker,
      now: '2026-08-05T13:02:00.000Z',
    });

    expect(second.response.revision).toBe(2);
    expect(second.response.supersedesResponseId).toBe(ids.response1);
  });

  it('rejects a stale response revision', () => {
    const first = recordDecisionResponse(decisionRequest(), {
      id: ids.response1,
      expectedRevision: 0,
      answer: 'تمدید شود',
      respondedByUserId: ids.decisionMaker,
      now: '2026-08-05T13:01:00.000Z',
    });

    expect(() =>
      recordDecisionResponse(first.request, {
        id: ids.response2,
        expectedRevision: 0,
        answer: 'پاسخ قدیمی',
        respondedByUserId: ids.decisionMaker,
        now: '2026-08-05T13:02:00.000Z',
      }),
    ).toThrow('نسخه جاری');
  });

  it('closes only an answered decision request', () => {
    expect(() => closeDecisionRequest(decisionRequest(), '2026-08-05T13:01:00.000Z')).toThrow(
      'پاسخ‌داده‌شده',
    );
    const answered = recordDecisionResponse(decisionRequest(), {
      id: ids.response1,
      expectedRevision: 0,
      answer: 'تمدید شود',
      respondedByUserId: ids.decisionMaker,
      now: '2026-08-05T13:01:00.000Z',
    }).request;

    expect(closeDecisionRequest(answered, '2026-08-05T13:02:00.000Z').status).toBe('closed');
  });

  it('cancels an open decision request only with a reason', () => {
    expect(
      cancelDecisionRequest(decisionRequest(), 'نیاز رفع شد', '2026-08-05T13:01:00.000Z').status,
    ).toBe('cancelled');
    expect(() => cancelDecisionRequest(decisionRequest(), ' ', '2026-08-05T13:01:00.000Z')).toThrow(
      'دلیل روشن',
    );
  });
});
