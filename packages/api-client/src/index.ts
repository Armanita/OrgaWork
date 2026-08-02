import type {
  CorrelationId,
  HealthResponse,
  ReadinessResponse,
  RequestId,
  UtcTimestamp,
} from '@workspace/contracts';

import { generatedOperations } from './generated-contract.js';

export interface ApiClientResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type ApiClientFetch = (
  url: string,
  init: {
    readonly method: 'GET';
    readonly headers: Readonly<Record<string, string>>;
  },
) => Promise<ApiClientResponse>;

export interface ApiClientRequestContext {
  readonly requestId?: RequestId;
  readonly correlationId?: CorrelationId;
}

export type OrgaWorkApiClientErrorCode =
  'INVALID_BASE_URL' | 'TRANSPORT_FAILED' | 'HTTP_ERROR' | 'INVALID_RESPONSE';

export class OrgaWorkApiClientError extends Error {
  public readonly code: OrgaWorkApiClientErrorCode;
  public readonly status: number | undefined;

  public constructor(
    code: OrgaWorkApiClientErrorCode,
    message: string,
    context: { readonly status?: number } = {},
  ) {
    super(message);
    this.name = 'OrgaWorkApiClientError';
    this.code = code;
    this.status = context.status;
  }
}

const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

function normalizeBaseUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new OrgaWorkApiClientError(
      'INVALID_BASE_URL',
      'نشانی پایه رابط برنامه‌نویسی معتبر نیست.',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OrgaWorkApiClientError(
      'INVALID_BASE_URL',
      'نشانی پایه رابط برنامه‌نویسی معتبر نیست.',
    );
  }

  return parsed.toString().replace(/\/+$/u, '');
}

function parseTimestamp(value: unknown): UtcTimestamp {
  if (
    typeof value !== 'string' ||
    !utcTimestampPattern.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new TypeError('زمان پاسخ معتبر نیست.');
  }

  return new Date(value).toISOString() as UtcTimestamp;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOperationalResponse(
  value: unknown,
  status: 'ok' | 'ready',
): HealthResponse | ReadinessResponse {
  if (!isRecord(value) || value['service'] !== 'orgawork-api' || value['status'] !== status) {
    throw new TypeError('پاسخ عملیاتی معتبر نیست.');
  }

  const timestamp = parseTimestamp(value['timestamp']);

  return status === 'ok'
    ? {
        service: 'orgawork-api',
        status: 'ok',
        timestamp,
      }
    : {
        service: 'orgawork-api',
        status: 'ready',
        timestamp,
      };
}

const defaultFetch: ApiClientFetch = async (url, init) =>
  globalThis.fetch(url, {
    method: init.method,
    headers: { ...init.headers },
  });

function createHeaders(context: ApiClientRequestContext): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'cache-control': 'no-store',
  };

  if (context.requestId !== undefined) {
    headers['x-request-id'] = context.requestId;
  }

  if (context.correlationId !== undefined) {
    headers['x-correlation-id'] = context.correlationId;
  }

  return headers;
}

export class OrgaWorkApiClient {
  readonly #baseUrl: string;
  readonly #fetch: ApiClientFetch;

  public constructor(baseUrl: string, fetchImplementation: ApiClientFetch = defaultFetch) {
    this.#baseUrl = normalizeBaseUrl(baseUrl);
    this.#fetch = fetchImplementation;
  }

  async #request(path: string, context: ApiClientRequestContext): Promise<unknown> {
    let response: ApiClientResponse;

    try {
      response = await this.#fetch(this.#baseUrl + path, {
        method: 'GET',
        headers: createHeaders(context),
      });
    } catch {
      throw new OrgaWorkApiClientError(
        'TRANSPORT_FAILED',
        'ارتباط با رابط برنامه‌نویسی ناموفق بود.',
      );
    }

    if (!response.ok) {
      throw new OrgaWorkApiClientError('HTTP_ERROR', 'رابط برنامه‌نویسی پاسخ ناموفق برگرداند.', {
        status: response.status,
      });
    }

    try {
      return await response.json();
    } catch {
      throw new OrgaWorkApiClientError('INVALID_RESPONSE', 'پاسخ رابط برنامه‌نویسی معتبر نیست.');
    }
  }

  public async health(context: ApiClientRequestContext = {}): Promise<HealthResponse> {
    const value = await this.#request(generatedOperations.health.path, context);

    try {
      return parseOperationalResponse(value, 'ok') as HealthResponse;
    } catch {
      throw new OrgaWorkApiClientError(
        'INVALID_RESPONSE',
        'پاسخ سلامت رابط برنامه‌نویسی معتبر نیست.',
      );
    }
  }

  public async readiness(context: ApiClientRequestContext = {}): Promise<ReadinessResponse> {
    const value = await this.#request(generatedOperations.readiness.path, context);

    try {
      return parseOperationalResponse(value, 'ready') as ReadinessResponse;
    } catch {
      throw new OrgaWorkApiClientError(
        'INVALID_RESPONSE',
        'پاسخ آمادگی رابط برنامه‌نویسی معتبر نیست.',
      );
    }
  }
}

export * from './generated-contract.js';
