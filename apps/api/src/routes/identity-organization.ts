import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  createApiError,
  createApiSuccess,
  createCorrelationId,
  createMembershipId,
  createOrganizationId,
  createRequestId,
  createSessionId,
  createUserId,
  createUtcTimestamp,
  type ApiErrorCode,
  type AuthenticationSessionData,
  type OrganizationSummaryData,
} from '@workspace/contracts';
import {
  AuthenticationError,
  type AuthenticationService,
  type AuthenticationSessionView,
} from '@workspace/authentication';
import {
  OrganizationContextError,
  type OrganizationContextService,
} from '@workspace/organization-context';

const productionCookieName = '__Host-orgawork-session';
const developmentCookieName = 'orgawork-session';
const csrfHeaderName = 'x-csrf-token';

export interface IdentityOrganizationRouteOptions {
  readonly authentication?: AuthenticationService;
  readonly organizationContext?: OrganizationContextService;
  readonly production?: boolean;
  readonly now?: () => Date;
}

function missingAuthentication(): AuthenticationService {
  const reject = (): Promise<never> => Promise.reject(new Error('authentication unavailable'));
  return {
    setPasswordCredential: reject,
    login: reject,
    getSession: reject,
    logout: reject,
    logoutAll: reject,
    requestPasswordReset: reject,
    confirmPasswordReset: reject,
  };
}
function missingOrganizationContext(): OrganizationContextService {
  const reject = (): Promise<never> =>
    Promise.reject(new Error('organization context unavailable'));
  return { listOrganizations: reject, switchOrganization: reject };
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
function cookieName(production: boolean): string {
  return production ? productionCookieName : developmentCookieName;
}
function secret(request: FastifyRequest, production: boolean): string {
  return request.cookies[cookieName(production)] ?? '';
}
function csrf(request: FastifyRequest): string {
  return header(request.headers[csrfHeaderName]);
}
function setCookie(reply: FastifyReply, production: boolean, value: string, expires: string): void {
  reply.setCookie(cookieName(production), value, {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expires),
  });
}
function clearCookie(reply: FastifyReply, production: boolean): void {
  reply.clearCookie(cookieName(production), {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/',
  });
}
function status(code: ApiErrorCode): number {
  if (code === 'VALIDATION_ERROR' || code === 'AUTH_PASSWORD_POLICY_FAILED') return 400;
  if (code === 'RATE_LIMITED') return 429;
  if (
    code === 'AUTH_INVALID_CREDENTIALS' ||
    code === 'AUTH_SESSION_REQUIRED' ||
    code === 'AUTH_SESSION_EXPIRED' ||
    code === 'AUTH_SESSION_REVOKED'
  )
    return 401;
  if (
    code === 'AUTH_ACCOUNT_DISABLED' ||
    code === 'AUTH_CSRF_INVALID' ||
    code === 'ORGANIZATION_SWITCH_FORBIDDEN'
  )
    return 403;
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
  const body =
    field === undefined
      ? createApiError(code, message, meta(reply, now))
      : createApiError(code, message, meta(reply, now), field);
  return reply.code(status(code)).send(body);
}
function mapError(error: unknown): { code: ApiErrorCode; message: string } {
  if (error instanceof AuthenticationError)
    return { code: error.code as ApiErrorCode, message: error.message };
  if (error instanceof OrganizationContextError)
    return { code: error.code as ApiErrorCode, message: error.message };
  return { code: 'SERVICE_UNAVAILABLE', message: 'خدمت هویت و سازمان در دسترس نیست.' };
}
function sessionData(value: AuthenticationSessionView): AuthenticationSessionData {
  return {
    id: createSessionId(value.id),
    userId: createUserId(value.userId),
    email: value.email,
    status: 'active',
    sessionRevision: value.sessionRevision,
    currentOrganizationId:
      value.currentOrganizationId === null
        ? null
        : createOrganizationId(value.currentOrganizationId),
    csrfToken: value.csrfToken,
    idleExpiresAt: createUtcTimestamp(value.idleExpiresAt),
    absoluteExpiresAt: createUtcTimestamp(value.absoluteExpiresAt),
  };
}
async function requireSession(
  authentication: AuthenticationService,
  request: FastifyRequest,
  production: boolean,
): Promise<{ secret: string; session: AuthenticationSessionView }> {
  const value = secret(request, production);
  if (value === '') throw new AuthenticationError('AUTH_SESSION_REQUIRED', 'نشست معتبر لازم است.');
  return { secret: value, session: await authentication.getSession(value) };
}

