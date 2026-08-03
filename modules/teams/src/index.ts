import {
  createMembershipId,
  createOrganizationId,
  createTeamId,
  createTeamMembershipId,
  createUtcTimestamp,
  type Brand,
  type MembershipId,
  type OrganizationId,
  type TeamId,
  type TeamMembershipId,
  type UtcTimestamp,
} from '@workspace/contracts';

export type TeamName = Brand<string, 'TeamName'>;
export const teamRoles = ['member', 'team_manager'] as const;
export type TeamRole = (typeof teamRoles)[number];

export interface ActiveMembershipReference {
  readonly id: MembershipId;
  readonly organizationId: OrganizationId;
  readonly status: 'active';
}

export interface MembershipReference {
  readonly id: MembershipId;
  readonly organizationId: OrganizationId;
  readonly status: 'invited' | 'active' | 'suspended' | 'revoked';
}

export interface TeamMembership {
  readonly id: TeamMembershipId;
  readonly teamId: TeamId;
  readonly membershipId: MembershipId;
  readonly organizationId: OrganizationId;
  readonly role: TeamRole;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export interface Team {
  readonly id: TeamId;
  readonly organizationId: OrganizationId;
  readonly name: TeamName;
  readonly members: readonly TeamMembership[];
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export const teamDomainErrorCodes = [
  'INVALID_TEAM_NAME',
  'INACTIVE_MEMBERSHIP',
  'ORGANIZATION_MISMATCH',
  'DUPLICATE_TEAM_MEMBERSHIP',
  'TEAM_MEMBERSHIP_NOT_FOUND',
] as const;
export type TeamDomainErrorCode = (typeof teamDomainErrorCodes)[number];

export class TeamDomainError extends Error {
  override readonly name = 'TeamDomainError';

  constructor(
    readonly code: TeamDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function nextVersion(version: number): number {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError('نسخه تیم معتبر نیست.');
  }

  return version + 1;
}

export function normalizeTeamName(value: string): TeamName {
  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (normalized === '') {
    throw new TeamDomainError('INVALID_TEAM_NAME', 'نام تیم نباید خالی باشد.');
  }

  return normalized as TeamName;
}

export function createTeam(input: {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly now: string | Date;
}): Team {
  const now = createUtcTimestamp(input.now);

  return {
    id: createTeamId(input.id),
    organizationId: createOrganizationId(input.organizationId),
    name: normalizeTeamName(input.name),
    members: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function renameTeam(team: Team, name: string, now: string | Date): Team {
  const normalized = normalizeTeamName(name);

  if (normalized === team.name) {
    return team;
  }

  return {
    ...team,
    name: normalized,
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(team.version),
  };
}

function assertActiveMembership(
  team: Team,
  membership: MembershipReference,
): asserts membership is ActiveMembershipReference {
  if (membership.status !== 'active') {
    throw new TeamDomainError('INACTIVE_MEMBERSHIP', 'فقط عضویت فعال میتواند عضو تیم شود.');
  }

  if (membership.organizationId !== team.organizationId) {
    throw new TeamDomainError(
      'ORGANIZATION_MISMATCH',
      'عضویت و تیم باید متعلق به یک سازمان باشند.',
    );
  }
}

export function addTeamMember(
  team: Team,
  input: {
    readonly id: string;
    readonly membership: MembershipReference;
    readonly role?: TeamRole;
    readonly now: string | Date;
  },
): Team {
  assertActiveMembership(team, input.membership);

  if (team.members.some((member) => member.membershipId === input.membership.id)) {
    throw new TeamDomainError('DUPLICATE_TEAM_MEMBERSHIP', 'عضویت از قبل در تیم وجود دارد.');
  }

  const now = createUtcTimestamp(input.now);
  const member: TeamMembership = {
    id: createTeamMembershipId(input.id),
    teamId: team.id,
    membershipId: createMembershipId(input.membership.id),
    organizationId: team.organizationId,
    role: input.role ?? 'member',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  return {
    ...team,
    members: [...team.members, member],
    updatedAt: now,
    version: nextVersion(team.version),
  };
}

export function changeTeamMemberRole(
  team: Team,
  membershipId: MembershipId,
  role: TeamRole,
  now: string | Date,
): Team {
  const index = team.members.findIndex((member) => member.membershipId === membershipId);

  if (index < 0) {
    throw new TeamDomainError('TEAM_MEMBERSHIP_NOT_FOUND', 'عضویت تیم پیدا نشد.');
  }

  const current = team.members[index];

  if (current === undefined) {
    throw new TeamDomainError('TEAM_MEMBERSHIP_NOT_FOUND', 'عضویت تیم پیدا نشد.');
  }

  if (current.role === role) {
    return team;
  }

  const timestamp = createUtcTimestamp(now);
  const members = [...team.members];
  members[index] = {
    ...current,
    role,
    updatedAt: timestamp,
    version: nextVersion(current.version),
  };

  return {
    ...team,
    members,
    updatedAt: timestamp,
    version: nextVersion(team.version),
  };
}

export function removeTeamMember(team: Team, membershipId: MembershipId, now: string | Date): Team {
  const members = team.members.filter((member) => member.membershipId !== membershipId);

  if (members.length === team.members.length) {
    throw new TeamDomainError('TEAM_MEMBERSHIP_NOT_FOUND', 'عضویت تیم پیدا نشد.');
  }

  return {
    ...team,
    members,
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(team.version),
  };
}
