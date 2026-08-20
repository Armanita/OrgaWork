import { createHash, randomUUID } from 'node:crypto';

import { createCorrelationId, createIdempotencyKey, createRequestId } from '@workspace/contracts';
import {
  normalizeOrganizationId,
  withUserTransaction,
  type PostgreSqlAccess,
  type PostgreSqlQueryExecutor,
} from '@workspace/database';

export type PlatformOperatorStatus = 'active' | 'disabled';
export type PlatformProvisioningAction =
  | 'organization.create'
  | 'organization.rename'
  | 'organization_admin.provision'
  | 'organization_admin.revoke';
export type PlatformProvisioningResult = 'succeeded' | 'failed';

export interface PlatformOperatorView {
  readonly userId: string;
  readonly email: string;
  readonly status: 'active';
}

export interface PlatformOrganizationAdminView {
  readonly membershipId: string;
  readonly userId: string;
  readonly email: string;
  readonly membershipStatus: 'active' | 'suspended';
}

export interface PlatformOrganizationView {
  readonly id: string;
  readonly name: string;
}

export interface PlatformOrganizationSummary extends PlatformOrganizationView {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly admins: readonly PlatformOrganizationAdminView[];
}

export interface PlatformProvisioningAuditView {
  readonly id: string;
  readonly action: PlatformProvisioningAction;
  readonly reason: string;
  readonly actorUserId: string;
  readonly actorEmail: string;
  readonly organizationId: string | null;
  readonly organizationName: string | null;
  readonly targetUserId: string | null;
  readonly requestId: string;
  readonly correlationId: string;
  readonly result: PlatformProvisioningResult;
  readonly createdAt: string;
}

export interface CreatePlatformOrganizationResult {
  readonly organization: PlatformOrganizationView;
  readonly replayed: boolean;
}

export interface RenamePlatformOrganizationResult {
  readonly organization: PlatformOrganizationView;
  readonly replayed: boolean;
}

export interface ProvisionInitialOrganizationAdminResult {
  readonly organizationId: string;
  readonly userId: string;
  readonly email: string;
  readonly membershipId: string;
  readonly role: 'organization_admin';
  readonly accountSetupRequired: boolean;
  readonly replayed: boolean;
}

export interface RevokeOrganizationAdminResult {
  readonly organizationId: string;
  readonly userId: string;
  readonly email: string;
  readonly membershipId: string;
  readonly replayed: boolean;
}

export type PlatformControlPlaneErrorCode =
  | 'PLATFORM_AUTHORITY_REQUIRED'
  | 'PLATFORM_IDEMPOTENCY_CONFLICT'
  | 'PLATFORM_ORGANIZATION_NOT_FOUND'
  | 'PLATFORM_TARGET_USER_STATE_CONFLICT'
  | 'PLATFORM_TARGET_MEMBERSHIP_STATE_CONFLICT'
  | 'PLATFORM_ADMIN_NOT_FOUND'
  | 'PLATFORM_LAST_ADMIN_PROTECTED';

export class PlatformControlPlaneError extends Error {
  override readonly name = 'PlatformControlPlaneError';

