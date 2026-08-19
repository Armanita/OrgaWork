import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  createApiError,
  createApiSuccess,
  createCorrelationId,
  createRequestId,
  createUtcTimestamp,
  type ApiErrorCode,
} from '@workspace/contracts';
import {
  AuthenticationError,
  type AuthenticationService,
  type AuthenticationSessionView,
} from '@workspace/authentication';
import {
  PlatformControlPlaneError,
  type PlatformControlPlaneService,
} from '@workspace/organization-administration';
import { timingSafeTextEqual } from '@workspace/security';

const csrfHeaderName = 'x-csrf-token';
const idempotencyHeaderName = 'idempotency-key';

export interface PlatformControlPlaneRouteOptions {
  readonly authentication: AuthenticationService;
  readonly platformControlPlane: PlatformControlPlaneService;
  readonly production?: boolean;
  readonly now?: () => Date;
}

function cookieName(production: boolean): string {
  return production ? '__Host-orgawork-session' : 'orgawork-session';
}

function replyHeader(reply: FastifyReply, name: string): string {
  const value = reply.getHeader(name);
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

function meta(reply: FastifyReply, now: Date) {
  return {
    requestId: createRequestId(replyHeader(reply, 'x-request-id')),
    correlationId: createCorrelationId(replyHeader(reply, 'x-correlation-id')),
    timestamp: createUtcTimestamp(now),
  };
}

function requestHeader(request: FastifyRequest, name: string): string {
  const value = request.headers[name];
  return typeof value === 'string' ? value : (value?.[0] ?? '');
}

function status(code: ApiErrorCode): number {
  if (code === 'VALIDATION_ERROR') return 400;
  if (
    code === 'AUTH_SESSION_REQUIRED' ||
    code === 'AUTH_SESSION_EXPIRED' ||
    code === 'AUTH_SESSION_REVOKED'
  ) {
    return 401;
  }
  if (code === 'AUTH_CSRF_INVALID' || code === 'AUTHORIZATION_DENIED') return 403;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'CONFLICT') return 409;
  return 503;
}

function sendError(
  reply: FastifyReply,
  code: ApiErrorCode,
  message: string,
  now: Date,
): FastifyReply {
  reply.header('cache-control', 'no-store');
  return reply.code(status(code)).send(createApiError(code, message, meta(reply, now)));
}

function mapError(error: unknown): { readonly code: ApiErrorCode; readonly message: string } {
  if (error instanceof AuthenticationError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof PlatformControlPlaneError) {
    if (error.code === 'PLATFORM_AUTHORITY_REQUIRED') {
      return { code: 'AUTHORIZATION_DENIED', message: error.message };
    }
    if (
      error.code === 'PLATFORM_ORGANIZATION_NOT_FOUND' ||
      error.code === 'PLATFORM_ADMIN_NOT_FOUND'
    ) {
      return { code: 'NOT_FOUND', message: error.message };
    }
    return { code: 'CONFLICT', message: error.message };
  }
  if (error instanceof TypeError) {
    return { code: 'VALIDATION_ERROR', message: error.message };
  }
  return { code: 'SERVICE_UNAVAILABLE', message: 'کنترل‌پلین سکو در دسترس نیست.' };
}

async function session(
  options: PlatformControlPlaneRouteOptions,
  request: FastifyRequest,
  requireCsrf: boolean,
): Promise<AuthenticationSessionView> {
  const secret = request.cookies[cookieName(options.production ?? false)] ?? '';
  if (secret === '') {
    throw new AuthenticationError('AUTH_SESSION_REQUIRED', 'نشست معتبر لازم است.');
  }
  const current = await options.authentication.getSession(secret);
  if (
    requireCsrf &&
    !timingSafeTextEqual(requestHeader(request, csrfHeaderName), current.csrfToken)
  ) {
    throw new AuthenticationError('AUTH_CSRF_INVALID', 'درخواست امنیتی معتبر نیست.');
  }
  return current;
}

