import {
  createActionItemId,
  createCaseAssignmentId,
  createCaseId,
  createOrganizationId,
  createUtcTimestamp,
  type ActionItemId,
  type Brand,
  type CaseAssignmentId,
  type CaseId,
  type Continuation,
  type OrganizationId,
  type OutcomeAndContinuation,
  type UtcTimestamp,
} from '@workspace/contracts';

export const actionStatuses = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type ActionStatus = (typeof actionStatuses)[number];
export const actionKinds = ['primary', 'secondary'] as const;
export type ActionKind = (typeof actionKinds)[number];
export type ActionTitle = Brand<string, 'ActionTitle'>;

export const actionDomainErrorCodes = [
  'INVALID_ACTION_TITLE',
  'INVALID_ACTION_TRANSITION',
  'INVALID_ACTION_HIERARCHY',
  'ACTION_OUTCOME_REQUIRED',
  'ACTION_CONTINUATION_REQUIRED',
  'ACTION_CANCELLATION_REASON_REQUIRED',
  'MULTIPLE_ACTIVE_PRIMARY_ACTIONS',
] as const;
export type ActionDomainErrorCode = (typeof actionDomainErrorCodes)[number];

export class ActionDomainError extends Error {
  override readonly name = 'ActionDomainError';

  constructor(
    readonly code: ActionDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface ActionCompletion {
  readonly outcome: string;
  readonly continuation: Continuation;
  readonly completedAt: UtcTimestamp;
}

export interface ActionItem {
  readonly id: ActionItemId;
  readonly caseId: CaseId;
  readonly organizationId: OrganizationId;
  readonly assignmentId: CaseAssignmentId;
  readonly kind: ActionKind;
  readonly parentActionId: ActionItemId | null;
  readonly title: ActionTitle;
  readonly status: ActionStatus;
  readonly completion: ActionCompletion | null;
  readonly cancellationReason: string | null;
  readonly createdAt: UtcTimestamp;
  readonly startedAt: UtcTimestamp | null;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export const actionDomainEventNames = [
  'action.created',
  'action.started',
  'action.completed',
  'action.cancelled',
] as const;
export type ActionDomainEventName = (typeof actionDomainEventNames)[number];

function normalizeRequiredText(
  value: string,
  code: ActionDomainErrorCode,
  message: string,
): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (normalized === '') {
    throw new ActionDomainError(code, message);
  }

  return normalized;
}

function nextVersion(version: number): number {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError('نسخه اقدام معتبر نیست.');
  }

  return version + 1;
}

export function createActionItem(input: {
  readonly id: string;
  readonly caseId: string;
  readonly organizationId: string;
  readonly assignmentId: string;
  readonly kind: ActionKind;
  readonly parentActionId?: string;
  readonly title: string;
  readonly now: string | Date;
}): ActionItem {
  if (input.kind === 'primary' && input.parentActionId !== undefined) {
    throw new ActionDomainError(
      'INVALID_ACTION_HIERARCHY',
      'اقدام اصلی نمی‌تواند اقدام والد داشته باشد.',
    );
  }

  if (input.kind === 'secondary' && input.parentActionId === undefined) {
    throw new ActionDomainError(
      'INVALID_ACTION_HIERARCHY',
      'اقدام فرعی باید به اقدام والد متصل باشد.',
    );
  }

  const now = createUtcTimestamp(input.now);

  return {
    id: createActionItemId(input.id),
    caseId: createCaseId(input.caseId),
    organizationId: createOrganizationId(input.organizationId),
    assignmentId: createCaseAssignmentId(input.assignmentId),
    kind: input.kind,
    parentActionId:
      input.parentActionId === undefined ? null : createActionItemId(input.parentActionId),
    title: normalizeRequiredText(
      input.title,
      'INVALID_ACTION_TITLE',
      'عنوان اقدام نباید خالی باشد.',
    ) as ActionTitle,
    status: 'pending',
    completion: null,
    cancellationReason: null,
    createdAt: now,
    startedAt: null,
    updatedAt: now,
    version: 1,
  };
}

export function startAction(value: ActionItem, now: string | Date): ActionItem {
  if (value.status !== 'pending') {
    throw new ActionDomainError(
      'INVALID_ACTION_TRANSITION',
      'فقط اقدام در انتظار را می‌توان آغاز کرد.',
    );
  }

  const timestamp = createUtcTimestamp(now);

  return {
    ...value,
    status: 'in_progress',
    startedAt: timestamp,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function completeAction(
  value: ActionItem,
  completion: OutcomeAndContinuation,
  now: string | Date,
): ActionItem {
  if (value.status !== 'in_progress') {
    throw new ActionDomainError(
      'INVALID_ACTION_TRANSITION',
      'فقط اقدام آغازشده را می‌توان تکمیل کرد.',
    );
  }

  if (completion.continuation === undefined) {
    throw new ActionDomainError(
      'ACTION_CONTINUATION_REQUIRED',
      'تکمیل اقدام بدون ادامه معتبر مجاز نیست.',
    );
  }

  const timestamp = createUtcTimestamp(now);

  return {
    ...value,
    status: 'completed',
    completion: {
      outcome: normalizeRequiredText(
        completion.outcome,
        'ACTION_OUTCOME_REQUIRED',
        'تکمیل اقدام بدون نتیجه مجاز نیست.',
      ),
      continuation: completion.continuation,
      completedAt: timestamp,
    },
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function cancelAction(value: ActionItem, reason: string, now: string | Date): ActionItem {
  if (value.status !== 'pending' && value.status !== 'in_progress') {
    throw new ActionDomainError(
      'INVALID_ACTION_TRANSITION',
      'اقدام پایان‌یافته را نمی‌توان لغو کرد.',
    );
  }

  return {
    ...value,
    status: 'cancelled',
    cancellationReason: normalizeRequiredText(
      reason,
      'ACTION_CANCELLATION_REASON_REQUIRED',
      'لغو اقدام به دلیل روشن نیاز دارد.',
    ),
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(value.version),
  };
}

export function isActiveAction(value: ActionItem): boolean {
  return value.status === 'pending' || value.status === 'in_progress';
}

export function assertAtMostOneActivePrimaryAction(actions: readonly ActionItem[]): void {
  const seen = new Set<string>();

  for (const action of actions) {
    if (action.kind !== 'primary' || !isActiveAction(action)) {
      continue;
    }

    const key = `${action.organizationId}:${action.caseId}`;

    if (seen.has(key)) {
      throw new ActionDomainError(
        'MULTIPLE_ACTIVE_PRIMARY_ACTIONS',
        'هر پرونده فقط یک اقدام اصلی فعال می‌تواند داشته باشد.',
      );
    }

    seen.add(key);
  }
}
