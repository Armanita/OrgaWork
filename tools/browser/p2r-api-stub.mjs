/* global URL, console, process */
import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = 3317;
const organizationId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const csrfToken = 'browser-audit-csrf-token';

function envelope(data) {
  return JSON.stringify({ ok: true, data });
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-request-id': 'p2r-browser-stub',
    'x-correlation-id': 'p2r-browser-stub',
  });
  response.end(envelope(data));
}

function dataFor(pathname) {
  const path = decodeURIComponent(pathname.replace(/^\/v1\//u, ''));

  if (path === 'auth/session') {
    return {
      session: {
        id: '33333333-3333-4333-8333-333333333333',
        userId: '44444444-4444-4444-8444-444444444444',
        email: 'owner@orgawork.test',
        sessionRevision: 1,
        currentOrganizationId: organizationId,
        csrfToken,
      },
    };
  }

  if (path === 'organizations') {
    return {
      organizations: [
        {
          id: organizationId,
          name: 'OrgaWork Browser Audit',
          membershipId,
          membershipStatus: 'active',
        },
      ],
    };
  }

  if (path.endsWith('/memberships')) {
    return {
      memberships: [
        {
          id: membershipId,
          email: 'owner@orgawork.test',
          status: 'active',
          roleKeys: ['organization_admin'],
        },
        {
          id: '55555555-5555-4555-8555-555555555555',
          email: 'manager@orgawork.test',
          status: 'invited',
          roleKeys: ['manager'],
        },
      ],
    };
  }

  if (path.endsWith('/teams')) {
    return {
      teams: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Operations',
          memberCount: 2,
        },
        {
          id: '77777777-7777-4777-8777-777777777777',
          name: 'Quality',
          memberCount: 1,
        },
      ],
    };
  }

  return { accepted: true };
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);

  if (url.pathname === '/health') {
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    });
    response.end('ok');
    return;
  }

  if (!url.pathname.startsWith('/v1/')) {
    response.writeHead(404, {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(
      JSON.stringify({
        ok: false,
        error: { message: 'Route is outside the browser stub contract.' },
      }),
    );
    return;
  }

  request.resume();
  sendJson(response, 200, dataFor(url.pathname));
});

server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(port, host, () => {
  console.log(`P2R_API_STUB_READY http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
