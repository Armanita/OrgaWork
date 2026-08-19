import type { NextRequest } from 'next/server';

const uuidPattern = '[0-9a-f-]{36}';
const platformPathPattern = new RegExp(
  `^(?:session|audit|organizations|organizations/${uuidPattern}|organizations/${uuidPattern}/initial-admin|organizations/${uuidPattern}/admins|organizations/${uuidPattern}/admins/${uuidPattern})$`,
  'u',
);

function apiBaseUrl(): string {
  const value = process.env['ORGAWORK_API_INTERNAL_URL']?.trim() ?? 'http://127.0.0.1:3001';
  return value.replace(/\/+$/u, '');
}

async function proxy(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly path: readonly string[] }> },
): Promise<Response> {
  const parameters = await context.params;
  const path = parameters.path.join('/');
  if (!platformPathPattern.test(path)) {
    return Response.json(
      { ok: false, error: { message: 'مسیر کنترل‌پلین مجاز نیست.' } },
      { status: 404 },
    );
  }

  const headers = new Headers();
  for (const name of [
    'content-type',
    'cookie',
    'x-csrf-token',
    'idempotency-key',
    'x-request-id',
    'x-correlation-id',
  ]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set('accept', 'application/json');

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
  const upstream = await fetch(`${apiBaseUrl()}/v1/platform/${path}${request.nextUrl.search}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
    cache: 'no-store',
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  for (const name of ['content-type', 'cache-control', 'x-request-id', 'x-correlation-id']) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }
  responseHeaders.set('cache-control', 'no-store');

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
