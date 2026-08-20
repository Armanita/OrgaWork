export interface WorkManagementApiEnvelope<Data> {
  readonly ok: boolean;
  readonly data?: Data;
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly field?: string;
  };
}

export class WorkManagementApiError extends Error {
  override readonly name = 'WorkManagementApiError';
  readonly status: number;
  readonly code: string | undefined;
  readonly field: string | undefined;

  constructor(status: number, code: string | undefined, field: string | undefined) {
    super('Work Management request failed.');
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export interface CreateOwnCaseResult {
  readonly caseId: string;
  readonly title: string;
  readonly status: 'open';
  readonly priority: 'low' | 'normal' | 'high';
  readonly dueAt: string | null;
  readonly responsibilityId: string;
  readonly initialAction: {
    readonly id: string;
    readonly title: string;
    readonly status: 'pending';
    readonly dueAt: string | null;
  };
  readonly replayed: boolean;
}

export async function workManagementRequest<Data>(
  path: string,
  options: RequestInit = {},
): Promise<Data> {
  const normalizedPath = path.replace(/^\/+/u, '');
  const response = await fetch(`/api/work-management/${normalizedPath}`, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...options.headers,
    },
    cache: 'no-store',
  });

  let envelope: WorkManagementApiEnvelope<Data>;
  try {
    envelope = (await response.json()) as WorkManagementApiEnvelope<Data>;
  } catch {
    throw new WorkManagementApiError(response.status, 'SERVICE_UNAVAILABLE', undefined);
  }

  if (!response.ok || !envelope.ok || envelope.data === undefined) {
    throw new WorkManagementApiError(response.status, envelope.error?.code, envelope.error?.field);
  }

  return envelope.data;
}
