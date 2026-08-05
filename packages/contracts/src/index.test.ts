import { describe, expect, it } from 'vitest';

import {
  contractVersion,
  continuationKinds,
  currentWorkKinds,
  createActionItemId,
  createApiError,
  createApiSuccess,
  createCaseAssignmentId,
  createCaseId,
  createCorrelationId,
  createDecisionRequestId,
  createDecisionResponseId,
  createFollowUpStateId,
  createIdempotencyKey,
  createOrganizationId,
  createPageInfo,
  createRequestId,
  createSessionOrganizationContext,
  createUtcTimestamp,
  normalizeContractField,
  normalizeFilterSpec,
  normalizePageRequest,
  normalizeSortSpec,
  contractOperations,
  identityOrganizationOperations,
  parseHealthResponse,
  parseReadinessResponse,
} from './index.js';

const identifiers = {
  organization: '11111111-1111-4111-8111-111111111111',
  user: '22222222-2222-4222-8222-222222222222',
  session: '33333333-3333-4333-8333-333333333333',
  request: '44444444-4444-4444-8444-444444444444',
  correlation: '55555555-5555-4555-8555-555555555555',
  case: '66666666-6666-4666-8666-666666666666',
  assignment: '77777777-7777-4777-8777-777777777777',
  action: '88888888-8888-4888-8888-888888888888',
  followUpState: '99999999-9999-4999-8999-999999999999',
  decisionRequest: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  decisionResponse: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
} as const;

function responseMeta() {
  return {
    requestId: createRequestId(identifiers.request),
    correlationId: createCorrelationId(identifiers.correlation),
    timestamp: createUtcTimestamp('2026-08-02T10:20:30.000Z'),
  };
}

describe('shared contract foundations', () => {
  it('exposes a stable contract version', () => {
    expect(contractVersion).toBe('1.0.0');
  });

  it('normalizes valid identifiers', () => {
    expect(createOrganizationId(identifiers.organization.toUpperCase())).toBe(
      identifiers.organization,
    );
  });

  it('rejects invalid identifiers', () => {
    expect(() => createRequestId('invalid')).toThrow(TypeError);
  });

  it('normalizes valid UTC timestamps', () => {
    expect(createUtcTimestamp('2026-08-02T10:20:30Z')).toBe('2026-08-02T10:20:30.000Z');
  });

  it('rejects non-UTC timestamps', () => {
    expect(() => createUtcTimestamp('2026-08-02')).toThrow(TypeError);
  });

  it('creates the standard success response', () => {
    expect(createApiSuccess({ value: 1 }, responseMeta())).toMatchObject({
      ok: true,
      data: { value: 1 },
      meta: { contractVersion: '1.0.0' },
    });
  });

  it('creates a stable Persian public error', () => {
    expect(
      createApiError('VALIDATION_ERROR', 'مقدار واردشده معتبر نیست', responseMeta(), 'title'),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'مقدار واردشده معتبر نیست',
        field: 'title',
      },
    });
  });

  it('normalizes pagination and creates page metadata', () => {
    const request = normalizePageRequest({ page: 2, pageSize: 10 });

    expect(createPageInfo(request, 25)).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });
  });

  it('rejects an excessive page size', () => {
    expect(() => normalizePageRequest({ pageSize: 101 })).toThrow(RangeError);
  });

  it('normalizes sorting and safe contract fields', () => {
    expect(normalizeSortSpec({ field: 'createdAt', direction: 'desc' })).toEqual({
      field: 'createdAt',
      direction: 'desc',
    });
    expect(normalizeContractField('organization.id')).toBe('organization.id');
  });

  it('rejects unsafe fields and invalid filters', () => {
    expect(() => normalizeContractField('created at')).toThrow(TypeError);
    expect(() =>
      normalizeFilterSpec({
        field: 'status',
        operator: 'in',
        value: 'open',
      }),
    ).toThrow(TypeError);
  });

  it('creates a validated session and organization context', () => {
    expect(
      createSessionOrganizationContext({
        sessionId: identifiers.session,
        userId: identifiers.user,
        organizationId: identifiers.organization,
        requestId: identifiers.request,
        correlationId: identifiers.correlation,
      }),
    ).toMatchObject({
      userId: identifiers.user,
      organizationId: identifiers.organization,
      requestId: identifiers.request,
    });
  });

  it('creates stable identifiers for the P34 contract', () => {
    expect(createCaseId(identifiers.case)).toBe(identifiers.case);
    expect(createCaseAssignmentId(identifiers.assignment)).toBe(identifiers.assignment);
    expect(createActionItemId(identifiers.action)).toBe(identifiers.action);
    expect(createFollowUpStateId(identifiers.followUpState)).toBe(identifiers.followUpState);
    expect(createDecisionRequestId(identifiers.decisionRequest)).toBe(identifiers.decisionRequest);
    expect(createDecisionResponseId(identifiers.decisionResponse)).toBe(
      identifiers.decisionResponse,
    );
  });

  it('validates idempotency keys without exposing secrets', () => {
    expect(createIdempotencyKey('case:create:request-0001')).toBe('case:create:request-0001');
    expect(() => createIdempotencyKey('short')).toThrow(TypeError);
  });

  it('keeps current work and terminal continuations explicitly separated', () => {
    expect(currentWorkKinds).toEqual([
      'action',
      'internal_wait',
      'external_wait',
      'blocked',
      'paused',
      'decision_request',
    ]);
    expect(continuationKinds).toEqual([...currentWorkKinds, 'resolved', 'cancelled']);
  });
});

describe('operational HTTP contracts', () => {
  it('exposes stable health and readiness operations', () => {
    expect(contractOperations).toEqual({
      health: {
        operationId: 'getHealth',
        method: 'GET',
        path: '/health',
      },
      readiness: {
        operationId: 'getReadiness',
        method: 'GET',
        path: '/ready',
      },
    });
  });

  it('parses a valid health response', () => {
    expect(
      parseHealthResponse({
        service: 'orgawork-api',
        status: 'ok',
        timestamp: '2026-08-03T00:00:00.000Z',
      }),
    ).toEqual({
      service: 'orgawork-api',
      status: 'ok',
      timestamp: '2026-08-03T00:00:00.000Z',
    });
  });

  it('parses a valid readiness response', () => {
    expect(
      parseReadinessResponse({
        service: 'orgawork-api',
        status: 'ready',
        timestamp: '2026-08-03T00:00:00.000Z',
      }),
    ).toEqual({
      service: 'orgawork-api',
      status: 'ready',
      timestamp: '2026-08-03T00:00:00.000Z',
    });
  });

  it('rejects malformed operational responses', () => {
    expect(() =>
      parseHealthResponse({
        service: 'orgawork-api',
        status: 'ready',
        timestamp: 'secret=value',
      }),
    ).toThrow(TypeError);
  });

  it('exposes stable identity and organization operation paths', () => {
    expect(identityOrganizationOperations.login.path).toBe('/v1/auth/login');
    expect(identityOrganizationOperations.currentOrganization.path).toBe(
      '/v1/auth/current-organization',
    );
  });
});
