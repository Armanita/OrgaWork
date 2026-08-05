import {
  createCaseAssignmentId,
  createCaseId,
  createOrganizationId,
  createUserId,
  createUtcTimestamp,
  type CaseAssignmentId,
  type CaseId,
  type OrganizationId,
  type UserId,
  type UtcTimestamp,
} from '@workspace/contracts';

export const assignmentStatuses = [
  'pending',
  'accepted',
  'rejected',
  'transferred',
  'ended',
] as const;
export type AssignmentStatus = (typeof assignmentStatuses)[number];
export const assignmentAcceptanceModes = ['explicit', 'forced'] as const;
export type AssignmentAcceptanceMode = (typeof assignmentAcceptanceModes)[number];

export const assignmentDomainErrorCodes = [
  'INVALID_ASSIGNMENT_TRANSITION',
  'ASSIGNMENT_REJECTION_REASON_REQUIRED',
  'ASSIGNMENT_TRANSFER_TARGET_REQUIRED',
  'MULTIPLE_ACTIVE_PRIMARY_ASSIGNMENTS',
] as const;
export type AssignmentDomainErrorCode = (typeof assignmentDomainErrorCodes)[number];

export class AssignmentDomainError extends Error {
  override readonly name = 'AssignmentDomainError';

  constructor(
    readonly code: AssignmentDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface CaseAssignment {
  readonly id: CaseAssignmentId;
  readonly caseId: CaseId;
  readonly organizationId: OrganizationId;
  readonly assigneeUserId: UserId;
  readonly assignedByUserId: UserId;
  readonly status: AssignmentStatus;
  readonly acceptanceMode: AssignmentAcceptanceMode;
  readonly isPrimary: boolean;
  readonly rejectionReason: string | null;
  readonly transferredToAssignmentId: CaseAssignmentId | null;
  readonly acceptedAt: UtcTimestamp | null;
  readonly endedAt: UtcTimestamp | null;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export const assignmentDomainEventNames = [
  'assignment.created',
  'assignment.accepted',
  'assignment.rejected',
  'assignment.transferred',
  'assignment.ended',
] as const;
export type AssignmentDomainEventName = (typeof assignmentDomainEventNames)[number];

function nextVersion(version: number): number {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError('نسخه مسئولیت معتبر نیست.');
  }

  return version + 1;
}

function requirePending(value: CaseAssignment): void {
  if (value.status !== 'pending') {
    throw new AssignmentDomainError(
      'INVALID_ASSIGNMENT_TRANSITION',
      'این تغییر فقط برای مسئولیت منتظر پذیرش مجاز است.',
    );
  }
}

function requireAccepted(value: CaseAssignment): void {
  if (value.status !== 'accepted') {
    throw new AssignmentDomainError(
      'INVALID_ASSIGNMENT_TRANSITION',
      'این تغییر فقط برای مسئولیت پذیرفته‌شده مجاز است.',
    );
  }
}

function normalizeReason(value: string, code: AssignmentDomainErrorCode, message: string): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (normalized === '') {
    throw new AssignmentDomainError(code, message);
  }

  return normalized;
}

export function createCaseAssignment(input: {
  readonly id: string;
  readonly caseId: string;
  readonly organizationId: string;
  readonly assigneeUserId: string;
  readonly assignedByUserId: string;
  readonly acceptanceMode?: AssignmentAcceptanceMode;
  readonly isPrimary?: boolean;
  readonly now: string | Date;
}): CaseAssignment {
  const now = createUtcTimestamp(input.now);
  const acceptanceMode = input.acceptanceMode ?? 'explicit';
  const accepted = acceptanceMode === 'forced';

  return {
    id: createCaseAssignmentId(input.id),
    caseId: createCaseId(input.caseId),
    organizationId: createOrganizationId(input.organizationId),
    assigneeUserId: createUserId(input.assigneeUserId),
    assignedByUserId: createUserId(input.assignedByUserId),
    status: accepted ? 'accepted' : 'pending',
    acceptanceMode,
    isPrimary: input.isPrimary ?? false,
    rejectionReason: null,
    transferredToAssignmentId: null,
    acceptedAt: accepted ? now : null,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function acceptAssignment(value: CaseAssignment, now: string | Date): CaseAssignment {
  requirePending(value);
  const timestamp = createUtcTimestamp(now);

  return {
    ...value,
    status: 'accepted',
    acceptedAt: timestamp,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function rejectAssignment(
  value: CaseAssignment,
  reason: string,
  now: string | Date,
): CaseAssignment {
  requirePending(value);
  const timestamp = createUtcTimestamp(now);

  return {
    ...value,
    status: 'rejected',
    rejectionReason: normalizeReason(
      reason,
      'ASSIGNMENT_REJECTION_REASON_REQUIRED',
      'رد مسئولیت به دلیل روشن نیاز دارد.',
    ),
    endedAt: timestamp,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function transferAssignment(
  value: CaseAssignment,
  targetAssignmentId: string,
  now: string | Date,
): CaseAssignment {
  requireAccepted(value);
  const target = createCaseAssignmentId(targetAssignmentId);

  if (target === value.id) {
    throw new AssignmentDomainError(
      'ASSIGNMENT_TRANSFER_TARGET_REQUIRED',
      'مسئولیت نمی‌تواند به خودش منتقل شود.',
    );
  }

  const timestamp = createUtcTimestamp(now);

  return {
    ...value,
    status: 'transferred',
    transferredToAssignmentId: target,
    endedAt: timestamp,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function endAssignment(value: CaseAssignment, now: string | Date): CaseAssignment {
  requireAccepted(value);
  const timestamp = createUtcTimestamp(now);

  return {
    ...value,
    status: 'ended',
    endedAt: timestamp,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function isActiveAssignment(value: CaseAssignment): boolean {
  return value.status === 'pending' || value.status === 'accepted';
}

export function assertAtMostOneActivePrimaryAssignment(
  assignments: readonly CaseAssignment[],
): void {
  const seen = new Set<string>();

  for (const assignment of assignments) {
    if (!assignment.isPrimary || !isActiveAssignment(assignment)) {
      continue;
    }

    const key = `${assignment.organizationId}:${assignment.caseId}`;

    if (seen.has(key)) {
      throw new AssignmentDomainError(
        'MULTIPLE_ACTIVE_PRIMARY_ASSIGNMENTS',
        'هر پرونده فقط یک مسئولیت اصلی فعال می‌تواند داشته باشد.',
      );
    }

    seen.add(key);
  }
}
