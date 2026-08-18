import {
  createCaseId,
  createCaseResponsibilityId,
  createMembershipId,
  createOrganizationId,
  createUtcTimestamp,
  type Brand,
  type CaseCurrentWorkReference,
  type CaseId,
  type CaseResponsibilityId,
  type MembershipId,
  type OrganizationId,
  type UtcTimestamp,
} from '@workspace/contracts';

export const caseStatuses = ['open', 'resolved', 'closed', 'cancelled'] as const;
export type CaseStatus = (typeof caseStatuses)[number];

export const casePriorities = ['low', 'normal', 'high'] as const;
export type CasePriority = (typeof casePriorities)[number];

export type CaseTitle = Brand<string, 'CaseTitle'>;
export type CaseDescription = Brand<string, 'CaseDescription'>;

export const caseDomainErrorCodes = [
  'INVALID_CASE_TITLE',
  'INVALID_CASE_DESCRIPTION',
  'INVALID_CASE_PRIORITY',
  'INVALID_CASE_TRANSITION',
  'CASE_PRIMARY_RESPONSIBILITY_REQUIRED',
  'CASE_CURRENT_WORK_REQUIRED',
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
  readonly description: CaseDescription;
  readonly priority: CasePriority;
  readonly dueAt: UtcTimestamp | null;
  readonly status: CaseStatus;
  readonly createdByMembershipId: MembershipId;
  readonly primaryResponsibilityId: CaseResponsibilityId | null;
  readonly currentWork: CaseCurrentWorkReference | null;
  readonly cancellationReason: string | null;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export const caseDomainEventNames = [
  'case.created',
  'case.primary-responsibility-changed',
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

export function normalizeCaseDescription(value: string): CaseDescription {
  return normalizeRequiredText(
    value,
    'INVALID_CASE_DESCRIPTION',
    'شرح پرونده نباید خالی باشد.',
  ) as CaseDescription;
}

export function normalizeCasePriority(value: string): CasePriority {
  if (!casePriorities.includes(value as CasePriority)) {
    throw new CaseDomainError('INVALID_CASE_PRIORITY', 'اولویت پرونده معتبر نیست.');
  }
  return value as CasePriority;
}

export function assertFollowUpCaseInvariant(value: FollowUpCase): void {
  if (value.status === 'open') {
    if (value.primaryResponsibilityId === null) {
      throw new CaseDomainError(
        'CASE_PRIMARY_RESPONSIBILITY_REQUIRED',
        'پرونده باز باید یک مسئولیت اصلی فعال داشته باشد.',
      );
    }
    if (value.currentWork === null) {
      throw new CaseDomainError(
        'CASE_CURRENT_WORK_REQUIRED',
        'پرونده باز باید یک کار جاری اصلی داشته باشد.',
      );
    }
    return;
  }

  if (value.primaryResponsibilityId !== null || value.currentWork !== null) {
    throw new CaseDomainError(
      'INVALID_CASE_TRANSITION',
      'پرونده غیرفعال نمی‌تواند مسئولیت اصلی یا کار جاری فعال داشته باشد.',
    );
  }
}

export function createFollowUpCase(input: {
  readonly id: string;
  readonly organizationId: string;
  readonly title: string;
  readonly description: string;
  readonly priority: string;
  readonly dueAt?: string | Date;
  readonly createdByMembershipId: string;
  readonly primaryResponsibilityId: string;
  readonly currentWork: CaseCurrentWorkReference;
  readonly now: string | Date;
}): FollowUpCase {
  const now = createUtcTimestamp(input.now);
  const value: FollowUpCase = {
    id: createCaseId(input.id),
    organizationId: createOrganizationId(input.organizationId),
    title: normalizeCaseTitle(input.title),
    description: normalizeCaseDescription(input.description),
    priority: normalizeCasePriority(input.priority),
    dueAt: input.dueAt === undefined ? null : createUtcTimestamp(input.dueAt),
    status: 'open',
    createdByMembershipId: createMembershipId(input.createdByMembershipId),
    primaryResponsibilityId: createCaseResponsibilityId(input.primaryResponsibilityId),
    currentWork: input.currentWork,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  assertFollowUpCaseInvariant(value);
  return value;
}

export function changePrimaryResponsibility(
  value: FollowUpCase,
  responsibilityId: string,
  now: string | Date,
): FollowUpCase {
  assertOpen(value);
  const nextResponsibilityId = createCaseResponsibilityId(responsibilityId);
  if (nextResponsibilityId === value.primaryResponsibilityId) {
    return value;
  }
  return {
    ...value,
    primaryResponsibilityId: nextResponsibilityId,
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(value.version),
  };
}

export function changeCurrentWork(
  value: FollowUpCase,
  currentWork: CaseCurrentWorkReference,
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

export function resolveCase(value: FollowUpCase, now: string | Date): FollowUpCase {
  assertOpen(value);
  return {
    ...value,
    status: 'resolved',
    primaryResponsibilityId: null,
    currentWork: null,
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(value.version),
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

export function cancelCase(value: FollowUpCase, reason: string, now: string | Date): FollowUpCase {
  assertOpen(value);
  return {
    ...value,
    status: 'cancelled',
    primaryResponsibilityId: null,
    currentWork: null,
    cancellationReason: normalizeRequiredText(
      reason,
      'CASE_CANCELLATION_REASON_REQUIRED',
      'لغو پرونده به دلیل روشن نیاز دارد.',
    ),
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(value.version),
  };
}

export function reopenCase(
  value: FollowUpCase,
  input: {
    readonly primaryResponsibilityId: string;
    readonly currentWork: CaseCurrentWorkReference;
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
    primaryResponsibilityId: createCaseResponsibilityId(input.primaryResponsibilityId),
    currentWork: input.currentWork,
    cancellationReason: null,
    updatedAt: createUtcTimestamp(input.now),
    version: nextVersion(value.version),
  };
  assertFollowUpCaseInvariant(reopened);
  return reopened;
}
