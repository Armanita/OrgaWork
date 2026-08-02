import { describe, expect, it } from 'vitest';

import {
  contractVersion,
  createApiError,
  createApiSuccess,
  createCorrelationId,
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
  parseHealthResponse,
  parseReadinessResponse,
} from './index.js';

const identifiers = {
  organization: '11111111-1111-4111-8111-111111111111',
  user: '22222222-2222-4222-8222-222222222222',
  session: '33333333-3333-4333-8333-333333333333',
  request: '44444444-4444-4444-8444-444444444444',
  correlation: '55555555-5555-4555-8555-555555555555',
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
});