export function createIdentityOrganizationRoutes(
  options: IdentityOrganizationRouteOptions = {},
): (application: FastifyInstance) => void {
  const authentication = options.authentication ?? missingAuthentication();
  const organizationContext = options.organizationContext ?? missingOrganizationContext();
  const production = options.production ?? false;
  const now = options.now ?? (() => new Date());
  return (application): void => {
    application.post<{ Body: { email?: unknown; password?: unknown } }>(
      '/v1/auth/login',
      async (request, reply) => {
        if (typeof request.body?.email !== 'string' || request.body.email.trim() === '')
          return sendError(reply, 'VALIDATION_ERROR', 'ایمیل واردشده معتبر نیست.', now(), 'email');
        if (typeof request.body?.password !== 'string' || request.body.password === '')
          return sendError(
            reply,
            'VALIDATION_ERROR',
            'گذرواژه واردشده معتبر نیست.',
            now(),
            'password',
          );
        try {
          const result = await authentication.login({
            email: request.body.email,
            password: request.body.password,
            clientAddress: request.ip,
          });
          setCookie(reply, production, result.sessionSecret, result.session.absoluteExpiresAt);
          reply.header('cache-control', 'no-store');
          return reply.send(
            createApiSuccess({ session: sessionData(result.session) }, meta(reply, now())),
          );
        } catch (error) {
          const mapped = mapError(error);
          return sendError(reply, mapped.code, mapped.message, now());
        }
      },
    );
    application.get('/v1/auth/session', async (request, reply) => {
      try {
        const context = await requireSession(authentication, request, production);
        reply.header('cache-control', 'no-store');
        return reply.send(
          createApiSuccess({ session: sessionData(context.session) }, meta(reply, now())),
        );
      } catch (error) {
        const mapped = mapError(error);
        clearCookie(reply, production);
        return sendError(reply, mapped.code, mapped.message, now());
      }
    });
    application.post('/v1/auth/logout', async (request, reply) => {
      const value = secret(request, production);
      if (value === '') {
        clearCookie(reply, production);
        return reply.send(createApiSuccess({ loggedOut: true as const }, meta(reply, now())));
      }
      try {
        await authentication.logout(value, csrf(request));
        clearCookie(reply, production);
        return reply.send(createApiSuccess({ loggedOut: true as const }, meta(reply, now())));
      } catch (error) {
        const mapped = mapError(error);
        return sendError(reply, mapped.code, mapped.message, now());
      }
    });
    application.post('/v1/auth/logout-all', async (request, reply) => {
      try {
        const context = await requireSession(authentication, request, production);
        const count = await authentication.logoutAll(context.secret, csrf(request));
        clearCookie(reply, production);
        return reply.send(createApiSuccess({ revokedSessions: count }, meta(reply, now())));
      } catch (error) {
        const mapped = mapError(error);
        return sendError(reply, mapped.code, mapped.message, now());
      }
    });
    application.post<{ Body: { email?: unknown } }>(
      '/v1/auth/password-reset/request',
      async (request, reply) => {
        if (typeof request.body?.email !== 'string')
          return sendError(reply, 'VALIDATION_ERROR', 'ایمیل واردشده معتبر نیست.', now(), 'email');
        try {
          const result = await authentication.requestPasswordReset(request.body.email);
          return reply.send(
            createApiSuccess(
              { accepted: true as const, developmentToken: production ? undefined : result.token },
              meta(reply, now()),
            ),
          );
        } catch (error) {
          const mapped = mapError(error);
          return sendError(reply, mapped.code, mapped.message, now());
        }
      },
    );
    application.post<{ Body: { token?: unknown; password?: unknown } }>(
      '/v1/auth/password-reset/confirm',
      async (request, reply) => {
        if (typeof request.body?.token !== 'string' || typeof request.body?.password !== 'string')
          return sendError(reply, 'VALIDATION_ERROR', 'اطلاعات بازیابی معتبر نیست.', now());
        try {
          await authentication.confirmPasswordReset(request.body.token, request.body.password);
          return reply.send(createApiSuccess({ changed: true as const }, meta(reply, now())));
        } catch (error) {
          const mapped = mapError(error);
          return sendError(reply, mapped.code, mapped.message, now());
        }
      },
    );
    application.get('/v1/organizations', async (request, reply) => {
      try {
        const context = await requireSession(authentication, request, production);
        const rows = await organizationContext.listOrganizations(context.session.userId);
        const organizations: OrganizationSummaryData[] = rows.map((row) => ({
          id: createOrganizationId(row.id),
          name: row.name,
          membershipId: createMembershipId(row.membershipId),
          membershipStatus: 'active',
        }));
        return reply.send(createApiSuccess({ organizations }, meta(reply, now())));
      } catch (error) {
        const mapped = mapError(error);
        return sendError(reply, mapped.code, mapped.message, now());
      }
    });
    application.post<{ Body: { organizationId?: unknown } }>(
      '/v1/auth/current-organization',
      async (request, reply) => {
        if (typeof request.body?.organizationId !== 'string')
          return sendError(
            reply,
            'VALIDATION_ERROR',
            'سازمان انتخاب‌شده معتبر نیست.',
            now(),
            'organizationId',
          );
        try {
          const context = await requireSession(authentication, request, production);
          if (csrf(request) !== context.session.csrfToken)
            throw new AuthenticationError('AUTH_CSRF_INVALID', 'درخواست امنیتی معتبر نیست.');
          const switched = await organizationContext.switchOrganization({
            sessionId: context.session.id,
            userId: context.session.userId,
            organizationId: request.body.organizationId,
          });
          return reply.send(createApiSuccess(switched, meta(reply, now())));
        } catch (error) {
          const mapped = mapError(error);
          return sendError(reply, mapped.code, mapped.message, now());
        }
      },
    );
  };
}
