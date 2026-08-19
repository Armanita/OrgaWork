import { withOrganizationTransaction, type PostgreSqlAccess } from '@workspace/database';
import {
  decideAuthorization,
  loadTransactionalAuthorizationContext,
  recordTransactionalAuthorizationDecision,
  type AuthorizationDecision,
  type AuthorizationInput,
  type PermissionKey,
} from '@workspace/access-control';

export {
  decideAuthorization,
  organizationRoleCatalog,
  permissionCatalog,
} from '@workspace/access-control';
export type {
  AuthorizationDecision,
  AuthorizationInput,
  PermissionKey,
} from '@workspace/access-control';

export interface AuthorizationRepository {
  loadDecisionInput(input: {
    readonly userId: string;
    readonly organizationId: string;
    readonly permission: PermissionKey;
    readonly resourceType?: string;
    readonly resourceId?: string;
  }): Promise<
    Omit<AuthorizationInput, 'authenticated' | 'sessionActive' | 'organizationId' | 'permission'>
  >;
  recordDecision(input: {
    readonly userId: string;
    readonly organizationId: string;
    readonly permission: PermissionKey;
    readonly resourceType?: string;
    readonly resourceId?: string;
    readonly decision: AuthorizationDecision;
    readonly now: string;
  }): Promise<void>;
}

export function createPostgreSqlAuthorizationRepository(
  access: PostgreSqlAccess,
): AuthorizationRepository {
  return {
    loadDecisionInput: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        const stored = await loadTransactionalAuthorizationContext(transaction, input);
        return {
          ...(stored.membershipStatus === undefined
            ? {}
            : { membershipStatus: stored.membershipStatus }),
          rolePermissions: stored.rolePermissions,
          explicitDeny: stored.explicitDeny,
        };
      }),
    recordDecision: async (input) =>
      withOrganizationTransaction(access, input.organizationId, async (transaction) => {
        await recordTransactionalAuthorizationDecision(transaction, input);
      }),
  };
}

export function createAuthorizationService(
  repository: AuthorizationRepository,
  now: () => Date = () => new Date(),
) {
  return {
    authorize: async (input: {
      readonly userId: string;
      readonly organizationId: string;
      readonly permission: PermissionKey;
      readonly resourceType?: string;
      readonly resourceId?: string;
      readonly relationshipAllowed?: boolean;
      readonly resourceStatusAllowed?: boolean;
    }): Promise<AuthorizationDecision> => {
      const stored = await repository.loadDecisionInput(input);
      const decision = decideAuthorization({
        authenticated: true,
        sessionActive: true,
        organizationId: input.organizationId,
        permission: input.permission,
        ...stored,
        ...(input.relationshipAllowed === undefined
          ? {}
          : { relationshipAllowed: input.relationshipAllowed }),
        ...(input.resourceStatusAllowed === undefined
          ? {}
          : { resourceStatusAllowed: input.resourceStatusAllowed }),
      });
      await repository.recordDecision({ ...input, decision, now: now().toISOString() });
      return decision;
    },
  };
}
