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
import { type PermissionKey } from '@workspace/authorization';
import { OrganizationAdministrationError } from '@workspace/organization-administration';
import { timingSafeTextEqual } from '@workspace/security';

interface AuthorizationService {
  authorize(input: {
    userId: string;
    organizationId: string;
    permission: PermissionKey;
    resourceType?: string;
    resourceId?: string;
  }): Promise<{ allowed: boolean; reasonCode: string }>;
}
interface AdministrationService {
  listMemberships(organizationId: string): Promise<readonly unknown[]>;
  listTeams(organizationId: string): Promise<readonly unknown[]>;
  createInvitation(input: {
    organizationId: string;
    email: string;
    roleKey?: string;
  }): Promise<unknown>;
  acceptInvitation(token: string, userId: string): Promise<unknown>;
  revokeInvitation(organizationId: string, invitationId: string): Promise<boolean>;
  updateMembership(
    organizationId: string,
    membershipId: string,
    status: 'invited' | 'active' | 'suspended' | 'revoked',
  ): Promise<boolean>;
  replaceMembershipRoles(
    organizationId: string,
    membershipId: string,
    roleKeys: readonly ('member' | 'manager' | 'organization_admin')[],
  ): Promise<boolean>;
  createTeam(organizationId: string, name: string): Promise<unknown>;
  renameTeam(teamId: string, organizationId: string, name: string): Promise<boolean>;
  addTeamMember(
    teamId: string,
    organizationId: string,
    membershipId: string,
    role?: 'member' | 'team_manager',
  ): Promise<boolean>;
  removeTeamMember(teamId: string, organizationId: string, membershipId: string): Promise<boolean>;
}
export interface OrganizationAdministrationRouteOptions {
  authentication: AuthenticationService;
  authorization: AuthorizationService;
  administration: AdministrationService;
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
function fail(reply: FastifyReply, code: ApiErrorCode, message: string, now: Date) {
  return reply
    .code(code === 'AUTHORIZATION_DENIED' ? 403 : 400)
    .send(createApiError(code, message, meta(reply, now)));
}
function token(request: FastifyRequest) {
  const v = request.headers[csrfHeader];
  return typeof v === 'string' ? v : '';
}
async function actor(
  options: OrganizationAdministrationRouteOptions,
  request: FastifyRequest,
): Promise<AuthenticationSessionView> {
  const secret = request.cookies[cookieName(options.production ?? false)] ?? '';
  if (secret === '') throw new AuthenticationError('AUTH_SESSION_REQUIRED', 'نشست معتبر لازم است.');
  const session = await options.authentication.getSession(secret);
  if (!timingSafeTextEqual(token(request), session.csrfToken))
    throw new AuthenticationError('AUTH_CSRF_INVALID', 'درخواست امنیتی معتبر نیست.');
  return session;
}
async function permit(
  options: OrganizationAdministrationRouteOptions,
  session: AuthenticationSessionView,
  organizationId: string,
  permission: PermissionKey,
): Promise<void> {
  const d = await options.authorization.authorize({
    userId: session.userId,
    organizationId,
    permission,
  });
  if (!d.allowed)
    throw new OrganizationAdministrationError(
      'MEMBERSHIP_STATE_CONFLICT',
      'دسترسی لازم وجود ندارد.',
    );
}
export function createOrganizationAdministrationRoutes(
  options: OrganizationAdministrationRouteOptions,
): (application: FastifyInstance) => void {
  const now = options.now ?? (() => new Date());
  return (application) => {
    application.get<{ Params: { organizationId: string } }>(
      '/v1/organizations/:organizationId/memberships',
      async (req, reply) => {
        try {
          const s = await actor(options, req);
          await permit(options, s, req.params.organizationId, 'organization.manage_members');
          return reply.send(
            createApiSuccess(
              {
                memberships: await options.administration.listMemberships(
                  req.params.organizationId,
                ),
              },
              meta(reply, now()),
            ),
          );
        } catch (e) {
          return fail(
            reply,
            'AUTHORIZATION_DENIED',
            e instanceof Error ? e.message : 'دسترسی مجاز نیست.',
            now(),
          );
        }
      },
    );
    application.get<{ Params: { organizationId: string } }>(
      '/v1/organizations/:organizationId/teams',
      async (req, reply) => {
        try {
          const s = await actor(options, req);
          await permit(options, s, req.params.organizationId, 'organization.manage_teams');
          return reply.send(
            createApiSuccess(
              { teams: await options.administration.listTeams(req.params.organizationId) },
              meta(reply, now()),
            ),
          );
        } catch (e) {
          return fail(
            reply,
            'AUTHORIZATION_DENIED',
            e instanceof Error ? e.message : 'دسترسی مجاز نیست.',
            now(),
          );
        }
      },
    );
    application.post<{
      Params: { organizationId: string };
      Body: { email?: unknown; roleKey?: unknown };
    }>('/v1/organizations/:organizationId/invitations', async (req, reply) => {
      try {
        const s = await actor(options, req);
        await permit(options, s, req.params.organizationId, 'organization.manage_members');
        if (typeof req.body?.email !== 'string')
          return fail(reply, 'VALIDATION_ERROR', 'ایمیل معتبر نیست.', now());
        const result = await options.administration.createInvitation({
          organizationId: req.params.organizationId,
          email: req.body.email,
          ...(typeof req.body.roleKey === 'string' ? { roleKey: req.body.roleKey } : {}),
        });
        return reply.send(createApiSuccess(result, meta(reply, now())));
      } catch (e) {
        return fail(
          reply,
          e instanceof AuthenticationError ? (e.code as ApiErrorCode) : 'AUTHORIZATION_DENIED',
          e instanceof Error ? e.message : 'درخواست نامعتبر است.',
          now(),
        );
      }
    });
    application.post<{ Params: { token: string } }>(
      '/v1/invitations/:token/accept',
      async (req, reply) => {
        try {
          const s = await actor(options, req);
          const result = await options.administration.acceptInvitation(req.params.token, s.userId);
          return reply.send(createApiSuccess(result, meta(reply, now())));
        } catch (e) {
          return fail(
            reply,
            e instanceof AuthenticationError ? (e.code as ApiErrorCode) : 'INVITATION_INVALID',
            e instanceof Error ? e.message : 'دعوت معتبر نیست.',
            now(),
          );
        }
      },
    );
    application.delete<{ Params: { organizationId: string; invitationId: string } }>(
      '/v1/organizations/:organizationId/invitations/:invitationId',
      async (req, reply) => {
        try {
          const s = await actor(options, req);
          await permit(options, s, req.params.organizationId, 'organization.manage_members');
          return reply.send(
            createApiSuccess(
              {
                revoked: await options.administration.revokeInvitation(
                  req.params.organizationId,
                  req.params.invitationId,
                ),
              },
              meta(reply, now()),
            ),
          );
        } catch (e) {
          return fail(
            reply,
            'AUTHORIZATION_DENIED',
            e instanceof Error ? e.message : 'دسترسی مجاز نیست.',
            now(),
          );
        }
      },
    );
    application.patch<{
      Params: { organizationId: string; membershipId: string };
      Body: { status?: unknown };
    }>('/v1/organizations/:organizationId/memberships/:membershipId', async (req, reply) => {
      try {
        const s = await actor(options, req);
        await permit(options, s, req.params.organizationId, 'organization.manage_members');
        if (!['invited', 'active', 'suspended', 'revoked'].includes(String(req.body?.status)))
          return fail(reply, 'VALIDATION_ERROR', 'وضعیت عضویت معتبر نیست.', now());
        const updated = await options.administration.updateMembership(
          req.params.organizationId,
          req.params.membershipId,
          String(req.body?.status) as 'invited' | 'active' | 'suspended' | 'revoked',
        );
        return reply.send(createApiSuccess({ updated }, meta(reply, now())));
      } catch (e) {
        return fail(
          reply,
          'AUTHORIZATION_DENIED',
          e instanceof Error ? e.message : 'دسترسی مجاز نیست.',
          now(),
        );
      }
    });
    application.patch<{
      Params: { organizationId: string; membershipId: string };
      Body: { roleKeys?: unknown };
    }>('/v1/organizations/:organizationId/memberships/:membershipId/roles', async (req, reply) => {
      try {
        const s = await actor(options, req);
        await permit(options, s, req.params.organizationId, 'organization.manage_roles');
        if (
          !Array.isArray(req.body?.roleKeys) ||
          req.body.roleKeys.length === 0 ||
          req.body.roleKeys.some(
            (role) => !['member', 'manager', 'organization_admin'].includes(String(role)),
          )
        )
          return fail(reply, 'VALIDATION_ERROR', 'نقش‌های عضویت معتبر نیست.', now());
        const updated = await options.administration.replaceMembershipRoles(
          req.params.organizationId,
          req.params.membershipId,
          req.body.roleKeys as ('member' | 'manager' | 'organization_admin')[],
        );
        return reply.send(createApiSuccess({ updated }, meta(reply, now())));
      } catch (e) {
        return fail(
          reply,
          'AUTHORIZATION_DENIED',
          e instanceof Error ? e.message : 'دسترسی مجاز نیست.',
          now(),
        );
      }
    });
    application.post<{ Params: { organizationId: string }; Body: { name?: unknown } }>(
      '/v1/organizations/:organizationId/teams',
      async (req, reply) => {
        try {
          const s = await actor(options, req);
          await permit(options, s, req.params.organizationId, 'organization.manage_teams');
          if (typeof req.body?.name !== 'string')
            return fail(reply, 'VALIDATION_ERROR', 'نام تیم معتبر نیست.', now());
          return reply.send(
            createApiSuccess(
              await options.administration.createTeam(req.params.organizationId, req.body.name),
              meta(reply, now()),
            ),
          );
        } catch (e) {
          return fail(
            reply,
            'AUTHORIZATION_DENIED',
            e instanceof Error ? e.message : 'دسترسی مجاز نیست.',
            now(),
          );
        }
      },
    );
    application.patch<{
      Params: { organizationId: string; teamId: string };
      Body: { name?: unknown };
    }>('/v1/organizations/:organizationId/teams/:teamId', async (req, reply) => {
      try {
        const s = await actor(options, req);
        await permit(options, s, req.params.organizationId, 'organization.manage_teams');
        if (typeof req.body?.name !== 'string')
          return fail(reply, 'VALIDATION_ERROR', 'نام تیم معتبر نیست.', now());
        return reply.send(
          createApiSuccess(
            {
              updated: await options.administration.renameTeam(
                req.params.teamId,
                req.params.organizationId,
                req.body.name,
              ),
            },
            meta(reply, now()),
          ),
        );
      } catch (e) {
        return fail(
          reply,
          'AUTHORIZATION_DENIED',
          e instanceof Error ? e.message : 'دسترسی مجاز نیست.',
          now(),
        );
      }
    });
    application.post<{
      Params: { organizationId: string; teamId: string };
      Body: { membershipId?: unknown; role?: unknown };
    }>('/v1/organizations/:organizationId/teams/:teamId/members', async (req, reply) => {
      try {
        const s = await actor(options, req);
        await permit(options, s, req.params.organizationId, 'organization.manage_teams');
        if (typeof req.body?.membershipId !== 'string')
          return fail(reply, 'VALIDATION_ERROR', 'عضویت معتبر نیست.', now());
        return reply.send(
          createApiSuccess(
            {
              updated: await options.administration.addTeamMember(
                req.params.teamId,
                req.params.organizationId,
                req.body.membershipId,
                req.body.role === 'team_manager' ? 'team_manager' : 'member',
              ),
            },
            meta(reply, now()),
          ),
        );
      } catch (e) {
        return fail(
          reply,
          'AUTHORIZATION_DENIED',
          e instanceof Error ? e.message : 'دسترسی مجاز نیست.',
          now(),
        );
      }
    });
    application.delete<{
      Params: { organizationId: string; teamId: string; membershipId: string };
    }>(
      '/v1/organizations/:organizationId/teams/:teamId/members/:membershipId',
      async (req, reply) => {
        try {
          const s = await actor(options, req);
          await permit(options, s, req.params.organizationId, 'organization.manage_teams');
          return reply.send(
            createApiSuccess(
              {
                removed: await options.administration.removeTeamMember(
                  req.params.teamId,
                  req.params.organizationId,
                  req.params.membershipId,
                ),
              },
              meta(reply, now()),
            ),
          );
        } catch (e) {
          return fail(
            reply,
            'AUTHORIZATION_DENIED',
            e instanceof Error ? e.message : 'دسترسی مجاز نیست.',
            now(),
          );
        }
      },
    );
  };
}
