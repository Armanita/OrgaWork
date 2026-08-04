import { randomUUID } from 'node:crypto';

import {
  databaseRoleNames,
  withOrganizationTransaction,
  type PostgreSqlAccess,
  type PostgreSqlQueryExecutor,
} from '@workspace/database';
import { generateSecurityToken, hashSecurityToken } from '@workspace/security';

export const invitationPolicy = { lifetimeMilliseconds: 72 * 60 * 60 * 1000 } as const;
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked';
export type OrganizationRoleKey = 'member' | 'manager' | 'organization_admin';

export class OrganizationAdministrationError extends Error {
  override readonly name = 'OrganizationAdministrationError';

  constructor(
    readonly code:
      | 'INVITATION_INVALID'
      | 'INVITATION_EXPIRED'
      | 'INVITATION_REVOKED'
      | 'MEMBERSHIP_STATE_CONFLICT'
      | 'TEAM_ORGANIZATION_MISMATCH',
    message: string,
  ) {
    super(message);
  }
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLocaleLowerCase('en-US');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new TypeError('ایمیل معتبر نیست.');
  }
  return email;
}

function normalizeName(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized === '' || normalized.length > 120) {
    throw new TypeError(label + ' معتبر نیست.');
  }
  return normalized;
}

export interface OrganizationMemberView {
  readonly id: string;
  readonly email: string;
  readonly status: MembershipStatus;
  readonly roleKeys: readonly OrganizationRoleKey[];
}

export interface OrganizationTeamView {
  readonly id: string;
  readonly name: string;
  readonly memberCount: number;
}

export interface OrganizationAdministrationRepository {
  listMemberships(organizationId: string): Promise<readonly OrganizationMemberView[]>;
  listTeams(organizationId: string): Promise<readonly OrganizationTeamView[]>;
  createInvitation(input: {
    readonly id: string;
    readonly organizationId: string;
    readonly email: string;
    readonly tokenHash: string;
    readonly roleKey: OrganizationRoleKey;
    readonly expiresAt: string;
    readonly now: string;
  }): Promise<{ readonly id: string; readonly reused: boolean }>;
  acceptInvitation(input: {
    readonly tokenHash: string;
    readonly userId: string;
    readonly now: string;
  }): Promise<{ readonly organizationId: string; readonly membershipId: string } | undefined>;
  revokeInvitation(input: {
    readonly organizationId: string;
    readonly invitationId: string;
    readonly now: string;
  }): Promise<boolean>;
  updateMembership(input: {
    readonly organizationId: string;
    readonly membershipId: string;
    readonly status: MembershipStatus;
    readonly now: string;
  }): Promise<boolean>;
  replaceMembershipRoles(input: {
    readonly organizationId: string;
    readonly membershipId: string;
    readonly roleKeys: readonly OrganizationRoleKey[];
    readonly now: string;
  }): Promise<boolean>;
  createTeam(input: {
    readonly id: string;
    readonly organizationId: string;
    readonly name: string;
    readonly now: string;
  }): Promise<void>;
  renameTeam(input: {
    readonly teamId: string;
    readonly organizationId: string;
    readonly name: string;
    readonly now: string;
  }): Promise<boolean>;
  addTeamMember(input: {
    readonly id: string;
    readonly teamId: string;
    readonly organizationId: string;
    readonly membershipId: string;
    readonly role: 'member' | 'team_manager';
    readonly now: string;
  }): Promise<boolean>;
  removeTeamMember(input: {
    readonly teamId: string;
    readonly organizationId: string;
    readonly membershipId: string;
  }): Promise<boolean>;
}

async function setInvitationTokenContext(
  transaction: PostgreSqlQueryExecutor,
  tokenHash: string,
): Promise<void> {
  await transaction.query(`SET LOCAL ROLE ${databaseRoleNames.runtime}`);
  await transaction.query("SELECT set_config('orgawork.invitation_token_hash', $1, true)", [
    tokenHash,
  ]);
}

