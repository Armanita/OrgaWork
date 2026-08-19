import { afterEach, describe, expect, it, vi } from 'vitest';

import { workManagementRequest, type CreateOwnCaseResult } from './work-management-api.js';

const organizationId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Work Management web API client', () => {
  it('calls the strict Work Management BFF and returns the envelope data', async () => {
    const created: CreateOwnCaseResult = {
      caseId: '22222222-2222-4222-8222-222222222222',
      title: 'Customer renewal',
      status: 'open',
      priority: 'high',
      dueAt: null,
      responsibilityId: '33333333-3333-4333-8333-333333333333',
      initialAction: {
        id: '44444444-4444-4444-8444-444444444444',
        title: 'Call customer',
        status: 'pending',
        dueAt: null,
      },
      replayed: false,
    };

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: created }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await workManagementRequest<CreateOwnCaseResult>(
      `organizations/${organizationId}/cases`,
      {
        method: 'POST',
        headers: {
          'x-csrf-token': 'csrf-token',
          'x-idempotency-key': 'wm01:web:test:0001',
        },
        body: JSON.stringify({
          title: 'Customer renewal',
          description: 'Follow the renewal case',
          priority: 'high',
          initialActionTitle: 'Call customer',
        }),
      },
    );

    expect(result).toEqual(created);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (call === undefined) {
      throw new Error('Expected the Work Management fetch call.');
    }

    const [input, init] = call;
    expect(input).toBe(`/api/work-management/organizations/${organizationId}/cases`);
    expect(init?.method).toBe('POST');
    expect(init?.cache).toBe('no-store');

    const headers = new Headers(init?.headers);
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe('csrf-token');
    expect(headers.get('x-idempotency-key')).toBe('wm01:web:test:0001');
  });

  it('preserves stable API error code/field without exposing a raw provider message', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: 'AUTHORIZATION_DENIED',
            message: 'raw server wording',
            field: 'organizationId',
          },
        }),
        {
          status: 403,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = workManagementRequest<CreateOwnCaseResult>(
      `organizations/${organizationId}/cases`,
      {
        method: 'POST',
        body: '{}',
      },
    );

    await expect(request).rejects.toMatchObject({
      name: 'WorkManagementApiError',
      status: 403,
      code: 'AUTHORIZATION_DENIED',
      field: 'organizationId',
      message: 'Work Management request failed.',
    });
  });
});
