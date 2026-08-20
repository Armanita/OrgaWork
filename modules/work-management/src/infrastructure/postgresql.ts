import { createHash, randomUUID } from 'node:crypto';

import { authorizeInTransaction } from '@workspace/access-control';
import { createIdempotencyKey } from '@workspace/contracts';
import {
  withOrganizationTransaction,
  type PostgreSqlAccess,
  type PostgreSqlQueryExecutor,
} from '@workspace/database';

import { planCreateOwnCase, type CreateOwnCaseCommand } from '../application/create-own-case.js';

export const workManagementErrorCodes = [
  'AUTHORIZATION_DENIED',
  'IDEMPOTENCY_CONFLICT',
  'IDEMPOTENCY_IN_PROGRESS',
] as const;

export type WorkManagementErrorCode = (typeof workManagementErrorCodes)[number];

export class WorkManagementError extends Error {
  override readonly name = 'WorkManagementError';

  constructor(
    readonly code: WorkManagementErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface CreateOwnCaseRequest {
  readonly userId: string;
  readonly organizationId: string;
  readonly idempotencyKey: string;
  readonly title: string;
  readonly description: string;
  readonly priority: 'low' | 'normal' | 'high';
  readonly dueAt?: string;
  readonly initialAction: {
    readonly title: string;
    readonly dueAt?: string;
  };
}

export interface CreateOwnCaseResult {
  readonly caseId: string;
  readonly title: string;
  readonly status: 'open';
  readonly priority: 'low' | 'normal' | 'high';
  readonly dueAt: string | null;
  readonly responsibilityId: string;
  readonly initialAction: {
    readonly id: string;
    readonly title: string;
    readonly status: 'pending';
    readonly dueAt: string | null;
  };
  readonly replayed: boolean;
}

export interface WorkManagementService {
  createOwnCase(input: CreateOwnCaseRequest): Promise<CreateOwnCaseResult>;
}

interface IdempotencyRow {
  readonly request_fingerprint: string;
  readonly state: 'in_progress' | 'completed';
  readonly result_snapshot: unknown;
}

type StoredCreateOwnCaseResult = Omit<CreateOwnCaseResult, 'replayed'>;

type TransactionOutcome =
  | { readonly kind: 'created'; readonly result: CreateOwnCaseResult }
  | { readonly kind: 'denied' }
  | { readonly kind: 'idempotency-conflict' }
  | { readonly kind: 'idempotency-in-progress' };

function requestFingerprint(input: CreateOwnCaseRequest): string {
  const canonical = JSON.stringify({
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    dueAt: input.dueAt ?? null,
    initialAction: {
      title: input.initialAction.title.trim(),
      dueAt: input.initialAction.dueAt ?? null,
    },
  });

  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function resultSnapshot(result: CreateOwnCaseResult): StoredCreateOwnCaseResult {
  return {
    caseId: result.caseId,
    title: result.title,
    status: result.status,
    priority: result.priority,
    dueAt: result.dueAt,
    responsibilityId: result.responsibilityId,
    initialAction: result.initialAction,
  };
}

function readStoredResult(value: unknown): StoredCreateOwnCaseResult {
  if (value === null || typeof value !== 'object') {
    throw new TypeError('ذخیره نتیجه idempotency معتبر نیست.');
  }

  const candidate = value as Partial<StoredCreateOwnCaseResult>;
  if (
    typeof candidate.caseId !== 'string' ||
    typeof candidate.title !== 'string' ||
    candidate.status !== 'open' ||
    !['low', 'normal', 'high'].includes(String(candidate.priority)) ||
    typeof candidate.responsibilityId !== 'string' ||
    candidate.initialAction === undefined ||
    typeof candidate.initialAction.id !== 'string' ||
    typeof candidate.initialAction.title !== 'string' ||
    candidate.initialAction.status !== 'pending'
  ) {
    throw new TypeError('ذخیره نتیجه idempotency معتبر نیست.');
  }

  return candidate as StoredCreateOwnCaseResult;
}

async function insertPlan(
  transaction: PostgreSqlQueryExecutor,
  plan: ReturnType<typeof planCreateOwnCase>,
): Promise<void> {
  await transaction.query(
    `INSERT INTO public.orgawork_cases
      (
        id, organization_id, title, description, priority, due_at,
        created_by_membership_id, status, cancellation_reason,
        created_at, updated_at, version
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $9, 1)`,
    [
      plan.case.id,
      plan.case.organizationId,
      plan.case.title,
      plan.case.description,
      plan.case.priority,
      plan.case.dueAt,
      plan.case.createdByMembershipId,
      plan.case.status,
      plan.case.createdAt,
    ],
  );

  const target = plan.primaryResponsibility.target;
  await transaction.query(
    `INSERT INTO public.orgawork_case_responsibilities
      (
        id, organization_id, case_id, target_kind, target_membership_id, target_team_id,
        assigned_by_membership_id, status, acceptance_mode, role,
        accepted_by_membership_id, rejected_by_membership_id, rejection_reason,
        transferred_to_responsibility_id, accepted_at, ended_at,
        created_at, updated_at, version
      )
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, NULL, NULL, $12, NULL, $13, $13, 1)`,
    [
      plan.primaryResponsibility.id,
      plan.primaryResponsibility.organizationId,
      plan.primaryResponsibility.caseId,
      target.kind,
      target.kind === 'membership' ? target.membershipId : null,
      target.kind === 'team' ? target.teamId : null,
      plan.primaryResponsibility.assignedByMembershipId,
      plan.primaryResponsibility.status,
      plan.primaryResponsibility.acceptanceMode,
      plan.primaryResponsibility.role,
      plan.primaryResponsibility.acceptedByMembershipId,
      plan.primaryResponsibility.acceptedAt,
      plan.primaryResponsibility.createdAt,
    ],
  );

  const responsible = plan.initialAction.responsible;
  await transaction.query(
    `INSERT INTO public.orgawork_actions
      (
        id, organization_id, case_id, source_responsibility_id,
        responsible_kind, responsible_membership_id, responsible_team_id,
        created_by_membership_id, kind, parent_action_id, title, due_at, status,
        cancellation_reason, cancelled_by_membership_id,
        created_at, started_at, updated_at, version
      )
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11, $12, NULL, NULL, $13, NULL, $13, 1)`,
    [
      plan.initialAction.id,
      plan.initialAction.organizationId,
      plan.initialAction.caseId,
      plan.initialAction.sourceResponsibilityId,
      responsible.kind,
      responsible.kind === 'membership' ? responsible.membershipId : null,
      responsible.kind === 'team' ? responsible.teamId : null,
      plan.initialAction.createdByMembershipId,
      plan.initialAction.kind,
      plan.initialAction.title,
      plan.initialAction.dueAt,
      plan.initialAction.status,
      plan.initialAction.createdAt,
    ],
  );

  await transaction.query(
    `INSERT INTO public.orgawork_case_current_work
      (organization_id, case_id, kind, action_id, responsibility_id, started_at, ended_at)
     VALUES ($1, $2, 'action', $3, NULL, $4, NULL)`,
    [plan.case.organizationId, plan.case.id, plan.initialAction.id, plan.case.createdAt],
  );
}

export function createPostgreSqlWorkManagementService(
  access: PostgreSqlAccess,
  dependencies: {
    readonly now?: () => Date;
    readonly randomId?: () => string;
  } = {},
): WorkManagementService {
  const now = dependencies.now ?? (() => new Date());
  const randomId = dependencies.randomId ?? randomUUID;

  return {
    createOwnCase: async (input): Promise<CreateOwnCaseResult> => {
      const idempotencyKey = createIdempotencyKey(input.idempotencyKey);
      const fingerprint = requestFingerprint(input);
      const timestamp = now().toISOString();

      const outcome = await withOrganizationTransaction(
        access,
        input.organizationId,
        async (transaction, organizationId): Promise<TransactionOutcome> => {
          const authorization = await authorizeInTransaction(transaction, {
            userId: input.userId,
            organizationId,
            permission: 'case.create_self',
            now: timestamp,
          });

          if (!authorization.decision.allowed || authorization.membershipId === undefined) {
            return { kind: 'denied' };
          }

          const existing = await transaction.query<IdempotencyRow>(
            `SELECT request_fingerprint, state, result_snapshot
               FROM public.orgawork_idempotency_records
              WHERE organization_id = $1
                AND operation = 'case.create_self'
                AND idempotency_key = $2
              FOR UPDATE`,
            [organizationId, idempotencyKey],
          );

          const prior = existing.rows[0];
          if (prior !== undefined) {
            if (prior.request_fingerprint !== fingerprint) {
              return { kind: 'idempotency-conflict' };
            }
            if (prior.state !== 'completed') {
              return { kind: 'idempotency-in-progress' };
            }

            return {
              kind: 'created',
              result: {
                ...readStoredResult(prior.result_snapshot),
                replayed: true,
              },
            };
          }

          await transaction.query(
            `INSERT INTO public.orgawork_idempotency_records
              (
                organization_id, operation, idempotency_key, request_fingerprint,
                request_id, correlation_id, state, resource_id, response_status,
                result_snapshot, created_at, completed_at
              )
             VALUES
              ($1, 'case.create_self', $2, $3, $4, $5, 'in_progress', NULL, NULL, NULL, $6, NULL)`,
            [organizationId, idempotencyKey, fingerprint, randomId(), randomId(), timestamp],
          );

          const command: CreateOwnCaseCommand = {
            organizationId,
            actorMembershipId: authorization.membershipId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            ...(input.dueAt === undefined ? {} : { dueAt: input.dueAt }),
            initialAction: {
              title: input.initialAction.title,
              ...(input.initialAction.dueAt === undefined
                ? {}
                : { dueAt: input.initialAction.dueAt }),
            },
          };

          const plan = planCreateOwnCase(command, {
            identity: {
              caseId: randomId(),
              responsibilityId: randomId(),
              actionId: randomId(),
            },
            now: timestamp,
          });

          await insertPlan(transaction, plan);

          const result: CreateOwnCaseResult = {
            caseId: plan.case.id,
            title: plan.case.title,
            status: 'open',
            priority: plan.case.priority,
            dueAt: plan.case.dueAt,
            responsibilityId: plan.primaryResponsibility.id,
            initialAction: {
              id: plan.initialAction.id,
              title: plan.initialAction.title,
              status: 'pending',
              dueAt: plan.initialAction.dueAt,
            },
            replayed: false,
          };

          await transaction.query(
            `UPDATE public.orgawork_idempotency_records
                SET state = 'completed',
                    resource_id = $3,
                    response_status = 201,
                    result_snapshot = $4::jsonb,
                    completed_at = $5
              WHERE organization_id = $1
                AND operation = 'case.create_self'
                AND idempotency_key = $2`,
            [
              organizationId,
              idempotencyKey,
              result.caseId,
              JSON.stringify(resultSnapshot(result)),
              timestamp,
            ],
          );

          return { kind: 'created', result };
        },
      );

      if (outcome.kind === 'denied') {
        throw new WorkManagementError('AUTHORIZATION_DENIED', 'دسترسی ایجاد پرونده وجود ندارد.');
      }
      if (outcome.kind === 'idempotency-conflict') {
        throw new WorkManagementError(
          'IDEMPOTENCY_CONFLICT',
          'این کلید عدم تکرار قبلاً برای درخواست دیگری استفاده شده است.',
        );
      }
      if (outcome.kind === 'idempotency-in-progress') {
        throw new WorkManagementError(
          'IDEMPOTENCY_IN_PROGRESS',
          'درخواست مشابه هنوز در حال پردازش است.',
        );
      }

      return outcome.result;
    },
  };
}