export function createPostgreSqlOrganizationAdministrationRepository(
  access: PostgreSqlAccess,
): OrganizationAdministrationRepository {
  return {
    listMemberships: async (organizationId) =>
      withOrganizationTransaction(access, organizationId, async (transaction) => {
        const result = await transaction.query(
          `SELECT
             membership.id::text AS id,
             user_row.email,
             membership.status,
             COALESCE(
               array_agg(membership_role.role_key ORDER BY membership_role.role_key)
                 FILTER (WHERE membership_role.role_key IS NOT NULL),
               ARRAY[]::text[]
             ) AS role_keys
           FROM public.orgawork_memberships AS membership
           JOIN public.orgawork_users AS user_row ON user_row.id = membership.user_id
           LEFT JOIN public.orgawork_membership_roles AS membership_role
             ON membership_role.membership_id = membership.id
          WHERE membership.organization_id = $1
          GROUP BY membership.id, user_row.email, membership.status
          ORDER BY user_row.email`,
          [organizationId],
        );
        return result.rows.map((row) => {
          const value = row as {
            readonly id: string;
            readonly email: string;
            readonly status: MembershipStatus;
            readonly role_keys: readonly OrganizationRoleKey[];
          };
          return {
            id: value.id,
            email: value.email,
            status: value.status,
            roleKeys: value.role_keys,
          };
        });
      }),
    listTeams: async (organizationId) =>
      withOrganizationTransaction(access, organizationId, async (transaction) => {
        const result = await transaction.query(
          `SELECT
             team.id::text AS id,
             team.name,
             count(team_membership.id)::int AS member_count
           FROM public.orgawork_teams AS team
           LEFT JOIN public.orgawork_team_memberships AS team_membership
             ON team_membership.team_id = team.id
            AND team_membership.organization_id = team.organization_id
          WHERE team.organization_id = $1
          GROUP BY team.id, team.name
          ORDER BY team.name`,
          [organizationId],
        );
        return result.rows.map((row) => {
          const value = row as {
            readonly id: string;
            readonly name: string;
            readonly member_count: number;
          };
          return { id: value.id, name: value.name, memberCount: value.member_count };
        });
      }),
    createInvitation: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        const existing = await transaction.query(
          `SELECT id::text AS id
             FROM public.orgawork_invitations
            WHERE organization_id = $1
              AND email_normalized = $2
              AND status = 'active'
              AND expires_at > $3
            LIMIT 1`,
          [input.organizationId, input.email, input.now],
        );
        const row = existing.rows[0] as { readonly id: string } | undefined;
        if (row !== undefined) {
          return { id: row.id, reused: true };
        }

        await transaction.query(
          `UPDATE public.orgawork_invitations
              SET status = 'expired', updated_at = $3
            WHERE organization_id = $1
              AND email_normalized = $2
              AND status = 'active'
              AND expires_at <= $3`,
          [input.organizationId, input.email, input.now],
        );
        await transaction.query(
          `INSERT INTO public.orgawork_invitations
             (
               id,
               organization_id,
               email_normalized,
               token_hash,
               role_key,
               status,
               expires_at,
               created_at,
               updated_at
             )
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $7)`,
          [
            input.id,
            input.organizationId,
            input.email,
            input.tokenHash,
            input.roleKey,
            input.expiresAt,
            input.now,
          ],
        );
        return { id: input.id, reused: false };
      }),
    acceptInvitation: async (input) =>
      access.transaction(async (transaction) => {
        await setInvitationTokenContext(transaction, input.tokenHash);
        const invitationResult = await transaction.query(
          `SELECT
             invitation.id::text AS invitation_id,
             invitation.organization_id::text AS organization_id,
             invitation.email_normalized,
             invitation.role_key
           FROM public.orgawork_invitations AS invitation
           JOIN public.orgawork_users AS user_row
             ON user_row.id = $2
            AND user_row.email = invitation.email_normalized
            AND user_row.status = 'active'
          WHERE invitation.token_hash = $1
            AND invitation.status = 'active'
            AND invitation.expires_at > $3
          FOR UPDATE OF invitation`,
          [input.tokenHash, input.userId, input.now],
        );
        const invitation = invitationResult.rows[0] as
          | {
              readonly invitation_id: string;
              readonly organization_id: string;
              readonly email_normalized: string;
              readonly role_key: OrganizationRoleKey;
            }
          | undefined;
        if (invitation === undefined) {
          return undefined;
        }

        await transaction.query("SELECT set_config('orgawork.organization_id', $1, true)", [
          invitation.organization_id,
        ]);

        const existingMembership = await transaction.query(
          `SELECT id::text AS id, status
             FROM public.orgawork_memberships
            WHERE organization_id = $1
              AND user_id = $2
            FOR UPDATE`,
          [invitation.organization_id, input.userId],
        );
        const existing = existingMembership.rows[0] as
          { readonly id: string; readonly status: MembershipStatus } | undefined;
        if (existing?.status === 'revoked') {
          throw new OrganizationAdministrationError(
            'MEMBERSHIP_STATE_CONFLICT',
            'عضویت لغوشده قابل فعال‌سازی دوباره نیست.',
          );
        }

        let membershipId: string;
        if (existing === undefined) {
          const inserted = await transaction.query(
            `INSERT INTO public.orgawork_memberships
               (id, organization_id, user_id, status, created_at, updated_at, version)
             VALUES (gen_random_uuid(), $1, $2, 'active', $3, $3, 1)
             RETURNING id::text AS id`,
            [invitation.organization_id, input.userId, input.now],
          );
          membershipId = (inserted.rows[0] as { readonly id: string }).id;
        } else {
          const updated = await transaction.query(
            `UPDATE public.orgawork_memberships
                SET status = 'active', updated_at = $3, version = version + 1
              WHERE id = $1 AND organization_id = $2
              RETURNING id::text AS id`,
            [existing.id, invitation.organization_id, input.now],
          );
          membershipId = (updated.rows[0] as { readonly id: string }).id;
        }

        await transaction.query(
          `DELETE FROM public.orgawork_membership_roles WHERE membership_id = $1`,
          [membershipId],
        );
        await transaction.query(
          `INSERT INTO public.orgawork_membership_roles
             (membership_id, role_key, created_at)
           VALUES ($1, $2, $3)`,
          [membershipId, invitation.role_key, input.now],
        );
        await transaction.query(
          `UPDATE public.orgawork_invitations
              SET status = 'accepted', accepted_at = $2, updated_at = $2
            WHERE id = $1`,
          [invitation.invitation_id, input.now],
        );

        return { organizationId: invitation.organization_id, membershipId };
      }),
    revokeInvitation: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        const result = await transaction.query(
          `UPDATE public.orgawork_invitations
              SET status = 'revoked', revoked_at = $3, updated_at = $3
            WHERE id = $2
              AND organization_id = $1
              AND status = 'active'`,
          [input.organizationId, input.invitationId, input.now],
        );
        return (result.rowCount ?? 0) === 1;
      }),
    updateMembership: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        const result = await transaction.query(
          `UPDATE public.orgawork_memberships
              SET status = $3, updated_at = $4, version = version + 1
            WHERE organization_id = $1 AND id = $2`,
          [input.organizationId, input.membershipId, input.status, input.now],
        );
        if (input.status === 'revoked' || input.status === 'suspended') {
          await transaction.query(
            `DELETE FROM public.orgawork_team_memberships
              WHERE organization_id = $1 AND membership_id = $2`,
            [input.organizationId, input.membershipId],
          );
        }
        return (result.rowCount ?? 0) === 1;
      }),
    replaceMembershipRoles: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        const membership = await transaction.query(
          `SELECT id
             FROM public.orgawork_memberships
            WHERE id = $1
              AND organization_id = $2
              AND status = 'active'`,
          [input.membershipId, input.organizationId],
        );
        if ((membership.rowCount ?? 0) !== 1) {
          return false;
        }
        await transaction.query(
          `DELETE FROM public.orgawork_membership_roles WHERE membership_id = $1`,
          [input.membershipId],
        );
        for (const roleKey of input.roleKeys) {
          await transaction.query(
            `INSERT INTO public.orgawork_membership_roles
               (membership_id, role_key, created_at)
             VALUES ($1, $2, $3)`,
            [input.membershipId, roleKey, input.now],
          );
        }
        return true;
      }),
    createTeam: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        await transaction.query(
          `INSERT INTO public.orgawork_teams
             (id, organization_id, name, created_at, updated_at, version)
           VALUES ($1, $2, $3, $4, $4, 1)`,
          [input.id, input.organizationId, input.name, input.now],
        );
      }),
    renameTeam: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        const result = await transaction.query(
          `UPDATE public.orgawork_teams
              SET name = $3, updated_at = $4, version = version + 1
            WHERE id = $1 AND organization_id = $2`,
          [input.teamId, input.organizationId, input.name, input.now],
        );
        return (result.rowCount ?? 0) === 1;
      }),
    addTeamMember: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        const result = await transaction.query(
          `INSERT INTO public.orgawork_team_memberships
             (
               id,
               team_id,
               membership_id,
               organization_id,
               role,
               created_at,
               updated_at,
               version
             )
           SELECT $1, $2, membership.id, $3, $5, $6, $6, 1
             FROM public.orgawork_memberships AS membership
            WHERE membership.id = $4
              AND membership.organization_id = $3
              AND membership.status = 'active'
           ON CONFLICT (team_id, membership_id)
           DO UPDATE SET
             role = EXCLUDED.role,
             updated_at = EXCLUDED.updated_at,
             version = public.orgawork_team_memberships.version + 1`,
          [input.id, input.teamId, input.organizationId, input.membershipId, input.role, input.now],
        );
        return (result.rowCount ?? 0) === 1;
      }),
    removeTeamMember: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        const result = await transaction.query(
          `DELETE FROM public.orgawork_team_memberships
            WHERE team_id = $1
              AND organization_id = $2
              AND membership_id = $3`,
          [input.teamId, input.organizationId, input.membershipId],
        );
        return (result.rowCount ?? 0) === 1;
      }),
  };
}

