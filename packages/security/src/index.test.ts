import { describe, expect, it } from 'vitest';

import {
  PasswordSecurityError,
  assertPasswordPolicy,
  createPasswordHash,
  hashPassword,
  passwordPolicy,
  selectedArgon2idProfile,
  verifyPassword,
} from './index.js';

describe('امنیت گذرواژه P2.4', () => {
  it('سیاست طول و فهرست گذرواژه رایج را اعمال می‌کند', () => {
    expect(() => assertPasswordPolicy('کوتاه')).toThrow(PasswordSecurityError);
    expect(() => assertPasswordPolicy('passwordpassword')).toThrowError(
      expect.objectContaining({ code: 'PASSWORD_COMPROMISED' }),
    );
    expect(() => assertPasswordPolicy('A'.repeat(passwordPolicy.maximumLength + 1))).toThrowError(
      expect.objectContaining({ code: 'PASSWORD_LENGTH_INVALID' }),
    );
  });

  it('Unicode و فاصله را بدون Normalization معنایی می‌پذیرد', () => {
    expect(() => assertPasswordPolicy('گذرواژه امن فارسی ۱۴۰۵')).not.toThrow();
    expect(() => assertPasswordPolicy('correct horse battery staple')).not.toThrow();
  });

  it('با پروفایل Benchmark شده Argon2id هش و تأیید می‌کند', async () => {
    const password = 'گذرواژه آزمون بسیار امن ۱۴۰۵';
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toContain('$argon2id$v=19$');
    expect(passwordHash).toContain(`m=${String(selectedArgon2idProfile.memoryCost)}`);
    expect(passwordHash).toContain(`p=${String(selectedArgon2idProfile.parallelism)}`);
    expect(passwordHash).toContain(`t=${String(selectedArgon2idProfile.timeCost)}`);
    expect(await verifyPassword(passwordHash, password)).toEqual({
      verified: true,
      needsRehash: false,
    });
    expect(await verifyPassword(passwordHash, password + 'x')).toEqual({
      verified: false,
      needsRehash: false,
    });
  });

  it('گذرواژه را پیش از Hash نرمال نمی‌کند و Hash خراب را رد می‌کند', async () => {
    const composed = 'é'.repeat(15);
    const decomposed = 'e\u0301'.repeat(15);
    const passwordHash = await hashPassword(composed);

    expect((await verifyPassword(passwordHash, decomposed)).verified).toBe(false);
    expect(() => createPasswordHash('sha256:not-allowed')).toThrowError(
      expect.objectContaining({ code: 'PASSWORD_HASH_INVALID' }),
    );
    expect(await verifyPassword('not-a-password-hash', composed)).toEqual({
      verified: false,
      needsRehash: false,
    });
  });
});
