import {
  createCaseResponsibilityId,
  createCaseId,
  createMembershipId,
  createOrganizationId,
  createResponsibilityTarget,
  createUtcTimestamp,
  type CaseResponsibilityId,
  type CaseId,
  type MembershipId,
  type OrganizationId,
  type ResponsibilityTarget,
  type ResponsibilityTargetInput,
  type UtcTimestamp,
} from '@workspace/contracts';

export const responsibilityStatuses = [
  'pending',
  'accepted',
  'rejected',
  'transferred',
  'ended',
] as const;
export type ResponsibilityStatus = (typeof responsibilityStatuses)[number];

export const responsibilityAcceptanceModes = ['self', 'explicit', 'forced'] as const;
export type ResponsibilityAcceptanceMode = (typeof responsibilityAcceptanceModes)[number];

export const responsibilityRoles = ['primary', 'collaborator'] as const;
export type ResponsibilityRole = (typeof responsibilityRoles)[number];

export const responsibilityDomainErrorCodes = [
  'INVALID_RESPONSIBILITY_TRANSITION',
  'INVALID_SELF_RESPONSIBILITY',
  'RESPONSIBILITY_REJECTION_REASON_REQUIRED',
  'RESPONSIBILITY_TRANSFER_TARGET_REQUIRED',
  'MULTIPLE_ACTIVE_PRIMARY_RESPONSIBILITYS',
] as const;
export type ResponsibilityDomainErrorCode = (typeof responsibilityDomainErrorCodes)[number];

export class ResponsibilityDomainError extends Error {
  override readonly name = 'ResponsibilityDomainError';