export function createOrganizationAdministrationService(
  repository: OrganizationAdministrationRepository,
  options: { readonly now?: () => Date; readonly createId?: () => string } = {},
) {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;

  return {
    listMemberships: (organizationId: string) => repository.listMemberships(organizationId),
    listTeams: (organizationId: string) => repository.listTeams(organizationId),
    createInvitation: async (input: {
      organizationId: string;
      email: string;
      roleKey?: OrganizationRoleKey;
    }) => {
      const token = generateSecurityToken();
      const current = now();
      const result = await repository.createInvitation({
        id: createId(),
        organizationId: input.organizationId,
        email: normalizeEmail(input.email),
        tokenHash: hashSecurityToken(token),
        roleKey: input.roleKey ?? 'member',
        expiresAt: new Date(
          current.getTime() + invitationPolicy.lifetimeMilliseconds,
        ).toISOString(),
        now: current.toISOString(),
      });
      return { ...result, ...(result.reused ? {} : { token }) };
    },
    acceptInvitation: async (token: string, userId: string) => {
      const result = await repository.acceptInvitation({
        tokenHash: hashSecurityToken(token),
        userId,
        now: now().toISOString(),
      });
      if (result === undefined) {
        throw new OrganizationAdministrationError(
          'INVITATION_INVALID',
          'دعوت معتبر نیست یا منقضی شده است.',
        );
      }
      return result;
    },
    revokeInvitation: (organizationId: string, invitationId: string) =>
      repository.revokeInvitation({
        organizationId,
        invitationId,
        now: now().toISOString(),
      }),
    updateMembership: (organizationId: string, membershipId: string, status: MembershipStatus) =>
      repository.updateMembership({
        organizationId,
        membershipId,
        status,
        now: now().toISOString(),
      }),
    replaceMembershipRoles: (
      organizationId: string,
      membershipId: string,
      roleKeys: readonly OrganizationRoleKey[],
    ) =>
      repository.replaceMembershipRoles({
        organizationId,
        membershipId,
        roleKeys: [...new Set(roleKeys)],
        now: now().toISOString(),
      }),
    createTeam: async (organizationId: string, name: string) => {
      const id = createId();
      await repository.createTeam({
        id,
        organizationId,
        name: normalizeName(name, 'نام تیم'),
        now: now().toISOString(),
      });
      return { id };
    },
    renameTeam: (teamId: string, organizationId: string, name: string) =>
      repository.renameTeam({
        teamId,
        organizationId,
        name: normalizeName(name, 'نام تیم'),
        now: now().toISOString(),
      }),
    addTeamMember: (
      teamId: string,
      organizationId: string,
      membershipId: string,
      role: 'member' | 'team_manager' = 'member',
    ) =>
      repository.addTeamMember({
        id: createId(),
        teamId,
        organizationId,
        membershipId,
        role,
        now: now().toISOString(),
      }),
    removeTeamMember: (teamId: string, organizationId: string, membershipId: string) =>
      repository.removeTeamMember({ teamId, organizationId, membershipId }),
  };
}
