'use client';

export class PlatformRequestError extends Error {
  override readonly name = 'PlatformRequestError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface PlatformEnvelope<Data> {
  readonly ok: boolean;
  readonly data?: Data;
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
}

export async function platformRequest<Data = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<Data> {
  const response = await fetch(`/api/platform/${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  });

  const raw = await response.text();
  let payload: PlatformEnvelope<Data> | undefined;
  if (raw.trim() !== '') {
    try {
      payload = JSON.parse(raw) as PlatformEnvelope<Data>;
    } catch {
      throw new PlatformRequestError(
        response.status,
        'PLATFORM_RESPONSE_INVALID',
        'پاسخ سرویس کنترل‌پلین معتبر نیست.',
      );
    }
  }

  if (!response.ok || payload?.ok !== true || payload.data === undefined) {
    throw new PlatformRequestError(
      response.status,
      payload?.error?.code ?? 'PLATFORM_REQUEST_FAILED',
      payload?.error?.message ?? 'انجام درخواست کنترل‌پلین ناموفق بود.',
    );
  }
  return payload.data;
}