  constructor(
    readonly code: ResponsibilityDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface CaseResponsibility {
  readonly id: CaseResponsibilityId;
  readonly caseId: CaseId;
  readonly organizationId: OrganizationId;
  readonly target: ResponsibilityTarget;
  readonly assignedByMembershipId: MembershipId;
  readonly status: ResponsibilityStatus;
  readonly acceptanceMode: ResponsibilityAcceptanceMode;
  readonly role: ResponsibilityRole;
  readonly acceptedByMembershipId: MembershipId | null;
  readonly rejectedByMembershipId: MembershipId | null;
  readonly rejectionReason: string | null;
  readonly transferredToResponsibilityId: CaseResponsibilityId | null;
  readonly acceptedAt: UtcTimestamp | null;
  readonly endedAt: UtcTimestamp | null;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export const responsibilityDomainEventNames = [
  'responsibility.created',
  'responsibility.accepted',
  'responsibility.rejected',
  'responsibility.transferred',
  'responsibility.ended',
] as const;
export type ResponsibilityDomainEventName = (typeof responsibilityDomainEventNames)[number];

function nextVersion(version: number): number {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError('نسخه مسئولیت معتبر نیست.');
  }
  return version + 1;
}

function requirePending(value: CaseResponsibility): void {
  if (value.status !== 'pending') {
    throw new ResponsibilityDomainError(
      'INVALID_RESPONSIBILITY_TRANSITION',
      'این تغییر فقط برای مسئولیت منتظر پذیرش مجاز است.',
    );
  }
}

function requireAccepted(value: CaseResponsibility): void {
  if (value.status !== 'accepted') {
    throw new ResponsibilityDomainError(
      'INVALID_RESPONSIBILITY_TRANSITION',
      'این تغییر فقط برای مسئولیت پذیرفته‌شده مجاز است.',
    );
  }
}

function normalizeReason(
  value: string,
  code: ResponsibilityDomainErrorCode,
  message: string,
): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (normalized === '') {
    throw new ResponsibilityDomainError(code, message);
  }
  return normalized;
}

export function createCaseResponsibility(input: {
  readonly id: string;
  readonly caseId: string;
  readonly organizationId: string;
  readonly target: ResponsibilityTargetInput;
  readonly assignedByMembershipId: string;
  readonly acceptanceMode?: ResponsibilityAcceptanceMode;
  readonly role?: ResponsibilityRole;
  readonly now: string | Date;
}): CaseResponsibility {
  const now = createUtcTimestamp(input.now);
  const target = createResponsibilityTarget(input.target);
  const assignedByMembershipId = createMembershipId(input.assignedByMembershipId);
  const acceptanceMode = input.acceptanceMode ?? 'explicit';

  if (
    acceptanceMode === 'self' &&
    (target.kind !== 'membership' || target.membershipId !== assignedByMembershipId)
  ) {
    throw new ResponsibilityDomainError(
      'INVALID_SELF_RESPONSIBILITY',
      'مسئولیت self فقط برای عضویت همان ایجادکننده مجاز است.',
    );
  }

  const accepted = acceptanceMode === 'self' || acceptanceMode === 'forced';

  return {
    id: createCaseResponsibilityId(input.id),
    caseId: createCaseId(input.caseId),
    organizationId: createOrganizationId(input.organizationId),
    target,
    assignedByMembershipId,
    status: accepted ? 'accepted' : 'pending',
    acceptanceMode,
    role: input.role ?? 'collaborator',
    acceptedByMembershipId:
      acceptanceMode === 'self' && target.kind === 'membership' ? target.membershipId : null,
    rejectedByMembershipId: null,
    rejectionReason: null,
    transferredToResponsibilityId: null,
    acceptedAt: accepted ? now : null,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function acceptResponsibility(
  value: CaseResponsibility,
  acceptedByMembershipId: string,
  now: string | Date,
): CaseResponsibility {
  requirePending(value);
  const timestamp = createUtcTimestamp(now);
  return {
    ...value,
    status: 'accepted',
    acceptedByMembershipId: createMembershipId(acceptedByMembershipId),
    acceptedAt: timestamp,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function rejectResponsibility(
  value: CaseResponsibility,
  input: {
    readonly rejectedByMembershipId: string;
    readonly reason: string;
    readonly now: string | Date;
  },
): CaseResponsibility {
  requirePending(value);
  const timestamp = createUtcTimestamp(input.now);
  return {
    ...value,
    status: 'rejected',
    rejectedByMembershipId: createMembershipId(input.rejectedByMembershipId),
    rejectionReason: normalizeReason(
      input.reason,
      'RESPONSIBILITY_REJECTION_REASON_REQUIRED',
      'رد مسئولیت به دلیل روشن نیاز دارد.',
    ),
    endedAt: timestamp,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function transferResponsibility(
  value: CaseResponsibility,
  targetResponsibilityId: string,
  now: string | Date,
): CaseResponsibility {
  requireAccepted(value);
  const target = createCaseResponsibilityId(targetResponsibilityId);
  if (target === value.id) {
    throw new ResponsibilityDomainError(
      'RESPONSIBILITY_TRANSFER_TARGET_REQUIRED',
      'مسئولیت نمی‌تواند به خودش منتقل شود.',
    );
  }

  const timestamp = createUtcTimestamp(now);
  return {
    ...value,
    status: 'transferred',
    transferredToResponsibilityId: target,
    endedAt: timestamp,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function endResponsibility(
  value: CaseResponsibility,
  now: string | Date,
): CaseResponsibility {
  if (value.status !== 'pending' && value.status !== 'accepted') {
    throw new ResponsibilityDomainError(
      'INVALID_RESPONSIBILITY_TRANSITION',
      'فقط مسئولیت فعال را می‌توان پایان داد.',
    );
  }

  const timestamp = createUtcTimestamp(now);
  return {
    ...value,
    status: 'ended',
    endedAt: timestamp,
    updatedAt: timestamp,
    version: nextVersion(value.version),
  };
}

export function isActiveResponsibility(value: CaseResponsibility): boolean {
  return value.status === 'pending' || value.status === 'accepted';
}

export function assertAtMostOneActivePrimaryResponsibility(
  responsibilitys: readonly CaseResponsibility[],
): void {
  const seen = new Set<string>();

  for (const responsibility of responsibilitys) {
    if (responsibility.role !== 'primary' || !isActiveResponsibility(responsibility)) {
      continue;
    }

    const key = `${responsibility.organizationId}:${responsibility.caseId}`;
    if (seen.has(key)) {
      throw new ResponsibilityDomainError(
        'MULTIPLE_ACTIVE_PRIMARY_RESPONSIBILITYS',
        'هر پرونده فقط یک مسئولیت اصلی فعال می‌تواند داشته باشد.',
      );
    }
    seen.add(key);
  }
}
