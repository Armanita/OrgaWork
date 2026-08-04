import { withUserTransaction, type PostgreSqlAccess } from '@workspace/database';
import { generateSecurityToken, hashSecurityToken } from '@workspace/security';

export const organizationContextErrorCodes = [
  'ORGANIZATION_CONTEXT_REQUIRED',
  'ORGANIZATION_MEMBERSHIP_REQUIRED',
  'ORGANIZATION_MEMBERSHIP_INACTIVE',
  'ORGANIZATION_SWITCH_FORBIDDEN',
] as const;
export type OrganizationContextErrorCode = (typeof organizationContextErrorCodes)[number];

export class OrganizationContextError extends Error {
  override readonly name = 'OrganizationContextError';
  constructor(
    readonly code: OrganizationContextErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface AvailableOrganization {
  readonly id: string;
  readonly name: string;
  readonly membershipId: string;
  readonly membershipStatus: 'active';
}

export interface OrganizationContextRepository {
  listActiveOrganizations(userId: string): Promise<readonly AvailableOrganization[]>;
  switchCurrentOrganization(input: {
    readonly sessionId: string;
    readonly userId: string;
    readonly organizationId: string;
    readonly csrfToken: string;
    readonly now: string;
  }): Promise<{ readonly sessionRevision: number } | undefined>;
}

export interface OrganizationContextService {
  listOrganizations(userId: string): Promise<readonly AvailableOrganization[]>;
  switchOrganization(input: {
    readonly sessionId: string;
    readonly userId: string;
    readonly organizationId: string;
  }): Promise<{
    readonly organizationId: string;
    readonly sessionRevision: number;
    readonly csrfToken: string;
  }>;
}

export function createPostgreSqlOrganizationContextRepository(
  access: PostgreSqlAccess,
): OrganizationContextRepository {
  return {
    listActiveOrganizations: async (userId) =>
      withUserTransaction(access, userId, async (transaction, normalizedUserId) => {
        const result = await transaction.query(
          `SELECT organization_row.id::text AS id,
                  organization_row.name,
                  membership.id::text AS membership_id
             FROM public.orgawork_memberships AS membership
             JOIN public.orgawork_organizations AS organization_row
               ON organization_row.id = membership.organization_id
            WHERE membership.user_id = $1
              AND membership.status = 'active'
            ORDER BY organization_row.name, organization_row.id`,
          [normalizedUserId],
        );

        return result.rows.map((row) => {
          const value = row as {
            readonly id: string;
            readonly name: string;
            readonly membership_id: string;
          };
          return {
            id: value.id,
            name: value.name,
            membershipId: value.membership_id,
            membershipStatus: 'active' as const,
          };
        });
      }),
    switchCurrentOrganization: async (input) => {
      const result = await access.query(
        `UPDATE public.orgawork_sessions AS session_row
            SET current_organization_id = $3,
                csrf_token = $4,
                session_revision = session_revision + 1,
                updated_at = $5,
                version = version + 1
          WHERE session_row.id = $1
            AND session_row.user_id = $2
            AND session_row.status = 'active'
            AND EXISTS (
              SELECT 1
                FROM public.orgawork_memberships AS membership
               WHERE membership.user_id = $2
                 AND membership.organization_id = $3
                 AND membership.status = 'active'
            )
        RETURNING session_revision`,
        [input.sessionId, input.userId, input.organizationId, input.csrfToken, input.now],
      );
      const row = result.rows[0] as { readonly session_revision: number } | undefined;
      return row === undefined ? undefined : { sessionRevision: row.session_revision };
    },
  };
}

export function createOrganizationContextService(
  repository: OrganizationContextRepository,
  now: () => Date = () => new Date(),
): OrganizationContextService {
  return {
    listOrganizations: (userId) => repository.listActiveOrganizations(userId),
    switchOrganization: async (input) => {
      const csrfToken = generateSecurityToken();
      const result = await repository.switchCurrentOrganization({
        ...input,
        csrfToken,
        now: now().toISOString(),
      });
      if (result === undefined) {
        throw new OrganizationContextError(
          'ORGANIZATION_SWITCH_FORBIDDEN',
          'انتخاب این سازمان برای کاربر مجاز نیست.',
        );
      }
      return {
        organizationId: input.organizationId,
        sessionRevision: result.sessionRevision,
        csrfToken,
      };
    },
  };
}

export function organizationCacheKey(input: {
  readonly userId: string;
  readonly sessionRevision: number;
  readonly organizationId: string;
  readonly resource: string;
}): string {
  return [
    input.userId,
    String(input.sessionRevision),
    input.organizationId,
    hashSecurityToken(input.resource),
  ].join(':');
}
