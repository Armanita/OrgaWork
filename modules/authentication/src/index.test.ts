import { describe, expect, it } from 'vitest';

import { hashSecurityToken } from '@workspace/security';

import {
  authenticationPolicy,
  createAuthenticationService,
  type AuthenticationRepository,
  type AuthenticationSessionRecord,
  type AuthenticationUserRecord,
} from './index.js';

class MemoryRepository implements AuthenticationRepository {
  user: AuthenticationUserRecord | undefined;
  session: AuthenticationSessionRecord | undefined;
  failures = 0;
  reset: { tokenHash: string; userId: string } | undefined;

  async findUserCredentialByEmail(): Promise<AuthenticationUserRecord | undefined> {
    return this.user;
  }
  async replacePasswordCredentialAndRevokeSessions(
    userId: string,
    passwordHash: string,
  ): Promise<number> {
    if (this.user?.id === userId) this.user = { ...this.user, passwordHash };
    if (this.session?.userId === userId) this.session = { ...this.session, status: 'revoked' };
    return this.session === undefined ? 0 : 1;
  }
  async updatePasswordHash(): Promise<boolean> {
    return true;
  }
  async createSession(
    input: Parameters<AuthenticationRepository['createSession']>[0],
  ): Promise<void> {
    this.session = {
      id: input.id,
      userId: input.userId,
      userEmail: this.user?.email ?? '',
      userStatus: this.user?.status ?? 'active',
      status: 'active',
      sessionRevision: 1,
      currentOrganizationId: null,
      csrfToken: input.csrfToken,
      createdAt: input.createdAt,
      lastSeenAt: input.lastSeenAt,
      idleExpiresAt: input.idleExpiresAt,
      absoluteExpiresAt: input.absoluteExpiresAt,
      revokedAt: null,
      version: 1,
    };
    this.secretHash = input.secretHash;
  }
  secretHash = '';
  async findSessionBySecretHash(hash: string): Promise<AuthenticationSessionRecord | undefined> {
    return hash === this.secretHash ? this.session : undefined;
  }
  async touchSession(): Promise<boolean> {
    return true;
  }
  async expireSession(): Promise<boolean> {
    if (this.session) this.session = { ...this.session, status: 'expired' };
    return true;
  }
  async revokeSession(): Promise<boolean> {
    if (this.session) this.session = { ...this.session, status: 'revoked' };
    return true;
  }
  async revokeAllUserSessions(): Promise<number> {
    if (this.session) this.session = { ...this.session, status: 'revoked' };
    return 1;
  }
  async readRateLimit(): Promise<undefined> {
    return undefined;
  }
  async recordLoginFailure(): Promise<{
    failureCount: number;
    windowStartedAt: string;
    blockedUntil: string | null;
  }> {
    this.failures += 1;
    return {
      failureCount: this.failures,
      windowStartedAt: new Date().toISOString(),
      blockedUntil: null,
    };
  }
  async clearRateLimit(): Promise<void> {
    this.failures = 0;
  }
  async createPasswordResetToken(input: { tokenHash: string; userId: string }): Promise<void> {
    this.reset = input;
  }
  async consumePasswordResetToken(
    tokenHash: string,
  ): Promise<{ id: string; userId: string } | undefined> {
    return this.reset?.tokenHash === tokenHash
      ? { id: '11111111-1111-4111-8111-111111111111', userId: this.reset.userId }
      : undefined;
  }
}

const hasher = {
  hash: async (password: string): Promise<string> => `hash:${password}`,
  verify: async (hash: string, password: string): Promise<boolean> => hash === `hash:${password}`,
  needsRehash: (): boolean => false,
};

function service(repository: MemoryRepository, now = new Date('2026-08-04T00:00:00.000Z')) {
  return createAuthenticationService({
    repository,
    passwordHasher: hasher,
    passwordCompromiseChecker: { isCompromised: async (): Promise<boolean> => false },
    dummyPasswordHash: 'hash:dummy-password-value',
    now: () => now,
    createId: () => '11111111-1111-4111-8111-111111111111',
    createSessionSecret: () => 'session-secret-session-secret-session-secret',
    createCsrfToken: () => 'csrf-secret-csrf-secret-csrf-secret',
  });
}

describe('authentication service', () => {
  it('creates a server-side session and rejects an invalid CSRF token', async () => {
    const repository = new MemoryRepository();
    repository.user = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'user@example.com',
      status: 'active',
      passwordHash: 'hash:correct password value',
    };
    const authentication = await service(repository);
    const result = await authentication.login({
      email: 'USER@example.com',
      password: 'correct password value',
      clientAddress: '127.0.0.1',
    });
    expect(repository.secretHash).toBe(hashSecurityToken(result.sessionSecret));
    await expect(authentication.logout(result.sessionSecret, 'wrong')).rejects.toMatchObject({
      code: 'AUTH_CSRF_INVALID',
    });
  });

  it('uses the same public credential error for an unknown account', async () => {
    const authentication = await service(new MemoryRepository());
    await expect(
      authentication.login({
        email: 'missing@example.com',
        password: 'incorrect password',
        clientAddress: '127.0.0.1',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('enforces the eight-hour idle and seven-day absolute policy', () => {
    expect(authenticationPolicy.idleTimeoutMilliseconds).toBe(8 * 60 * 60 * 1000);
    expect(authenticationPolicy.absoluteTimeoutMilliseconds).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('creates and consumes a one-time password-reset token', async () => {
    const repository = new MemoryRepository();
    repository.user = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'user@example.com',
      status: 'active',
      passwordHash: 'hash:old password value',
    };
    const authentication = await service(repository);
    const requested = await authentication.requestPasswordReset('user@example.com');
    expect(requested.token).toBeDefined();
    await authentication.confirmPasswordReset(requested.token ?? '', 'new secure password value');
    expect(repository.user?.passwordHash).toBe('hash:new secure password value');
  });
});
