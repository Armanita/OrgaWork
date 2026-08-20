/* global URL, Buffer, console, process */
import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = 3318;
const organizationId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const csrfToken = 'wm01-browser-csrf-token';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-request-id': requestId,
    'x-correlation-id': correlationId,
  });
  response.end(JSON.stringify(payload));
}

function success(response, statusCode, data) {
  writeJson(response, statusCode, {
    ok: true,
    data,
    meta: {
      requestId,
      correlationId,
      timestamp: '2026-08-19T09:30:00.000Z',
    },
  });
}

function failure(response, statusCode, code, message) {
  writeJson(response, statusCode, {
    ok: false,
    error: { code, message },
    meta: {
      requestId,
      correlationId,
      timestamp: '2026-08-19T09:30:00.000Z',
    },
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sessionData() {
  return {
    session: {
      id: '33333333-3333-4333-8333-333333333333',
      userId: '44444444-4444-4444-8444-444444444444',
      email: 'member@orgawork.test',
      status: 'active',
      sessionRevision: 1,
      currentOrganizationId: organizationId,
      csrfToken,
    },
  };
}

function organizationsData() {
  return {
    organizations: [
      {
        id: organizationId,
        name: 'OrgaWork Browser WM-01',
        membershipId,
        membershipStatus: 'active',
      },
    ],
  };
}

async function handle(request, response) {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);

  if (url.pathname === '/health') {
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    });
    response.end('ok');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/auth/session') {
    request.resume();
    success(response, 200, sessionData());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/organizations') {
    request.resume();
    success(response, 200, organizationsData());
    return;
  }

  if (request.method === 'POST' && url.pathname === `/v1/organizations/${organizationId}/cases`) {
    const body = await readJson(request);

    if (request.headers['x-csrf-token'] !== csrfToken) {
      failure(response, 403, 'AUTH_CSRF_INVALID', 'CSRF rejected by WM-01 browser stub.');
      return;
    }

    const idempotencyKey = request.headers['x-idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      failure(
        response,
        400,
        'VALIDATION_ERROR',
        'Idempotency key missing from WM-01 browser request.',
      );
      return;
    }

    if (
      typeof body.title !== 'string' ||
      typeof body.description !== 'string' ||
      typeof body.initialActionTitle !== 'string' ||
      !['low', 'normal', 'high'].includes(body.priority)
    ) {
      failure(response, 400, 'VALIDATION_ERROR', 'Create Own Case payload is invalid.');
      return;
    }

    success(response, 201, {
      caseId: '55555555-5555-4555-8555-555555555555',
      title: body.title,
      status: 'open',
      priority: body.priority,
      dueAt: null,
      responsibilityId: '66666666-6666-4666-8666-666666666666',
      initialAction: {
        id: '77777777-7777-4777-8777-777777777777',
        title: body.initialActionTitle,
        status: 'pending',
        dueAt: null,
      },
      replayed: false,
    });
    return;
  }

  request.resume();
  failure(response, 404, 'NOT_FOUND', 'Route is outside the WM-01 browser stub contract.');
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) {
      failure(response, 500, 'SERVICE_UNAVAILABLE', 'WM-01 browser stub failed.');
    } else {
      response.end();
    }
  });
});

server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(port, host, () => {
  console.log(`WM01_API_STUB_READY http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