  constructor(
    readonly code: PlatformControlPlaneErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface StoredIdempotencyRow {
  readonly request_fingerprint: string;
  readonly result_json: unknown;
}

type IdempotencyLookup<Result> =
  | { readonly kind: 'fresh' }
  | { readonly kind: 'replay'; readonly result: Result }
  | { readonly kind: 'conflict' };

type CommandOutcome<Result> =
  | { readonly kind: 'success'; readonly result: Result; readonly replayed: boolean }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'idempotency_conflict' }
  | { readonly kind: 'organization_not_found' }
  | { readonly kind: 'user_state_conflict' }
  | { readonly kind: 'membership_state_conflict' }
  | { readonly kind: 'admin_not_found' }
  | { readonly kind: 'last_admin_conflict' };

export interface PlatformControlPlaneRepository {
  findOperator(userId: string): Promise<
    | {
        readonly userId: string;
        readonly email: string;
        readonly status: PlatformOperatorStatus;
      }
    | undefined
  >;
  listOrganizations(userId: string): Promise<readonly PlatformOrganizationSummary[]>;
  listAudit(userId: string, limit: number): Promise<readonly PlatformProvisioningAuditView[]>;
  createOrganization(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly name: string;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly auditId: string;
    readonly now: string;
  }): Promise<CommandOutcome<{ readonly organization: PlatformOrganizationView }>>;
  renameOrganization(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly name: string;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly auditId: string;
    readonly now: string;
  }): Promise<CommandOutcome<{ readonly organization: PlatformOrganizationView }>>;
  provisionInitialAdmin(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly email: string;
    readonly candidateUserId: string;
    readonly candidateMembershipId: string;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly auditId: string;
    readonly now: string;
  }): Promise<
    CommandOutcome<{
      readonly organizationId: string;
      readonly userId: string;
      readonly email: string;
      readonly membershipId: string;
      readonly role: 'organization_admin';
      readonly accountSetupRequired: boolean;
    }>
  >;
  revokeOrganizationAdmin(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly membershipId: string;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly auditId: string;
    readonly now: string;
  }): Promise<
    CommandOutcome<{
      readonly organizationId: string;
      readonly userId: string;
      readonly email: string;
      readonly membershipId: string;
    }>
  >;
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('en-US');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
    throw new TypeError('ایمیل معتبر نیست.');
  }
  return normalized;
}

function normalizeOrganizationName(value: string): string {
  const normalized = value.trim();
  if (normalized === '' || normalized.length > 120) {
    throw new TypeError('نام سازمان معتبر نیست.');
  }
  return normalized;
}

function normalizeReason(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 10 || normalized.length > 500) {
    throw new TypeError('دلیل عملیات باید بین ۱۰ تا ۵۰۰ نویسه باشد.');
  }
  return normalized;
}

function normalizeAuditLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new TypeError('تعداد رویدادهای ممیزی معتبر نیست.');
  }
  return value;
}

function normalizeUuid(value: string, label: string): string {
  const normalized = value.trim().toLocaleLowerCase('en-US');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(normalized)
  ) {
    throw new TypeError(`${label} معتبر نیست.`);
  }
  return normalized;
}

function fingerprint(value: Readonly<Record<string, string>>): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function normalizeStoredTimestamp(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error('زمان ممیزی ذخیره‌شده معتبر نیست.');
  }
  return date.toISOString();
}

async function activeOperator(
  transaction: PostgreSqlQueryExecutor,
  actorUserId: string,
): Promise<boolean> {
  const result = await transaction.query(
    `SELECT platform_operator.user_id
       FROM public.orgawork_platform_operators AS platform_operator
      WHERE platform_operator.user_id = $1
        AND platform_operator.status = 'active'`,
    [actorUserId],
  );
  return (result.rowCount ?? 0) === 1;
}

async function setPlatformTarget(
  transaction: PostgreSqlQueryExecutor,
  organizationId: string,
): Promise<string> {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);
  await transaction.query(
    "SELECT set_config('orgawork.platform_target_organization_id', $1, true)",
    [normalizedOrganizationId],
  );
  return normalizedOrganizationId;
}

async function lookupIdempotency<Result>(
  transaction: PostgreSqlQueryExecutor,
  input: {
    readonly actorUserId: string;
    readonly operation: PlatformProvisioningAction;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
  },
): Promise<IdempotencyLookup<Result>> {
  const lockKey = `${input.actorUserId}:${input.operation}:${input.idempotencyKey}`;
  await transaction.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey]);

  const result = await transaction.query(
    `SELECT request_fingerprint, result_json
       FROM public.orgawork_platform_idempotency
      WHERE actor_user_id = $1
        AND operation = $2
        AND idempotency_key = $3`,
    [input.actorUserId, input.operation, input.idempotencyKey],
  );
  const row = result.rows[0] as StoredIdempotencyRow | undefined;
  if (row === undefined) return { kind: 'fresh' };
  if (row.request_fingerprint !== input.requestFingerprint) return { kind: 'conflict' };
  return { kind: 'replay', result: row.result_json as Result };
}

