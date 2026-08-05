import {
  createCaseAssignmentId,
  createCaseId,
  createOrganizationId,
  createUserId,
  createUtcTimestamp,
  type Brand,
  type CaseAssignmentId,
  type CaseId,
  type Continuation,
  type CurrentWorkReference,
  type OrganizationId,
  type OutcomeAndContinuation,
  type UserId,
  type UtcTimestamp,
} from '@workspace/contracts';

export const caseStatuses = ['open', 'resolved', 'closed', 'cancelled'] as const;
export type CaseStatus = (typeof caseStatuses)[number];
export type CaseTitle = Brand<string, 'CaseTitle'>;

export const caseDomainErrorCodes = [
  'INVALID_CASE_TITLE',
  'INVALID_CASE_TRANSITION',
  'CASE_PRIMARY_ASSIGNMENT_REQUIRED',
  'CASE_CURRENT_WORK_REQUIRED',
  'CASE_OUTCOME_REQUIRED',
  'CASE_CANCELLATION_REASON_REQUIRED',
] as const;
export type CaseDomainErrorCode = (typeof caseDomainErrorCodes)[number];

export class CaseDomainError extends Error {
  override readonly name = 'CaseDomainError';

  constructor(
    readonly code: CaseDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface FollowUpCase {
  readonly id: CaseId;
  readonly organizationId: OrganizationId;
  readonly title: CaseTitle;
  readonly status: CaseStatus;
  readonly createdByUserId: UserId;
  readonly subjectUserId: UserId;
  readonly primaryAssignmentId: CaseAssignmentId | null;
  readonly currentWork: CurrentWorkReference | null;
  readonly lastOutcome: string | null;
  readonly cancellationReason: string | null;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export const caseDomainEventNames = [
  'case.created',
  'case.primary-assignment-changed',
  'case.current-work-changed',
  'case.resolved',
  'case.closed',
  'case.reopened',
  'case.cancelled',
] as const;
export type CaseDomainEventName = (typeof caseDomainEventNames)[number];

function normalizeRequiredText(value: string, code: CaseDomainErrorCode, message: string): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (normalized === '') {
    throw new CaseDomainError(code, message);
  }

  return normalized;
}

function nextVersion(version: number): number {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError('نسخه پرونده معتبر نیست.');
  }

  return version + 1;
}

function assertOpen(value: FollowUpCase): void {
  if (value.status !== 'open') {
    throw new CaseDomainError('INVALID_CASE_TRANSITION', 'این تغییر فقط برای پرونده باز مجاز است.');
  }
}

export function normalizeCaseTitle(value: string): CaseTitle {
  return normalizeRequiredText(
    value,
    'INVALID_CASE_TITLE',
    'عنوان پرونده نباید خالی باشد.',
  ) as CaseTitle;
}

export function assertFollowUpCaseInvariant(value: FollowUpCase): void {
  if (value.status === 'open') {
    if (value.primaryAssignmentId === null) {
      throw new CaseDomainError(
        'CASE_PRIMARY_ASSIGNMENT_REQUIRED',
        'پرونده باز باید یک مسئولیت اصلی فعال داشته باشد.',
      );
    }

    if (value.currentWork === null) {
      throw new CaseDomainError(
        'CASE_CURRENT_WORK_REQUIRED',
        'پرونده باز باید یک کار جاری اصلی داشته باشد.',
      );
    }
  } else if (value.currentWork !== null) {
    throw new CaseDomainError(
      'INVALID_CASE_TRANSITION',
      'پرونده غیرفعال نمی‌تواند کار جاری اصلی داشته باشد.',
    );
  }
}

export function createFollowUpCase(input: {
  readonly id: string;
  readonly organizationId: string;
  readonly title: string;
  readonly createdByUserId: string;
  readonly subjectUserId?: string;
  readonly primaryAssignmentId: string;
  readonly currentWork: CurrentWorkReference;
  readonly now: string | Date;
}): FollowUpCase {
  const now = createUtcTimestamp(input.now);
  const value: FollowUpCase = {
    id: createCaseId(input.id),
    organizationId: createOrganizationId(input.organizationId),
    title: normalizeCaseTitle(input.title),
    status: 'open',
    createdByUserId: createUserId(input.createdByUserId),
    subjectUserId: createUserId(input.subjectUserId ?? input.createdByUserId),
    primaryAssignmentId: createCaseAssignmentId(input.primaryAssignmentId),
    currentWork: input.currentWork,
    lastOutcome: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  assertFollowUpCaseInvariant(value);
  return value;
}

export function changePrimaryAssignment(
  value: FollowUpCase,
  assignmentId: string,
  now: string | Date,
): FollowUpCase {
  assertOpen(value);
  const nextAssignmentId = createCaseAssignmentId(assignmentId);

  if (nextAssignmentId === value.primaryAssignmentId) {
    return value;
  }

  return {
    ...value,
    primaryAssignmentId: nextAssignmentId,
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(value.version),
  };
}

export function changeCurrentWork(
  value: FollowUpCase,
  currentWork: CurrentWorkReference,
  now: string | Date,
): FollowUpCase {
  assertOpen(value);

  if (value.currentWork?.kind === currentWork.kind && value.currentWork.id === currentWork.id) {
    return value;
  }

  return {
    ...value,
    currentWork,
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(value.version),
  };
}

export function applyOutcomeAndContinuation(
  value: FollowUpCase,
  completion: OutcomeAndContinuation,
  now: string | Date,
): FollowUpCase {
  assertOpen(value);
  const outcome = normalizeRequiredText(
    completion.outcome,
    'CASE_OUTCOME_REQUIRED',
    'ثبت نتیجه بدون متن نتیجه مجاز نیست.',
  );
  const timestamp = createUtcTimestamp(now);
  const common = {
    ...value,
    lastOutcome: outcome,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };

  if (completion.continuation.kind === 'resolved') {
    return {
      ...common,
      status: 'resolved',
      primaryAssignmentId: null,
      currentWork: null,
    };
  }

  if (completion.continuation.kind === 'cancelled') {
    const reason = normalizeRequiredText(
      completion.continuation.reason,
      'CASE_CANCELLATION_REASON_REQUIRED',
      'لغو پرونده به دلیل روشن نیاز دارد.',
    );

    return {
      ...common,
      status: 'cancelled',
      primaryAssignmentId: null,
      currentWork: null,
      cancellationReason: reason,
    };
  }

  return {
    ...common,
    currentWork: completion.continuation,
  };
}

export function closeCase(value: FollowUpCase, now: string | Date): FollowUpCase {
  if (value.status !== 'resolved') {
    throw new CaseDomainError('INVALID_CASE_TRANSITION', 'فقط پرونده حل‌شده را می‌توان بست.');
  }

  return {
    ...value,
    status: 'closed',
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(value.version),
  };
}

export function reopenCase(
  value: FollowUpCase,
  input: {
    readonly primaryAssignmentId: string;
    readonly currentWork: CurrentWorkReference;
    readonly now: string | Date;
  },
): FollowUpCase {
  if (value.status !== 'resolved' && value.status !== 'closed') {
    throw new CaseDomainError(
      'INVALID_CASE_TRANSITION',
      'فقط پرونده حل‌شده یا بسته‌شده را می‌توان بازگشایی کرد.',
    );
  }

  const reopened: FollowUpCase = {
    ...value,
    status: 'open',
    primaryAssignmentId: createCaseAssignmentId(input.primaryAssignmentId),
    currentWork: input.currentWork,
    cancellationReason: null,
    updatedAt: createUtcTimestamp(input.now),
    version: nextVersion(value.version),
  };

  assertFollowUpCaseInvariant(reopened);
  return reopened;
}

export function continuationFromCurrentWork(currentWork: CurrentWorkReference): Continuation {
  return currentWork;
}