export function createPlatformControlPlaneRoutes(
  options: PlatformControlPlaneRouteOptions,
): (application: FastifyInstance) => void {
  const now = options.now ?? (() => new Date());

  return (application) => {
    application.get('/v1/platform/session', async (request, reply) => {
      try {
        const current = await session(options, request, false);
        const platformOperator = await options.platformControlPlane.getOperator(current.userId);
        return reply.send(createApiSuccess({ platformOperator }, meta(reply, now())));
      } catch (error: unknown) {
        const mapped = mapError(error);
        return sendError(reply, mapped.code, mapped.message, now());
      }
    });

    application.get('/v1/platform/organizations', async (request, reply) => {
      try {
        const current = await session(options, request, false);
        const organizations = await options.platformControlPlane.listOrganizations(current.userId);
        return reply.send(createApiSuccess({ organizations }, meta(reply, now())));
      } catch (error: unknown) {
        const mapped = mapError(error);
        return sendError(reply, mapped.code, mapped.message, now());
      }
    });

    application.get<{ Querystring: { limit?: string } }>(
      '/v1/platform/audit',
      async (request, reply) => {
        try {
          const current = await session(options, request, false);
          const rawLimit = request.query.limit;
          const limit = rawLimit === undefined || rawLimit.trim() === '' ? 50 : Number(rawLimit);
          const audit = await options.platformControlPlane.listAudit(current.userId, limit);
          return reply.send(createApiSuccess({ audit }, meta(reply, now())));
        } catch (error: unknown) {
          const mapped = mapError(error);
          return sendError(reply, mapped.code, mapped.message, now());
        }
      },
    );

    application.post<{ Body: { name?: unknown; reason?: unknown } }>(
      '/v1/platform/organizations',
      async (request, reply) => {
        try {
          const current = await session(options, request, true);
          if (typeof request.body?.name !== 'string' || typeof request.body?.reason !== 'string') {
            return sendError(reply, 'VALIDATION_ERROR', 'اطلاعات ایجاد سازمان معتبر نیست.', now());
          }
          const responseMeta = meta(reply, now());
          const result = await options.platformControlPlane.createOrganization({
            actorUserId: current.userId,
            name: request.body.name,
            reason: request.body.reason,
            idempotencyKey: requestHeader(request, idempotencyHeaderName),
            requestId: responseMeta.requestId,
            correlationId: responseMeta.correlationId,
          });
          return reply.send(createApiSuccess(result, responseMeta));
        } catch (error: unknown) {
          const mapped = mapError(error);
          return sendError(reply, mapped.code, mapped.message, now());
        }
      },
    );

    application.patch<{
      Params: { organizationId: string };
      Body: { name?: unknown; reason?: unknown };
    }>('/v1/platform/organizations/:organizationId', async (request, reply) => {
      try {
        const current = await session(options, request, true);
        if (typeof request.body?.name !== 'string' || typeof request.body?.reason !== 'string') {
          return sendError(reply, 'VALIDATION_ERROR', 'اطلاعات ویرایش سازمان معتبر نیست.', now());
        }
        const responseMeta = meta(reply, now());
        const result = await options.platformControlPlane.renameOrganization({
          actorUserId: current.userId,
          organizationId: request.params.organizationId,
          name: request.body.name,
          reason: request.body.reason,
          idempotencyKey: requestHeader(request, idempotencyHeaderName),
          requestId: responseMeta.requestId,
          correlationId: responseMeta.correlationId,
        });
        return reply.send(createApiSuccess(result, responseMeta));
      } catch (error: unknown) {
        const mapped = mapError(error);
        return sendError(reply, mapped.code, mapped.message, now());
      }
    });

    async function provisionAdmin(
      request: FastifyRequest<{
        Params: { organizationId: string };
        Body: { email?: unknown; reason?: unknown };
      }>,
      reply: FastifyReply,
    ): Promise<FastifyReply> {
      try {
        const current = await session(options, request, true);
        if (typeof request.body?.email !== 'string' || typeof request.body?.reason !== 'string') {
          return sendError(reply, 'VALIDATION_ERROR', 'اطلاعات مدیر سازمان معتبر نیست.', now());
        }
        const responseMeta = meta(reply, now());
        const result = await options.platformControlPlane.provisionInitialAdmin({
          actorUserId: current.userId,
          organizationId: request.params.organizationId,
          email: request.body.email,
          reason: request.body.reason,
          idempotencyKey: requestHeader(request, idempotencyHeaderName),
          requestId: responseMeta.requestId,
          correlationId: responseMeta.correlationId,
        });
        return reply.send(createApiSuccess(result, responseMeta));
      } catch (error: unknown) {
        const mapped = mapError(error);
        return sendError(reply, mapped.code, mapped.message, now());
      }
    }

    application.post<{
      Params: { organizationId: string };
      Body: { email?: unknown; reason?: unknown };
    }>('/v1/platform/organizations/:organizationId/initial-admin', provisionAdmin);

    application.post<{
      Params: { organizationId: string };
      Body: { email?: unknown; reason?: unknown };
    }>('/v1/platform/organizations/:organizationId/admins', provisionAdmin);

    application.delete<{
      Params: { organizationId: string; membershipId: string };
      Body: { reason?: unknown };
    }>(
      '/v1/platform/organizations/:organizationId/admins/:membershipId',
      async (request, reply) => {
        try {
          const current = await session(options, request, true);
          if (typeof request.body?.reason !== 'string') {
            return sendError(reply, 'VALIDATION_ERROR', 'دلیل لغو دسترسی مدیر معتبر نیست.', now());
          }
          const responseMeta = meta(reply, now());
          const result = await options.platformControlPlane.revokeOrganizationAdmin({
            actorUserId: current.userId,
            organizationId: request.params.organizationId,
            membershipId: request.params.membershipId,
            reason: request.body.reason,
            idempotencyKey: requestHeader(request, idempotencyHeaderName),
            requestId: responseMeta.requestId,
            correlationId: responseMeta.correlationId,
          });
          return reply.send(createApiSuccess(result, responseMeta));
        } catch (error: unknown) {
          const mapped = mapError(error);
          return sendError(reply, mapped.code, mapped.message, now());
        }
      },
    );
  };
}
