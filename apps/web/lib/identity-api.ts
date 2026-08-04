export interface ApiEnvelope<Data> {
  readonly ok: boolean;
  readonly data?: Data;
  readonly error?: { readonly message?: string };
}

export interface WebSession {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly sessionRevision: number;
  readonly currentOrganizationId: string | null;
  readonly csrfToken: string;
}

export async function identityRequest<Data>(
  path: string,
  options: RequestInit = {},
): Promise<Data> {
  const response = await fetch(`/api/identity/${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...options.headers,
    },
    cache: 'no-store',
  });
  const envelope = (await response.json()) as ApiEnvelope<Data>;
  if (!response.ok || !envelope.ok || envelope.data === undefined) {
    throw new Error(envelope.error?.message ?? 'انجام درخواست ناموفق بود.');
  }
  return envelope.data;
}