async function storeIdempotency(
  transaction: PostgreSqlQueryExecutor,
  input: {
    readonly actorUserId: string;
    readonly operation: PlatformProvisioningAction;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly result: unknown;
    readonly requestId: string;
    readonly correlationId: string;
    readonly now: string;
  },
): Promise<void> {
  await transaction.query(
    `INSERT INTO public.orgawork_platform_idempotency
       (
         actor_user_id,
         operation,
         idempotency_key,
         request_fingerprint,
         result_json,
         request_id,
         correlation_id,
         created_at
       )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
    [
      input.actorUserId,
      input.operation,
      input.idempotencyKey,
      input.requestFingerprint,
      JSON.stringify(input.result),
      input.requestId,
      input.correlationId,
      input.now,
    ],
  );
}

async function insertAudit(
  transaction: PostgreSqlQueryExecutor,
  input: {
    readonly id: string;
    readonly actorUserId: string;
    readonly action: PlatformProvisioningAction;
    readonly reason: string;
    readonly organizationId: string | null;
    readonly targetUserId: string | null;
    readonly requestId: string;
    readonly correlationId: string;
    readonly result: PlatformProvisioningResult;
    readonly now: string;
  },
): Promise<void> {
  await transaction.query(
    `INSERT INTO public.orgawork_platform_provisioning_audit
       (
         id,
         actor_user_id,
         action,
         reason,
         organization_id,
         target_user_id,
         request_id,
         correlation_id,
         result,
         created_at
       )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.id,
      input.actorUserId,
      input.action,
      input.reason,
      input.organizationId,
      input.targetUserId,
      input.requestId,
      input.correlationId,
      input.result,
      input.now,
    ],
  );
}

