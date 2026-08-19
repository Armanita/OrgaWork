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
  WorkManagementError,
  type CreateOwnCaseResult,
  type WorkManagementService,
} from '@workspace/work-management';
import { timingSafeTextEqual } from '@workspace/security';

const csrfHeaderName = 'x-csrf-token';
const idempotencyHeaderName = 'x-idempotency-key';

export interface WorkManagementRouteOptions {
  readonly authentication: Pick<AuthenticationService, 'getSession'>;
  readonly workManagement: Pick<WorkManagementService, 'createOwnCase'>;
  readonly production?: boolean;
  readonly now?: () => Date;
}

function cookieName(production: boolean): string {
  return production ? '__Host-orgawork-session' : 'orgawork-session';
}

function header(value: string | readonly string[] | undefined): string {
  return typeof value === 'string' ? value : (value?.[0] ?? '');
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
  if (code === 'CONFLICT') return 409;
  return 503;
}

function sendError(
  reply: FastifyReply,
  code: ApiErrorCode,
  message: string,
  now: Date,
  field?: string,
): FastifyReply {
  reply.header('cache-control', 'no-store');
  return reply
    .code(status(code))
    .send(
      field === undefined
        ? createApiError(code, message, meta(reply, now))
        : createApiError(code, message, meta(reply, now), field),
    );
}

async function actor(
  options: WorkManagementRouteOptions,
  request: FastifyRequest,
): Promise<AuthenticationSessionView> {
  const secret = request.cookies[cookieName(options.production ?? false)] ?? '';
  if (secret === '') {
    throw new AuthenticationError('AUTH_SESSION_REQUIRED', 'نشست معتبر لازم است.');
  }

  const session = await options.authentication.getSession(secret);
  if (!timingSafeTextEqual(header(request.headers[csrfHeaderName]), session.csrfToken)) {
    throw new AuthenticationError('AUTH_CSRF_INVALID', 'درخواست امنیتی معتبر نیست.');
  }

  return session;
}

function mapError(error: unknown): { readonly code: ApiErrorCode; readonly message: string } {
  if (error instanceof AuthenticationError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof WorkManagementError) {
    return {
      code:
        error.code === 'AUTHORIZATION_DENIED'
          ? 'AUTHORIZATION_DENIED'
          : error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'IDEMPOTENCY_IN_PROGRESS'
            ? 'CONFLICT'
            : 'SERVICE_UNAVAILABLE',
      message: error.message,
    };
  }

  return { code: 'SERVICE_UNAVAILABLE', message: 'خدمت مدیریت کار در دسترس نیست.' };
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function priority(value: unknown): 'low' | 'normal' | 'high' | undefined {
  if (value === undefined) return 'normal';
  return value === 'low' || value === 'normal' || value === 'high' ? value : undefined;
}

export function createWorkManagementRoutes(
  options: WorkManagementRouteOptions,
): (application: FastifyInstance) => void {
  const now = options.now ?? (() => new Date());

  return (application): void => {
    application.post<{
      Params: { organizationId: string };
      Body: {
        title?: unknown;
        description?: unknown;
        priority?: unknown;
        dueAt?: unknown;
        initialActionTitle?: unknown;
        initialActionDueAt?: unknown;
      };
    }>('/v1/organizations/:organizationId/cases', async (request, reply) => {
      const title = text(request.body?.title);
      const description = text(request.body?.description);
      const initialActionTitle = text(request.body?.initialActionTitle);
      const casePriority = priority(request.body?.priority);
      const idempotencyKey = header(request.headers[idempotencyHeaderName]).trim();

      if (title === undefined) {
        return sendError(reply, 'VALIDATION_ERROR', 'عنوان پرونده لازم است.', now(), 'title');
      }
      if (description === undefined) {
        return sendError(reply, 'VALIDATION_ERROR', 'شرح پرونده لازم است.', now(), 'description');
      }
      if (initialActionTitle === undefined) {
        return sendError(
          reply,
          'VALIDATION_ERROR',
          'عنوان اقدام اولیه لازم است.',
          now(),
          'initialActionTitle',
        );
      }
      if (casePriority === undefined) {
        return sendError(reply, 'VALIDATION_ERROR', 'اولویت پرونده معتبر نیست.', now(), 'priority');
      }
      if (idempotencyKey === '') {
        return sendError(reply, 'VALIDATION_ERROR', 'کلید عدم تکرار لازم است.', now());
      }

      try {
        const session = await actor(options, request);
        if (session.currentOrganizationId !== request.params.organizationId) {
          return sendError(
            reply,
            'AUTHORIZATION_DENIED',
            'سازمان درخواست با سازمان جاری نشست یکسان نیست.',
            now(),
          );
        }

        const result: CreateOwnCaseResult = await options.workManagement.createOwnCase({
          userId: session.userId,
          organizationId: request.params.organizationId,
          idempotencyKey,
          title,
          description,
          priority: casePriority,
          ...(typeof request.body?.dueAt === 'string' && request.body.dueAt.trim() !== ''
            ? { dueAt: request.body.dueAt }
            : {}),
          initialAction: {
            title: initialActionTitle,
            ...(typeof request.body?.initialActionDueAt === 'string' &&
            request.body.initialActionDueAt.trim() !== ''
              ? { dueAt: request.body.initialActionDueAt }
              : {}),
          },
        });

        reply.header('cache-control', 'no-store');
        return reply
          .code(result.replayed ? 200 : 201)
          .send(createApiSuccess(result, meta(reply, now())));
      } catch (error) {
        const mapped = mapError(error);
        return sendError(reply, mapped.code, mapped.message, now());
      }
    });
  };
}
