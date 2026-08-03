import {
  createMembershipId,
  createOrganizationId,
  createUserId,
  createUtcTimestamp,
  type Brand,
  type MembershipId,
  type OrganizationId,
  type UserId,
  type UtcTimestamp,
} from '@workspace/contracts';

export type OrganizationName = Brand<string, 'OrganizationName'>;

export interface Organization {
  readonly id: OrganizationId;
  readonly name: OrganizationName;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export const membershipStatuses = ['invited', 'active', 'suspended', 'revoked'] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export interface Membership {
  readonly id: MembershipId;
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly status: MembershipStatus;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export const organizationDomainErrorCodes = [
  'INVALID_ORGANIZATION_NAME',
  'INVALID_MEMBERSHIP_TRANSITION',
] as const;
export type OrganizationDomainErrorCode = (typeof organizationDomainErrorCodes)[number];

export class OrganizationDomainError extends Error {
  override readonly name = 'OrganizationDomainError';

  constructor(
    readonly code: OrganizationDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function nextVersion(version: number): number {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError('نسخه موجودیت معتبر نیست.');
  }

  return version + 1;
}

export function normalizeOrganizationName(value: string): OrganizationName {
  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (normalized === '') {
    throw new OrganizationDomainError('INVALID_ORGANIZATION_NAME', 'نام سازمان نباید خالی باشد.');
  }

  return normalized as OrganizationName;
}

export function createOrganization(input: {
  readonly id: string;
  readonly name: string;
  readonly now: string | Date;
}): Organization {
  const now = createUtcTimestamp(input.now);

  return {
    id: createOrganizationId(input.id),
    name: normalizeOrganizationName(input.name),
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function renameOrganization(
  organization: Organization,
  name: string,
  now: string | Date,
): Organization {
  const normalized = normalizeOrganizationName(name);

  if (normalized === organization.name) {
    return organization;
  }

  return {
    ...organization,
    name: normalized,
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(organization.version),
  };
}

export function createMembership(input: {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly initialStatus?: MembershipStatus;
  readonly now: string | Date;
}): Membership {
  const now = createUtcTimestamp(input.now);

  return {
    id: createMembershipId(input.id),
    userId: createUserId(input.userId),
    organizationId: createOrganizationId(input.organizationId),
    status: input.initialStatus ?? 'invited',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

const membershipTransitions: Readonly<Record<MembershipStatus, readonly MembershipStatus[]>> = {
  invited: ['active', 'revoked'],
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [],
};

export function transitionMembershipStatus(
  membership: Membership,
  target: MembershipStatus,
  now: string | Date,
): Membership {
  if (membership.status === target) {
    return membership;
  }

  if (!membershipTransitions[membership.status].includes(target)) {
    throw new OrganizationDomainError(
      'INVALID_MEMBERSHIP_TRANSITION',
      `تغییر وضعیت عضویت از ${membership.status} به ${target} مجاز نیست.`,
    );
  }

  return {
    ...membership,
    status: target,
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(membership.version),
  };
}

export function activateMembership(membership: Membership, now: string | Date): Membership {
  return transitionMembershipStatus(membership, 'active', now);
}

export function suspendMembership(membership: Membership, now: string | Date): Membership {
  return transitionMembershipStatus(membership, 'suspended', now);
}

export function revokeMembership(membership: Membership, now: string | Date): Membership {
  return transitionMembershipStatus(membership, 'revoked', now);
}

export function isMembershipActive(membership: Membership): boolean {
  return membership.status === 'active';
}