export function createPostgreSqlPlatformControlPlaneRepository(
  access: PostgreSqlAccess,
): PlatformControlPlaneRepository {
  return {
    findOperator: async (userId) =>
      withUserTransaction(access, userId, async (transaction, normalizedUserId) => {
        const result = await transaction.query(
          `SELECT
             platform_operator.user_id::text AS user_id,
             user_row.email,
             platform_operator.status
           FROM public.orgawork_platform_operators AS platform_operator
           JOIN public.orgawork_users AS user_row
             ON user_row.id = platform_operator.user_id
          WHERE platform_operator.user_id = $1`,
          [normalizedUserId],
        );
        const row = result.rows[0] as
          | {
              readonly user_id: string;
              readonly email: string;
              readonly status: PlatformOperatorStatus;
            }
          | undefined;
        return row === undefined
          ? undefined
          : { userId: row.user_id, email: row.email, status: row.status };
      }),

    listOrganizations: async (userId) =>
      withUserTransaction(access, userId, async (transaction, normalizedUserId) => {
        if (!(await activeOperator(transaction, normalizedUserId))) return [];

        const result = await transaction.query(
          `SELECT id::text AS id, name, created_at, updated_at
             FROM public.orgawork_organizations
            ORDER BY name, created_at`,
        );

        const organizations: PlatformOrganizationSummary[] = [];
        for (const row of result.rows) {
          const value = row as {
            readonly id: string;
            readonly name: string;
            readonly created_at: unknown;
            readonly updated_at: unknown;
          };
          await setPlatformTarget(transaction, value.id);
          const adminsResult = await transaction.query(
            `SELECT
               membership.id::text AS membership_id,
               user_row.id::text AS user_id,
               user_row.email,
               membership.status AS membership_status
             FROM public.orgawork_memberships AS membership
             JOIN public.orgawork_membership_roles AS membership_role
               ON membership_role.membership_id = membership.id
              AND membership_role.role_key = 'organization_admin'
             JOIN public.orgawork_users AS user_row
               ON user_row.id = membership.user_id
            WHERE membership.organization_id = $1
              AND membership.status IN ('active', 'suspended')
            ORDER BY user_row.email`,
            [value.id],
          );

          organizations.push({
            id: value.id,
            name: value.name,
            createdAt: normalizeStoredTimestamp(value.created_at),
            updatedAt: normalizeStoredTimestamp(value.updated_at),
            admins: adminsResult.rows.map((adminRow) => {
              const admin = adminRow as {
                readonly membership_id: string;
                readonly user_id: string;
                readonly email: string;
                readonly membership_status: 'active' | 'suspended';
              };
              return {
                membershipId: admin.membership_id,
                userId: admin.user_id,
                email: admin.email,
                membershipStatus: admin.membership_status,
              };
            }),
          });
        }
        return organizations;
      }),

    listAudit: async (userId, limit) =>
      withUserTransaction(access, userId, async (transaction, normalizedUserId) => {
        if (!(await activeOperator(transaction, normalizedUserId))) return [];
        const result = await transaction.query(
          `SELECT
             audit.id::text AS id,
             audit.action,
             audit.reason,
             audit.actor_user_id::text AS actor_user_id,
             actor.email AS actor_email,
             audit.organization_id::text AS organization_id,
             organization.name AS organization_name,
             audit.target_user_id::text AS target_user_id,
             audit.request_id::text AS request_id,
             audit.correlation_id::text AS correlation_id,
             audit.result,
             audit.created_at
           FROM public.orgawork_platform_provisioning_audit AS audit
           JOIN public.orgawork_users AS actor
             ON actor.id = audit.actor_user_id
           LEFT JOIN public.orgawork_organizations AS organization
             ON organization.id = audit.organization_id
          ORDER BY audit.created_at DESC
          LIMIT $1`,
          [limit],
        );
        return result.rows.map((row) => {
          const value = row as {
            readonly id: string;
            readonly action: PlatformProvisioningAction;
            readonly reason: string;
            readonly actor_user_id: string;
            readonly actor_email: string;
            readonly organization_id: string | null;
            readonly organization_name: string | null;
            readonly target_user_id: string | null;
            readonly request_id: string;
            readonly correlation_id: string;
            readonly result: PlatformProvisioningResult;
            readonly created_at: unknown;
          };
          return {
            id: value.id,
            action: value.action,
            reason: value.reason,
            actorUserId: value.actor_user_id,
            actorEmail: value.actor_email,
            organizationId: value.organization_id,
            organizationName: value.organization_name,
            targetUserId: value.target_user_id,
            requestId: value.request_id,
            correlationId: value.correlation_id,
            result: value.result,
            createdAt: normalizeStoredTimestamp(value.created_at),
          };
        });
      }),

    createOrganization: async (input) =>
      withUserTransaction(access, input.actorUserId, async (transaction, actorUserId) => {
        if (!(await activeOperator(transaction, actorUserId))) {
          return { kind: 'forbidden' } as const;
        }

        const replay = await lookupIdempotency<{ readonly organization: PlatformOrganizationView }>(
          transaction,
          {
            actorUserId,
            operation: 'organization.create',
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: input.requestFingerprint,
          },
        );
        if (replay.kind === 'conflict') return { kind: 'idempotency_conflict' } as const;
        if (replay.kind === 'replay') {
          return { kind: 'success', result: replay.result, replayed: true } as const;
        }

        const organizationId = await setPlatformTarget(transaction, input.organizationId);
        await transaction.query(
          `INSERT INTO public.orgawork_organizations
             (id, name, created_at, updated_at, version)
           VALUES ($1, $2, $3, $3, 1)`,
          [organizationId, input.name, input.now],
        );

        const result = { organization: { id: organizationId, name: input.name } } as const;
        await insertAudit(transaction, {
          id: input.auditId,
          actorUserId,
          action: 'organization.create',
          reason: input.reason,
          organizationId,
          targetUserId: null,
          requestId: input.requestId,
          correlationId: input.correlationId,
          result: 'succeeded',
          now: input.now,
        });
        await storeIdempotency(transaction, {
          actorUserId,
          operation: 'organization.create',
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          result,
          requestId: input.requestId,
          correlationId: input.correlationId,
          now: input.now,
        });
        return { kind: 'success', result, replayed: false } as const;
      }),

    renameOrganization: async (input) =>
      withUserTransaction(access, input.actorUserId, async (transaction, actorUserId) => {
        if (!(await activeOperator(transaction, actorUserId))) {
          return { kind: 'forbidden' } as const;
        }
        const replay = await lookupIdempotency<{ readonly organization: PlatformOrganizationView }>(
          transaction,
          {
            actorUserId,
            operation: 'organization.rename',
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: input.requestFingerprint,
          },
        );
        if (replay.kind === 'conflict') return { kind: 'idempotency_conflict' } as const;
        if (replay.kind === 'replay') {
          return { kind: 'success', result: replay.result, replayed: true } as const;
        }

        const organizationId = await setPlatformTarget(transaction, input.organizationId);
        const updated = await transaction.query(
          `UPDATE public.orgawork_organizations
              SET name = $2,
                  updated_at = $3,
                  version = version + 1
            WHERE id = $1
          RETURNING id::text AS id, name`,
          [organizationId, input.name, input.now],
        );
        const row = updated.rows[0] as { readonly id: string; readonly name: string } | undefined;
        if (row === undefined) return { kind: 'organization_not_found' } as const;

        const result = { organization: { id: row.id, name: row.name } } as const;
        await insertAudit(transaction, {
          id: input.auditId,
          actorUserId,
          action: 'organization.rename',
          reason: input.reason,
          organizationId,
          targetUserId: null,
          requestId: input.requestId,
          correlationId: input.correlationId,
          result: 'succeeded',
          now: input.now,
        });
        await storeIdempotency(transaction, {
          actorUserId,
          operation: 'organization.rename',
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          result,
          requestId: input.requestId,
          correlationId: input.correlationId,
          now: input.now,
        });
        return { kind: 'success', result, replayed: false } as const;
      }),

    provisionInitialAdmin: async (input) =>
      withUserTransaction(access, input.actorUserId, async (transaction, actorUserId) => {
        if (!(await activeOperator(transaction, actorUserId))) {
          return { kind: 'forbidden' } as const;
        }

        const replay = await lookupIdempotency<{
          readonly organizationId: string;
          readonly userId: string;
          readonly email: string;
          readonly membershipId: string;
          readonly role: 'organization_admin';
          readonly accountSetupRequired: boolean;
        }>(transaction, {
          actorUserId,
          operation: 'organization_admin.provision',
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
        });
        if (replay.kind === 'conflict') return { kind: 'idempotency_conflict' } as const;
        if (replay.kind === 'replay') {
          return { kind: 'success', result: replay.result, replayed: true } as const;
        }

        const organizationId = await setPlatformTarget(transaction, input.organizationId);
        const organization = await transaction.query(
          `SELECT id FROM public.orgawork_organizations WHERE id = $1`,
          [organizationId],
        );
        if ((organization.rowCount ?? 0) !== 1) {
          return { kind: 'organization_not_found' } as const;
        }

        const existingUser = await transaction.query(
          `SELECT id::text AS id, status
             FROM public.orgawork_users
            WHERE email = $1
            LIMIT 1`,
          [input.email],
        );
        const userRow = existingUser.rows[0] as
          { readonly id: string; readonly status: 'pending' | 'active' | 'disabled' } | undefined;
        if (userRow !== undefined && userRow.status !== 'active') {
          return { kind: 'user_state_conflict' } as const;
        }

        const userId = userRow?.id ?? input.candidateUserId;
        if (userRow === undefined) {
          await transaction.query(
            `INSERT INTO public.orgawork_users
               (id, email, status, created_at, updated_at, version)
             VALUES ($1, $2, 'active', $3, $3, 1)`,
            [userId, input.email, input.now],
          );
        }

        const credential = await transaction.query(
          `SELECT 1
             FROM public.orgawork_password_credentials
            WHERE user_id = $1
            LIMIT 1`,
          [userId],
        );
        const accountSetupRequired = (credential.rowCount ?? 0) === 0;

        const membershipResult = await transaction.query(
          `SELECT id::text AS id, status
             FROM public.orgawork_memberships
            WHERE organization_id = $1
              AND user_id = $2
            LIMIT 1`,
          [organizationId, userId],
        );
        const membershipRow = membershipResult.rows[0] as
          | {
              readonly id: string;
              readonly status: 'invited' | 'active' | 'suspended' | 'revoked';
            }
          | undefined;
        if (membershipRow !== undefined && membershipRow.status !== 'active') {
          return { kind: 'membership_state_conflict' } as const;
        }

        const membershipId = membershipRow?.id ?? input.candidateMembershipId;
        if (membershipRow === undefined) {
          await transaction.query(
            `INSERT INTO public.orgawork_memberships
               (id, user_id, organization_id, status, created_at, updated_at, version)
             VALUES ($1, $2, $3, 'active', $4, $4, 1)`,
            [membershipId, userId, organizationId, input.now],
          );
        }

        await transaction.query(
          `DELETE FROM public.orgawork_membership_roles WHERE membership_id = $1`,
          [membershipId],
        );
        await transaction.query(
          `INSERT INTO public.orgawork_membership_roles
             (membership_id, role_key, created_at)
           VALUES ($1, 'organization_admin', $2)`,
          [membershipId, input.now],
        );

        const result = {
          organizationId,
          userId,
          email: input.email,
          membershipId,
          role: 'organization_admin' as const,
          accountSetupRequired,
        };
        await insertAudit(transaction, {
          id: input.auditId,
          actorUserId,
          action: 'organization_admin.provision',
          reason: input.reason,
          organizationId,
          targetUserId: userId,
          requestId: input.requestId,
          correlationId: input.correlationId,
          result: 'succeeded',
          now: input.now,
        });
        await storeIdempotency(transaction, {
          actorUserId,
          operation: 'organization_admin.provision',
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          result,
          requestId: input.requestId,
          correlationId: input.correlationId,
          now: input.now,
        });
        return { kind: 'success', result, replayed: false } as const;
      }),

    revokeOrganizationAdmin: async (input) =>
      withUserTransaction(access, input.actorUserId, async (transaction, actorUserId) => {
        if (!(await activeOperator(transaction, actorUserId))) {
          return { kind: 'forbidden' } as const;
        }
        const replay = await lookupIdempotency<{
          readonly organizationId: string;
          readonly userId: string;
          readonly email: string;
          readonly membershipId: string;
        }>(transaction, {
          actorUserId,
          operation: 'organization_admin.revoke',
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
        });
        if (replay.kind === 'conflict') return { kind: 'idempotency_conflict' } as const;
        if (replay.kind === 'replay') {
          return { kind: 'success', result: replay.result, replayed: true } as const;
        }

        const organizationId = await setPlatformTarget(transaction, input.organizationId);
        const target = await transaction.query(
          `SELECT
             membership.id::text AS membership_id,
             membership.user_id::text AS user_id,
             user_row.email,
             membership.status
           FROM public.orgawork_memberships AS membership
           JOIN public.orgawork_membership_roles AS membership_role
             ON membership_role.membership_id = membership.id
            AND membership_role.role_key = 'organization_admin'
           JOIN public.orgawork_users AS user_row
             ON user_row.id = membership.user_id
          WHERE membership.organization_id = $1
            AND membership.id = $2
            AND membership.status IN ('active', 'suspended')`,
          [organizationId, input.membershipId],
        );
        const targetRow = target.rows[0] as
          | {
              readonly membership_id: string;
              readonly user_id: string;
              readonly email: string;
              readonly status: 'active' | 'suspended';
            }
          | undefined;
        if (targetRow === undefined) return { kind: 'admin_not_found' } as const;

        const otherAdmins = await transaction.query(
          `SELECT count(*)::int AS count
             FROM public.orgawork_memberships AS membership
             JOIN public.orgawork_membership_roles AS membership_role
               ON membership_role.membership_id = membership.id
              AND membership_role.role_key = 'organization_admin'
            WHERE membership.organization_id = $1
              AND membership.id <> $2
              AND membership.status = 'active'`,
          [organizationId, input.membershipId],
        );
        const countRow = otherAdmins.rows[0] as { readonly count: number } | undefined;
        const otherAdminCount = Number(countRow?.count ?? 0);
        if (!Number.isInteger(otherAdminCount) || otherAdminCount < 1) {
          return { kind: 'last_admin_conflict' } as const;
        }

        await transaction.query(
          `UPDATE public.orgawork_memberships
              SET status = 'revoked',
                  updated_at = $3,
                  version = version + 1
            WHERE organization_id = $1
              AND id = $2`,
          [organizationId, input.membershipId, input.now],
        );
        await transaction.query(
          `DELETE FROM public.orgawork_membership_roles
            WHERE membership_id = $1
              AND role_key = 'organization_admin'`,
          [input.membershipId],
        );

        const result = {
          organizationId,
          userId: targetRow.user_id,
          email: targetRow.email,
          membershipId: targetRow.membership_id,
        };
        await insertAudit(transaction, {
          id: input.auditId,
          actorUserId,
          action: 'organization_admin.revoke',
          reason: input.reason,
          organizationId,
          targetUserId: targetRow.user_id,
          requestId: input.requestId,
          correlationId: input.correlationId,
          result: 'succeeded',
          now: input.now,
        });
        await storeIdempotency(transaction, {
          actorUserId,
          operation: 'organization_admin.revoke',
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          result,
          requestId: input.requestId,
          correlationId: input.correlationId,
          now: input.now,
        });
        return { kind: 'success', result, replayed: false } as const;
      }),
  };
}

