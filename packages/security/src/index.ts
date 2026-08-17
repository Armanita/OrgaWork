import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import argon2 from 'argon2';

import type { Brand } from '@workspace/contracts';

export type PasswordHash = Brand<string, 'PasswordHash'>;

export const passwordPolicy = {
  minimumLength: 15,
  maximumLength: 128,
} as const;

export const selectedArgon2idProfile = {
  type: argon2.argon2id,
  memoryCost: 32 * 1024,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
  version: 0x13,
} as const;

export const passwordSecurityErrorCodes = [
  'PASSWORD_LENGTH_INVALID',
  'PASSWORD_CONTROL_CHARACTER',
  'PASSWORD_COMPROMISED',
  'PASSWORD_HASH_INVALID',
] as const;

export type PasswordSecurityErrorCode = (typeof passwordSecurityErrorCodes)[number];

export class PasswordSecurityError extends Error {
  override readonly name = 'PasswordSecurityError';

  constructor(
    readonly code: PasswordSecurityErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const compromisedPasswords = new Set([
  '123456789012345',
  '1234567890123456',
  'passwordpassword',
  'password123456',
  'qwertyqwerty123',
  'adminadminadmin',
  'letmeinletmein1',
  'welcome1234567',
  'orgawork1234567',
]);

const controlCharacterPattern = /\p{Cc}/u;

function passwordLength(value: string): number {
  return Array.from(value).length;
}

export function assertPasswordPolicy(password: string): void {
  const length = passwordLength(password);

  if (length < passwordPolicy.minimumLength || length > passwordPolicy.maximumLength) {
    throw new PasswordSecurityError(
      'PASSWORD_LENGTH_INVALID',
      'گذرواژه باید بین ۱۵ تا ۱۲۸ نویسه باشد.',
    );
  }

  if (controlCharacterPattern.test(password)) {
    throw new PasswordSecurityError(
      'PASSWORD_CONTROL_CHARACTER',
      'گذرواژه نباید نویسه کنترلی داشته باشد.',
    );
  }

  if (compromisedPasswords.has(password.toLocaleLowerCase('en-US'))) {
    throw new PasswordSecurityError(
      'PASSWORD_COMPROMISED',
      'گذرواژه انتخاب‌شده در فهرست مقادیر رایج قرار دارد.',
    );
  }
}

export function assertArgon2idPasswordHash(value: string): PasswordHash {
  if (!value.startsWith('$argon2id$v=19$')) {
    throw new PasswordSecurityError('PASSWORD_HASH_INVALID', 'قالب Hash گذرواژه معتبر نیست.');
  }

  try {
    argon2.needsRehash(value, selectedArgon2idProfile);
  } catch {
    throw new PasswordSecurityError('PASSWORD_HASH_INVALID', 'قالب Hash گذرواژه معتبر نیست.');
  }

  return value as PasswordHash;
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  assertPasswordPolicy(password);

  const encoded = await argon2.hash(password, selectedArgon2idProfile);
  return assertArgon2idPasswordHash(encoded);
}

export interface PasswordVerificationResult {
  readonly verified: boolean;
  readonly needsRehash: boolean;
}

export async function verifyPassword(
  passwordHash: string,
  candidatePassword: string,
): Promise<PasswordVerificationResult> {
  try {
    const verified = await argon2.verify(passwordHash, candidatePassword);

    return {
      verified,
      needsRehash:
        verified &&
        argon2.needsRehash(passwordHash, {
          memoryCost: selectedArgon2idProfile.memoryCost,
          timeCost: selectedArgon2idProfile.timeCost,
          parallelism: selectedArgon2idProfile.parallelism,
          version: selectedArgon2idProfile.version,
        }),
    };
  } catch {
    return {
      verified: false,
      needsRehash: false,
    };
  }
}

export const createPasswordHash = assertArgon2idPasswordHash;

export const securityTokenBytes = 32 as const;

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(encodedHash: string, password: string): Promise<boolean>;
  needsRehash(encodedHash: string): boolean;
}

export interface PasswordCompromiseChecker {
  isCompromised(password: string): Promise<boolean>;
}

export const defaultPasswordCompromiseChecker: PasswordCompromiseChecker = {
  isCompromised: (password: string): Promise<boolean> => {
    let compromised = false;
    try {
      assertPasswordPolicy(password);
    } catch (error: unknown) {
      compromised = error instanceof PasswordSecurityError && error.code === 'PASSWORD_COMPROMISED';
    }
    return Promise.resolve(compromised);
  },
};

export function createArgon2idPasswordHasher(): PasswordHasher {
  return {
    hash: async (password: string): Promise<string> => hashPassword(password),
    verify: async (encodedHash: string, password: string): Promise<boolean> =>
      (await verifyPassword(encodedHash, password)).verified,
    needsRehash: (encodedHash: string): boolean => {
      try {
        return argon2.needsRehash(encodedHash, selectedArgon2idProfile);
      } catch {
        return true;
      }
    },
  };
}

export function generateSecurityToken(bytes: number = securityTokenBytes): string {
  if (!Number.isSafeInteger(bytes) || bytes < securityTokenBytes || bytes > 128) {
    throw new RangeError('طول Token امنیتی معتبر نیست.');
  }

  return randomBytes(bytes).toString('base64url');
}

export function hashSecurityToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function hashForComparison(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function timingSafeTextEqual(left: string, right: string): boolean {
  return timingSafeEqual(hashForComparison(left), hashForComparison(right));
}

export function verifySecurityToken(token: string, expectedHash: string): boolean {
  if (!/^[0-9a-f]{64}$/u.test(expectedHash)) {
    return false;
  }

  return timingSafeTextEqual(hashSecurityToken(token), expectedHash);
}
