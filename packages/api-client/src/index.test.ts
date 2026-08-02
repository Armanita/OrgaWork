import { describe, expect, it } from 'vitest';

import type { CorrelationId, RequestId } from '@workspace/contracts';

import {
  generatedOperations,
  OrgaWorkApiClient,
  OrgaWorkApiClientError,
  type ApiClientFetch,
} from './index.js';

function response(value: unknown, status = 200): Awaited<ReturnType<ApiClientFetch>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: (): Promise<unknown> => Promise.resolve(value),
  };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }

  throw new Error('انتظار می‌رفت مشتری نوع‌دار با خطا متوقف شود.');
}

describe('typed API client', () => {
  it('calls and validates the health operation', async () => {
    const calls: string[] = [];
    const client = new OrgaWorkApiClient('http://127.0.0.1:3001/', (url) => {
      calls.push(url);

      return Promise.resolve(
        response({
          service: 'orgawork-api',
          status: 'ok',
          timestamp: '2026-08-03T00:00:00.000Z',
        }),
      );
    });

    await expect(client.health()).resolves.toMatchObject({
      service: 'orgawork-api',
      status: 'ok',
    });
    expect(calls).toEqual(['http://127.0.0.1:3001/health']);
  });

  it('calls and validates the readiness operation', async () => {
    const client = new OrgaWorkApiClient('http://127.0.0.1:3001', (url) => {
      expect(url).toBe('http://127.0.0.1:3001/ready');

      return Promise.resolve(
        response({
          service: 'orgawork-api',
          status: 'ready',
          timestamp: '2026-08-03T00:00:00.000Z',
        }),
      );
    });

    await expect(client.readiness()).resolves.toMatchObject({
      service: 'orgawork-api',
      status: 'ready',
    });
  });

  it('sends request and correlation identifiers', async () => {
    const requestId = '11111111-1111-4111-8111-111111111111' as RequestId;
    const correlationId = '22222222-2222-4222-8222-222222222222' as CorrelationId;
    const client = new OrgaWorkApiClient('https://example.test', (_url, init) => {
      expect(init.headers).toMatchObject({
        'x-request-id': requestId,
        'x-correlation-id': correlationId,
      });

      return Promise.resolve(
        response({
          service: 'orgawork-api',
          status: 'ok',
          timestamp: '2026-08-03T00:00:00.000Z',
        }),
      );
    });

    await client.health({ requestId, correlationId });
  });

  it('rejects invalid base URLs with a stable error', () => {
    expect(() => new OrgaWorkApiClient('file:///tmp/api')).toThrowError(
      expect.objectContaining({
        code: 'INVALID_BASE_URL',
      }),
    );
  });

  it('maps transport and HTTP failures to stable errors', async () => {
    const transportClient = new OrgaWorkApiClient('https://example.test', () =>
      Promise.reject(new Error('token=must-not-leak')),
    );
    const httpClient = new OrgaWorkApiClient('https://example.test', () =>
      Promise.resolve(response({}, 503)),
    );

    await expect(transportClient.health()).rejects.toMatchObject({
      code: 'TRANSPORT_FAILED',
    });
    await expect(httpClient.health()).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 503,
    });
  });

  it('rejects malformed successful payloads without leaking content', async () => {
    const client = new OrgaWorkApiClient('https://example.test', () =>
      Promise.resolve(response({ password: 'must-not-leak' })),
    );
    const error = await captureError(client.health());

    expect(error).toBeInstanceOf(OrgaWorkApiClientError);
    expect(error).toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    expect(String(error)).not.toContain('must-not-leak');
  });

  it('keeps generated operation metadata stable', () => {
    expect(generatedOperations).toEqual({
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
});