function commandError<Result>(
  outcome: Exclude<CommandOutcome<Result>, { readonly kind: 'success' }>,
): never {
  if (outcome.kind === 'forbidden') {
    throw new PlatformControlPlaneError(
      'PLATFORM_AUTHORITY_REQUIRED',
      'دسترسی اپراتور سکو برای این عملیات لازم است.',
    );
  }
  if (outcome.kind === 'idempotency_conflict') {
    throw new PlatformControlPlaneError(
      'PLATFORM_IDEMPOTENCY_CONFLICT',
      'کلید عدم تکرار قبلاً برای درخواست متفاوتی استفاده شده است.',
    );
  }
  if (outcome.kind === 'organization_not_found') {
    throw new PlatformControlPlaneError('PLATFORM_ORGANIZATION_NOT_FOUND', 'سازمان هدف پیدا نشد.');
  }
  if (outcome.kind === 'user_state_conflict') {
    throw new PlatformControlPlaneError(
      'PLATFORM_TARGET_USER_STATE_CONFLICT',
      'وضعیت حساب کاربر هدف برای این عملیات مناسب نیست.',
    );
  }
  if (outcome.kind === 'membership_state_conflict') {
    throw new PlatformControlPlaneError(
      'PLATFORM_TARGET_MEMBERSHIP_STATE_CONFLICT',
      'وضعیت عضویت کاربر هدف برای این عملیات مناسب نیست.',
    );
  }
  if (outcome.kind === 'admin_not_found') {
    throw new PlatformControlPlaneError(
      'PLATFORM_ADMIN_NOT_FOUND',
      'مدیر سازمان موردنظر پیدا نشد یا قبلاً دسترسی او لغو شده است.',
    );
  }
  throw new PlatformControlPlaneError(
    'PLATFORM_LAST_ADMIN_PROTECTED',
    'آخرین مدیر فعال سازمان را نمی‌توان حذف کرد. ابتدا مدیر دیگری تعیین کنید.',
  );
}

