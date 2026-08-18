import {
  decideP3Authorization,
  type AuthorizationDecision,
  type PermissionKey,
} from '@workspace/authorization';

export interface CreateOwnCaseAuthorizationContext {
  readonly authenticated: boolean;
  readonly sessionActive: boolean;
  readonly organizationId?: string;
  readonly membershipStatus?: 'invited' | 'active' | 'suspended' | 'revoked';
  readonly rolePermissions: readonly PermissionKey[];
  readonly explicitDeny: boolean;
}

export function decideCreateOwnCaseAuthorization(
  context: CreateOwnCaseAuthorizationContext,
): AuthorizationDecision {
  return decideP3Authorization({
    authenticated: context.authenticated,
    sessionActive: context.sessionActive,
    ...(context.organizationId === undefined ? {} : { organizationId: context.organizationId }),
    ...(context.membershipStatus === undefined
      ? {}
      : { membershipStatus: context.membershipStatus }),
    permission: 'case.create_self',
    rolePermissions: context.rolePermissions,
    explicitDeny: context.explicitDeny,
    relationshipAllowed: true,
    resourceStatusAllowed: true,
  });
}
