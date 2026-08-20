import type { PostgreSqlQueryExecutor } from '@workspace/database';

export const permissionCatalog = [
  'organization.view',
  'organization.manage_members',
  'organization.manage_teams',
  'organization.manage_roles',
  'task.view',
  'task.update',
  'task.assign',
  'report.view',
  'case.create_self',
] as const;

export type PermissionKey = (typeof permissionCatalog)[number];

export const organizationRoleCatalog = {
  member: ['organization.view', 'task.view', 'case.create_self'],
  manager: [
    'organization.view',
    'task.view',
    'task.update',
    'task.assign',
    'report.view',
    'case.create_self',
  ],
  organization_admin: [
    'organization.view',
    'organization.manage_members',
    'organization.manage_teams',
    'organization.manage_roles',
    'task.view',
    'task.update',
    'task.assign',
    'report.view',
  ],
  platform_operator: [],
} as const satisfies Readonly<Record<string, readonly PermissionKey[]>>;

export interface AuthorizationInput {
  readonly authenticated: boolean;
  readonly sessionActive: boolean;
  readonly organizationId?: string;
  readonly membershipStatus?: 'invited' | 'active' | 'suspended' | 'revoked';
  readonly permission: PermissionKey;
  readonly rolePermissions: readonly PermissionKey[];
  readonly explicitDeny: boolean;
  readonly relationshipAllowed?: boolean;
  readonly resourceStatusAllowed?: boolean;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reasonCode:
    | 'IDENTITY_REQUIRED'
    | 'SESSION_REQUIRED'
    | 'ORGANIZATION_REQUIRED'
    | 'MEMBERSHIP_INACTIVE'
    | 'EXPLICIT_DENY'
    | 'PERMISSION_MISSING'
    | 'RELATIONSHIP_DENIED'
    | 'RESOURCE_STATE_DENIED'
    | 'ALLOWED';
}

export interface TransactionalAuthorizationContext {
  readonly membershipId?: string;
  readonly membershipStatus?: AuthorizationInput['membershipStatus'];
  readonly rolePermissions: readonly PermissionKey[];
  readonly explicitDeny: boolean;
}

export interface TransactionalAuthorizationLookup {
  readonly userId: string;
  readonly organizationId: string;
  readonly permission: PermissionKey;
  readonly resourceType?: string;
  readonly resourceId?: string;
}

export function decideAuthorization(input: AuthorizationInput): AuthorizationDecision {
  if (!input.authenticated) return { allowed: false, reasonCode: 'IDENTITY_REQUIRED' };
  if (!input.sessionActive) return { allowed: false, reasonCode: 'SESSION_REQUIRED' };
  if (input.organizationId === undefined)
    return { allowed: false, reasonCode: 'ORGANIZATION_REQUIRED' };
  if (input.membershipStatus !== 'active')
    return { allowed: false, reasonCode: 'MEMBERSHIP_INACTIVE' };
  if (input.explicitDeny) return { allowed: false, reasonCode: 'EXPLICIT_DENY' };
  if (!input.rolePermissions.includes(input.permission))
    return { allowed: false, reasonCode: 'PERMISSION_MISSING' };
  if (input.relationshipAllowed === false)
    return { allowed: false, reasonCode: 'RELATIONSHIP_DENIED' };
  if (input.resourceStatusAllowed === false)
    return { allowed: false, reasonCode: 'RESOURCE_STATE_DENIED' };
  return { allowed: true, reasonCode: 'ALLOWED' };
}

export async function loadTransactionalAuthorizationContext(
  transaction: PostgreSqlQueryExecutor,
  input: TransactionalAuthorizationLookup,
): Promise<TransactionalAuthorizationContext> {
  const result = await transaction.query(
    `SELECT membership.id AS membership_id,
            membership.status AS membership_status,
            COALESCE(
              array_agg(DISTINCT role_permission.permission_key)
                FILTER (WHERE role_permission.permission_key IS NOT NULL),
              ARRAY[]::text[]
            ) AS permissions,
            EXISTS (
              SELECT 1
                FROM public.orgawork_explicit_denials AS deny
               WHERE deny.organization_id = $2
                 AND deny.membership_id = membership.id
                 AND deny.permission_key = $3
                 AND (deny.resource_type IS NULL OR deny.resource_type = $4)
                 AND (deny.resource_id IS NULL OR deny.resource_id = $5)
                 AND (deny.expires_at IS NULL OR deny.expires_at > now())
            ) AS explicit_deny
       FROM public.orgawork_memberships AS membership
       LEFT JOIN public.orgawork_membership_roles AS membership_role
         ON membership_role.membership_id = membership.id
       LEFT JOIN public.orgawork_role_permissions AS role_permission
         ON role_permission.role_key = membership_role.role_key
      WHERE membership.user_id = $1
        AND membership.organization_id = $2
      GROUP BY membership.id, membership.status`,
    [
      input.userId,
      input.organizationId,
      input.permission,
      input.resourceType ?? null,
      input.resourceId ?? null,
    ],
  );

  const row = result.rows[0] as
    | {
        readonly membership_id?: string;
        readonly membership_status?: AuthorizationInput['membershipStatus'];
        readonly permissions?: readonly PermissionKey[];
        readonly explicit_deny?: boolean;
      }
    | undefined;

  return {
    ...(row?.membership_id === undefined ? {} : { membershipId: row.membership_id }),
    ...(row?.membership_status === undefined ? {} : { membershipStatus: row.membership_status }),
    rolePermissions: row?.permissions ?? [],
    explicitDeny: row?.explicit_deny ?? false,
  };
}

export async function recordTransactionalAuthorizationDecision(
  transaction: PostgreSqlQueryExecutor,
  input: TransactionalAuthorizationLookup & {
    readonly decision: AuthorizationDecision;
    readonly now: string;
  },
): Promise<void> {
  await transaction.query(
    `INSERT INTO public.orgawork_authorization_audit
      (id, organization_id, user_id, permission_key, resource_type, resource_id, allowed, reason_code, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.organizationId,
      input.userId,
      input.permission,
      input.resourceType ?? null,
      input.resourceId ?? null,
      input.decision.allowed,
      input.decision.reasonCode,
      input.now,
    ],
  );
}

export async function authorizeInTransaction(
  transaction: PostgreSqlQueryExecutor,
  input: TransactionalAuthorizationLookup & {
    readonly authenticated?: boolean;
    readonly sessionActive?: boolean;
    readonly relationshipAllowed?: boolean;
    readonly resourceStatusAllowed?: boolean;
    readonly now: string;
  },
): Promise<{ readonly decision: AuthorizationDecision; readonly membershipId?: string }> {
  const stored = await loadTransactionalAuthorizationContext(transaction, input);
  const decision = decideAuthorization({
    authenticated: input.authenticated ?? true,
    sessionActive: input.sessionActive ?? true,
    organizationId: input.organizationId,
    permission: input.permission,
    ...(stored.membershipStatus === undefined ? {} : { membershipStatus: stored.membershipStatus }),
    rolePermissions: stored.rolePermissions,
    explicitDeny: stored.explicitDeny,
    ...(input.relationshipAllowed === undefined
      ? {}
      : { relationshipAllowed: input.relationshipAllowed }),
    ...(input.resourceStatusAllowed === undefined
      ? {}
      : { resourceStatusAllowed: input.resourceStatusAllowed }),
  });

  await recordTransactionalAuthorizationDecision(transaction, { ...input, decision });

  return {
    decision,
    ...(stored.membershipId === undefined ? {} : { membershipId: stored.membershipId }),
  };
}
