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
import { type PostgreSqlAccess } from '@workspace/database';
import { timingSafeTextEqual } from '@workspace/security';
import {
  createFollowUpCase,
  saveFollowUpCaseWithAssignment,
  findFollowUpCaseById,
  CaseDomainError,
} from '@workspace/cases';
import { createCaseAssignment } from '@workspace/assignments';

export interface CasesRouteOptions {
  database: PostgreSqlAccess;
  authentication: AuthenticationService;
  production?: boolean;
  now?: () => Date;
}

const csrfHeader = 'x-csrf-token';

function cookieName(production: boolean) {
  return production ? '__Host-orgawork-session' : 'orgawork-session';
}

function rh(reply: FastifyReply, name: string) {
  const v = reply.getHeader(name);
  return Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
}

function meta(reply: FastifyReply, now: Date) {
  return {
    requestId: createRequestId(rh(reply, 'x-request-id')),
    correlationId: createCorrelationId(rh(reply, 'x-correlation-id')),
    timestamp: createUtcTimestamp(now),
  };
}

function fail(
  reply: FastifyReply,
  code: ApiErrorCode,
  message: string,
  now: Date,
  statusCode = 400,
) {
  return reply.code(statusCode).send(createApiError(code, message, meta(reply, now)));
}

function token(request: FastifyRequest) {
  const v = request.headers[csrfHeader];
  return typeof v === 'string' ? v : '';
}

async function actor(
  options: CasesRouteOptions,
  request: FastifyRequest,
): Promise<AuthenticationSessionView> {
  const secret = request.cookies[cookieName(options.production ?? false)] ?? '';
  if (secret === '') throw new AuthenticationError('AUTH_SESSION_REQUIRED', 'نشست معتبر لازم است.');
  const session = await options.authentication.getSession(secret);
  if (!timingSafeTextEqual(token(request), session.csrfToken))
    throw new AuthenticationError('AUTH_CSRF_INVALID', 'درخواست امنیتی معتبر نیست.');
  return session;
}

export function createCasesRoutes(options?: CasesRouteOptions) {
  return async function casesPlugin(app: FastifyInstance): Promise<void> {
    if (options === undefined) {
      return;
    }

    const getNow = options.now ?? (() => new Date());

    app.post('/api/v1/cases', async (request: FastifyRequest, reply: FastifyReply) => {
      const now = getNow();
      try {
        const session = await actor(options, request);
        const orgId = session.currentOrganizationId;
        if (!orgId) {
          return fail(
            reply,
            'ORGANIZATION_CONTEXT_REQUIRED' as ApiErrorCode,
            'انتخاب سازمان جاری الزامی است.',
            now,
            400,
          );
        }

        const body = (request.body ?? {}) as {
          title?: string;
          initialWork?: { kind: 'action'; id: string };
        };

        if (typeof body.title !== 'string' || body.title.trim() === '') {
          return fail(
            reply,
            'INVALID_CASE_TITLE' as ApiErrorCode,
            'عنوان پرونده نباید خالی باشد.',
            now,
            400,
          );
        }

        if (!body.initialWork || typeof body.initialWork.id !== 'string') {
          return fail(
            reply,
            'CASE_CURRENT_WORK_REQUIRED' as ApiErrorCode,
            'تعیین کار جاری اولیه الزامی است.',
            now,
            400,
          );
        }

        const caseId = crypto.randomUUID();
        const assignmentId = crypto.randomUUID();

        const caseEntity = createFollowUpCase({
          id: caseId,
          organizationId: orgId,
          title: body.title,
          createdByUserId: session.userId,
          subjectUserId: session.userId,
          primaryAssignmentId: assignmentId,
          currentWork: body.initialWork,
          now,
        });

        const assignmentEntity = createCaseAssignment({
          id: assignmentId,
          caseId,
          organizationId: orgId,
          assigneeUserId: session.userId,
          assignedByUserId: session.userId,
          acceptanceMode: 'forced',
          isPrimary: true,
          now,
        });

        const saved = await saveFollowUpCaseWithAssignment(options.database, {
          case: caseEntity,
          assignment: assignmentEntity,
        });

        return reply.code(201).send(createApiSuccess(saved.case, meta(reply, now)));
      } catch (err) {
        if (err instanceof AuthenticationError) {
          return fail(reply, 'AUTHENTICATION_REQUIRED' as ApiErrorCode, err.message, now, 401);
        }
        if (err instanceof CaseDomainError) {
          return fail(reply, err.code as ApiErrorCode, err.message, now, 400);
        }
        return fail(
          reply,
          'INTERNAL_SERVER_ERROR' as ApiErrorCode,
          'خطای غیرمنتظره سرور رخ داد.',
          now,
          500,
        );
      }
    });

    app.get('/api/v1/cases/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const now = getNow();
      try {
        const session = await actor(options, request);
        const orgId = session.currentOrganizationId;
        if (!orgId) {
          return fail(
            reply,
            'ORGANIZATION_CONTEXT_REQUIRED' as ApiErrorCode,
            'انتخاب سازمان جاری الزامی است.',
            now,
            400,
          );
        }

        const params = request.params as { id: string };
        const foundCase = await findFollowUpCaseById(options.database, orgId, params.id);

        if (!foundCase) {
          return fail(
            reply,
            'RESOURCE_NOT_FOUND' as ApiErrorCode,
            'پرونده مورد نظر یافت نشد.',
            now,
            404,
          );
        }

        return reply.code(200).send(createApiSuccess(foundCase, meta(reply, now)));
      } catch (err) {
        if (err instanceof AuthenticationError) {
          return fail(reply, 'AUTHENTICATION_REQUIRED' as ApiErrorCode, err.message, now, 401);
        }
        return fail(
          reply,
          'INTERNAL_SERVER_ERROR' as ApiErrorCode,
          'خطای غیرمنتظره سرور رخ داد.',
          now,
          500,
        );
      }
    });
  };
}
