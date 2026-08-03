import {
  createUserId,
  createUtcTimestamp,
  type Brand,
  type UserId,
  type UtcTimestamp,
} from '@workspace/contracts';

export const userStatuses = ['pending', 'active', 'disabled'] as const;
export type UserStatus = (typeof userStatuses)[number];
export type NormalizedEmail = Brand<string, 'NormalizedEmail'>;

export const userDomainErrorCodes = [
  'INVALID_EMAIL',
  'INVALID_USER_STATUS',
  'INVALID_USER_TRANSITION',
] as const;
export type UserDomainErrorCode = (typeof userDomainErrorCodes)[number];

export class UserDomainError extends Error {
  override readonly name = 'UserDomainError';

  constructor(
    readonly code: UserDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface User {
  readonly id: UserId;
  readonly email: NormalizedEmail;
  readonly status: UserStatus;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function isUserStatus(value: string): value is UserStatus {
  return (userStatuses as readonly string[]).includes(value);
}

function nextVersion(version: number): number {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError('نسخه کاربر معتبر نیست.');
  }

  return version + 1;
}

export function normalizeEmail(value: string): NormalizedEmail {
  const normalized = value.trim().toLocaleLowerCase('en-US');

  if (!emailPattern.test(normalized)) {
    throw new UserDomainError('INVALID_EMAIL', 'ایمیل معتبر نیست.');
  }

  return normalized as NormalizedEmail;
}

export function createUser(input: {
  readonly id: string;
  readonly email: string;
  readonly status?: UserStatus;
  readonly now: string | Date;
}): User {
  const status = input.status ?? 'pending';

  if (!isUserStatus(status)) {
    throw new UserDomainError('INVALID_USER_STATUS', 'وضعیت کاربر معتبر نیست.');
  }

  const now = createUtcTimestamp(input.now);

  return {
    id: createUserId(input.id),
    email: normalizeEmail(input.email),
    status,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

const allowedTransitions: Readonly<Record<UserStatus, readonly UserStatus[]>> = {
  pending: ['active', 'disabled'],
  active: ['disabled'],
  disabled: ['active'],
};

export function transitionUserStatus(user: User, target: UserStatus, now: string | Date): User {
  if (user.status === target) {
    return user;
  }

  if (!allowedTransitions[user.status].includes(target)) {
    throw new UserDomainError(
      'INVALID_USER_TRANSITION',
      `تغییر وضعیت کاربر از ${user.status} به ${target} مجاز نیست.`,
    );
  }

  return {
    ...user,
    status: target,
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(user.version),
  };
}

export function activateUser(user: User, now: string | Date): User {
  return transitionUserStatus(user, 'active', now);
}

export function disableUser(user: User, now: string | Date): User {
  return transitionUserStatus(user, 'disabled', now);
}

export function isUserActive(user: User): boolean {
  return user.status === 'active';
}