export interface PlatformControlPlaneService {
  getOperator(userId: string): Promise<PlatformOperatorView>;
  listOrganizations(userId: string): Promise<readonly PlatformOrganizationSummary[]>;
  listAudit(userId: string, limit?: number): Promise<readonly PlatformProvisioningAuditView[]>;
  createOrganization(input: {
    readonly actorUserId: string;
    readonly name: string;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
    readonly correlationId: string;
  }): Promise<CreatePlatformOrganizationResult>;
  renameOrganization(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly name: string;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
    readonly correlationId: string;
  }): Promise<RenamePlatformOrganizationResult>;
  provisionInitialAdmin(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly email: string;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
    readonly correlationId: string;
  }): Promise<ProvisionInitialOrganizationAdminResult>;
  revokeOrganizationAdmin(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly membershipId: string;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
    readonly correlationId: string;
  }): Promise<RevokeOrganizationAdminResult>;
}

export function createPlatformControlPlaneService(
  repository: PlatformControlPlaneRepository,
  options: {
    readonly now?: () => Date;
    readonly createId?: () => string;
  } = {},
): PlatformControlPlaneService {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;

  async function requireOperator(userId: string): Promise<PlatformOperatorView> {
    const operator = await repository.findOperator(userId);
    if (operator === undefined || operator.status !== 'active') {
      throw new PlatformControlPlaneError(
        'PLATFORM_AUTHORITY_REQUIRED',
        'دسترسی اپراتور سکو برای این حساب فعال نیست.',
      );
    }
    return { userId: operator.userId, email: operator.email, status: 'active' };
  }

  return {
    getOperator: requireOperator,

    listOrganizations: async (userId) => {
      await requireOperator(userId);
      return repository.listOrganizations(userId);
    },

    listAudit: async (userId, limit = 50) => {
      await requireOperator(userId);
      return repository.listAudit(userId, normalizeAuditLimit(limit));
    },

    createOrganization: async (input) => {
      const name = normalizeOrganizationName(input.name);
      const reason = normalizeReason(input.reason);
      const idempotencyKey = createIdempotencyKey(input.idempotencyKey);
      const requestId = createRequestId(input.requestId);
      const correlationId = createCorrelationId(input.correlationId);
      const outcome = await repository.createOrganization({
        actorUserId: input.actorUserId,
        organizationId: createId(),
        name,
        reason,
        idempotencyKey,
        requestFingerprint: fingerprint({ name, reason }),
        requestId,
        correlationId,
        auditId: createId(),
        now: now().toISOString(),
      });
      if (outcome.kind !== 'success') return commandError(outcome);
      return { ...outcome.result, replayed: outcome.replayed };
    },

    renameOrganization: async (input) => {
      const organizationId = normalizeOrganizationId(input.organizationId);
      const name = normalizeOrganizationName(input.name);
      const reason = normalizeReason(input.reason);
      const idempotencyKey = createIdempotencyKey(input.idempotencyKey);
      const requestId = createRequestId(input.requestId);
      const correlationId = createCorrelationId(input.correlationId);
      const outcome = await repository.renameOrganization({
        actorUserId: input.actorUserId,
        organizationId,
        name,
        reason,
        idempotencyKey,
        requestFingerprint: fingerprint({ organizationId, name, reason }),
        requestId,
        correlationId,
        auditId: createId(),
        now: now().toISOString(),
      });
      if (outcome.kind !== 'success') return commandError(outcome);
      return { ...outcome.result, replayed: outcome.replayed };
    },

    provisionInitialAdmin: async (input) => {
      const organizationId = normalizeOrganizationId(input.organizationId);
      const email = normalizeEmail(input.email);
      const reason = normalizeReason(input.reason);
      const idempotencyKey = createIdempotencyKey(input.idempotencyKey);
      const requestId = createRequestId(input.requestId);
      const correlationId = createCorrelationId(input.correlationId);
      const outcome = await repository.provisionInitialAdmin({
        actorUserId: input.actorUserId,
        organizationId,
        email,
        candidateUserId: createId(),
        candidateMembershipId: createId(),
        reason,
        idempotencyKey,
        requestFingerprint: fingerprint({ organizationId, email, reason }),
        requestId,
        correlationId,
        auditId: createId(),
        now: now().toISOString(),
      });
      if (outcome.kind !== 'success') return commandError(outcome);
      return { ...outcome.result, replayed: outcome.replayed };
    },

    revokeOrganizationAdmin: async (input) => {
      const organizationId = normalizeOrganizationId(input.organizationId);
      const membershipId = normalizeUuid(input.membershipId, 'شناسه عضویت مدیر');
      const reason = normalizeReason(input.reason);
      const idempotencyKey = createIdempotencyKey(input.idempotencyKey);
      const requestId = createRequestId(input.requestId);
      const correlationId = createCorrelationId(input.correlationId);
      const outcome = await repository.revokeOrganizationAdmin({
        actorUserId: input.actorUserId,
        organizationId,
        membershipId,
        reason,
        idempotencyKey,
        requestFingerprint: fingerprint({ organizationId, membershipId, reason }),
        requestId,
        correlationId,
        auditId: createId(),
        now: now().toISOString(),
      });
      if (outcome.kind !== 'success') return commandError(outcome);
      return { ...outcome.result, replayed: outcome.replayed };
    },
  };
}
