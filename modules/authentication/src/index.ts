import { randomUUID } from 'node:crypto';

import { withRuntimeTransaction, type PostgreSqlAccess } from '@workspace/database';
import {
  assertPasswordPolicy,
  createArgon2idPasswordHasher,
  generateSecurityToken,
  hashSecurityToken,
  timingSafeTextEqual,
  PasswordSecurityError,
  type PasswordCompromiseChecker,
  type PasswordHasher,
} from '@workspace/security';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function normalizeLoginEmail(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('en-US');

  if (!emailPattern.test(normalized)) {
    throw new TypeError('ایمیل معتبر نیست.');
  }

  return normalized;
}

export const authenticationErrorCodes = [
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_ACCOUNT_DISABLED',
  'AUTH_SESSION_REQUIRED',
  'AUTH_SESSION_EXPIRED',
  'AUTH_SESSION_REVOKED',
  'AUTH_CSRF_INVALID',
  'AUTH_PASSWORD_POLICY_FAILED',
  'AUTH_PASSWORD_RESET_INVALID',
  'RATE_LIMITED',
] as const;

export type AuthenticationErrorCode = (typeof authenticationErrorCodes)[number];

export class AuthenticationError extends Error {
  override readonly name = 'AuthenticationError';

  public constructor(
    readonly code: AuthenticationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const sessionStatuses = ['active', 'revoked', 'expired'] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const authenticationPolicy = {
  idleTimeoutMilliseconds: 8 * 60 * 60 * 1000,
  absoluteTimeoutMilliseconds: 7 * 24 * 60 * 60 * 1000,
  loginFailureLimit: 5,
  loginFailureWindowMilliseconds: 15 * 60 * 1000,
} as const;

export interface AuthenticationUserRecord {
  readonly id: string;
  readonly email: string;
  readonly status: 'pending' | 'active' | 'disabled';
  readonly passwordHash: string | null;
}

export interface AuthenticationSessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly userStatus: 'pending' | 'active' | 'disabled';
  readonly status: SessionStatus;
  readonly sessionRevision: number;
  readonly currentOrganizationId: string | null;
  readonly csrfToken: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly idleExpiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly revokedAt: string | null;
  readonly version: number;
}

export interface AuthenticationRateLimitRecord {
  readonly failureCount: number;
  readonly windowStartedAt: string;
  readonly blockedUntil: string | null;
}

export interface NewAuthenticationSession {
  readonly id: string;
  readonly userId: string;
  readonly secretHash: string;
  readonly csrfToken: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly idleExpiresAt: string;
  readonly absoluteExpiresAt: string;
}

export interface AuthenticationRepository {
  findUserCredentialByEmail(email: string): Promise<AuthenticationUserRecord | undefined>;
  replacePasswordCredentialAndRevokeSessions(
    userId: string,
    passwordHash: string,
    now: string,
  ): Promise<number>;
  updatePasswordHash(
    userId: string,
    currentPasswordHash: string,
    passwordHash: string,
    now: string,
  ): Promise<boolean>;
  createSession(session: NewAuthenticationSession): Promise<void>;
  findSessionBySecretHash(secretHash: string): Promise<AuthenticationSessionRecord | undefined>;
  touchSession(
    sessionId: string,
    lastSeenAt: string,
    idleExpiresAt: string,
    updatedAt: string,
  ): Promise<boolean>;
  expireSession(sessionId: string, expectedVersion: number, now: string): Promise<boolean>;
  revokeSession(sessionId: string, expectedVersion: number, now: string): Promise<boolean>;
  revokeAllUserSessions(userId: string, now: string): Promise<number>;
  readRateLimit(keyHash: string): Promise<AuthenticationRateLimitRecord | undefined>;
  recordLoginFailure(
    keyHash: string,
    now: string,
    windowMilliseconds: number,
    failureLimit: number,
  ): Promise<AuthenticationRateLimitRecord>;
  clearRateLimit(keyHash: string): Promise<void>;
  createPasswordResetToken(input: {
    readonly id: string;
    readonly userId: string;
    readonly tokenHash: string;
    readonly expiresAt: string;
    readonly now: string;
  }): Promise<void>;
  consumePasswordResetToken(
    tokenHash: string,
    now: string,
  ): Promise<{ readonly id: string; readonly userId: string } | undefined>;
}

export interface AuthenticationSessionView {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly status: 'active';
  readonly sessionRevision: number;
  readonly currentOrganizationId: string | null;
  readonly csrfToken: string;
  readonly idleExpiresAt: string;
  readonly absoluteExpiresAt: string;
}

export interface AuthenticationLoginResult {
  readonly sessionSecret: string;
  readonly session: AuthenticationSessionView;
}

export interface AuthenticationService {
  setPasswordCredential(userId: string, password: string): Promise<void>;
  login(input: {
    readonly email: string;
    readonly password: string;
    readonly clientAddress: string;
  }): Promise<AuthenticationLoginResult>;
  getSession(sessionSecret: string): Promise<AuthenticationSessionView>;
  logout(sessionSecret: string, csrfToken: string): Promise<void>;
  logoutAll(sessionSecret: string, csrfToken: string): Promise<number>;
  requestPasswordReset(email: string): Promise<{ readonly token?: string }>;
  confirmPasswordReset(token: string, password: string): Promise<void>;
}

export interface CreateAuthenticationServiceOptions {
  readonly repository: AuthenticationRepository;
  readonly passwordHasher?: PasswordHasher;
  readonly passwordCompromiseChecker?: PasswordCompromiseChecker;
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly createSessionSecret?: () => string;
  readonly createCsrfToken?: () => string;
  readonly dummyPasswordHash?: string;
}

interface AuthenticationServiceDependencies {
  readonly repository: AuthenticationRepository;
  readonly passwordHasher: PasswordHasher;
  readonly passwordCompromiseChecker: PasswordCompromiseChecker | undefined;
  readonly now: () => Date;
  readonly createId: () => string;
  readonly createSessionSecret: () => string;
  readonly createCsrfToken: () => string;
  readonly dummyPasswordHash: string;
}

interface CredentialRow {
  readonly id: string;
  readonly email: string;
  readonly status: 'pending' | 'active' | 'disabled';
  readonly password_hash: string | null;
}

interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly user_email: string;
  readonly user_status: 'pending' | 'active' | 'disabled';
  readonly status: SessionStatus;
  readonly session_revision: number;
  readonly current_organization_id: string | null;
  readonly csrf_token: string;
  readonly created_at: Date | string;
  readonly last_seen_at: Date | string;
  readonly idle_expires_at: Date | string;
  readonly absolute_expires_at: Date | string;
  readonly revoked_at: Date | string | null;
  readonly version: number;
}

interface RateLimitRow {
  readonly failure_count: number;
  readonly window_started_at: Date | string;
  readonly blocked_until: Date | string | null;
}

function normalizeTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('زمان ذخیره‌شده احراز هویت معتبر نیست.');
  }

  return date.toISOString();
}

function mapSessionRow(row: SessionRow): AuthenticationSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userStatus: row.user_status,
    status: row.status,
    sessionRevision: row.session_revision,
    currentOrganizationId: row.current_organization_id,
    csrfToken: row.csrf_token,
    createdAt: normalizeTimestamp(row.created_at),
    lastSeenAt: normalizeTimestamp(row.last_seen_at),
    idleExpiresAt: normalizeTimestamp(row.idle_expires_at),
    absoluteExpiresAt: normalizeTimestamp(row.absolute_expires_at),
    revokedAt: row.revoked_at === null ? null : normalizeTimestamp(row.revoked_at),
    version: row.version,
  };
}

function mapRateLimitRow(row: RateLimitRow): AuthenticationRateLimitRecord {
  return {
    failureCount: row.failure_count,
    windowStartedAt: normalizeTimestamp(row.window_started_at),
    blockedUntil: row.blocked_until === null ? null : normalizeTimestamp(row.blocked_until),
  };
}

function rowAt<Row>(rows: readonly unknown[], index: number): Row | undefined {
  return rows[index] as Row | undefined;
}

export function createPostgreSqlAuthenticationRepository(
  access: PostgreSqlAccess,
): AuthenticationRepository {
  const runtimeQuery = (text: string, values?: readonly unknown[]) =>
    withRuntimeTransaction(access, (transaction) => transaction.query(text, values));

  return {
    findUserCredentialByEmail: async (
      email: string,
    ): Promise<AuthenticationUserRecord | undefined> => {
      const result = await runtimeQuery(
        `SELECT
           user_row.id::text AS id,
           user_row.email,
           user_row.status,
           credential.password_hash
         FROM public.orgawork_users AS user_row
         LEFT JOIN public.orgawork_password_credentials AS credential
           ON credential.user_id = user_row.id
        WHERE user_row.email = $1
        LIMIT 1`,
        [email],
      );
      const row = rowAt<CredentialRow>(result.rows, 0);

      return row === undefined
        ? undefined
        : {
            id: row.id,
            email: row.email,
            status: row.status,
            passwordHash: row.password_hash,
          };
    },
    replacePasswordCredentialAndRevokeSessions: async (
      userId: string,
      passwordHash: string,
      now: string,
    ): Promise<number> =>
      withRuntimeTransaction(access, async (transaction): Promise<number> => {
        await transaction.query(
          `INSERT INTO public.orgawork_password_credentials
             (
               user_id,
               password_hash,
               password_changed_at,
               created_at,
               updated_at,
               version
             )
           VALUES ($1, $2, $3, $3, $3, 1)
           ON CONFLICT (user_id)
           DO UPDATE SET
             password_hash = EXCLUDED.password_hash,
             password_changed_at = EXCLUDED.password_changed_at,
             updated_at = EXCLUDED.updated_at,
             version = public.orgawork_password_credentials.version + 1`,
          [userId, passwordHash, now],
        );
        const revoked = await transaction.query(
          `UPDATE public.orgawork_sessions
              SET status = 'revoked',
                  session_revision = session_revision + 1,
                  revoked_at = $2,
                  updated_at = $2,
                  version = version + 1
            WHERE user_id = $1
              AND status = 'active'`,
          [userId, now],
        );

        return revoked.rowCount ?? 0;
      }),
    updatePasswordHash: async (
      userId: string,
      currentPasswordHash: string,
      passwordHash: string,
      now: string,
    ): Promise<boolean> => {
      const result = await runtimeQuery(
        `UPDATE public.orgawork_password_credentials
            SET password_hash = $3,
                password_changed_at = $4,
                updated_at = $4,
                version = version + 1
          WHERE user_id = $1
            AND password_hash = $2`,
        [userId, currentPasswordHash, passwordHash, now],
      );

      return (result.rowCount ?? 0) === 1;
    },
    createSession: async (session: NewAuthenticationSession): Promise<void> => {
      await runtimeQuery(
        `INSERT INTO public.orgawork_sessions
           (
             id,
             user_id,
             secret_hash,
             csrf_token,
             status,
             session_revision,
             current_organization_id,
             created_at,
             last_seen_at,
             idle_expires_at,
             absolute_expires_at,
             revoked_at,
             updated_at,
             version
           )
         VALUES
           ($1, $2, $3, $4, 'active', 1, NULL, $5, $6, $7, $8, NULL, $5, 1)`,
        [
          session.id,
          session.userId,
          session.secretHash,
          session.csrfToken,
          session.createdAt,
          session.lastSeenAt,
          session.idleExpiresAt,
          session.absoluteExpiresAt,
        ],
      );
    },
    findSessionBySecretHash: async (
      secretHash: string,
    ): Promise<AuthenticationSessionRecord | undefined> => {
      const result = await runtimeQuery(
        `SELECT
           session_row.id::text AS id,
           session_row.user_id::text AS user_id,
           user_row.email AS user_email,
           user_row.status AS user_status,
           session_row.status,
           session_row.session_revision,
           session_row.current_organization_id::text AS current_organization_id,
           session_row.csrf_token,
           session_row.created_at,
           session_row.last_seen_at,
           session_row.idle_expires_at,
           session_row.absolute_expires_at,
           session_row.revoked_at,
           session_row.version
         FROM public.orgawork_sessions AS session_row
         JOIN public.orgawork_users AS user_row
           ON user_row.id = session_row.user_id
        WHERE session_row.secret_hash = $1
        LIMIT 1`,
        [secretHash],
      );
      const row = rowAt<SessionRow>(result.rows, 0);

      return row === undefined ? undefined : mapSessionRow(row);
    },
    touchSession: async (
      sessionId: string,
      lastSeenAt: string,
      idleExpiresAt: string,
      updatedAt: string,
    ): Promise<boolean> => {
      const result = await runtimeQuery(
        `UPDATE public.orgawork_sessions
            SET last_seen_at = GREATEST(last_seen_at, $2),
                idle_expires_at = LEAST(
                  absolute_expires_at,
                  GREATEST(idle_expires_at, $3)
                ),
                updated_at = GREATEST(updated_at, $4),
                version = version + 1
          WHERE id = $1
            AND status = 'active'`,
        [sessionId, lastSeenAt, idleExpiresAt, updatedAt],
      );

      return (result.rowCount ?? 0) === 1;
    },
    expireSession: async (
      sessionId: string,
      expectedVersion: number,
      now: string,
    ): Promise<boolean> => {
      const result = await runtimeQuery(
        `UPDATE public.orgawork_sessions
            SET status = 'expired',
                session_revision = session_revision + 1,
                revoked_at = $3,
                updated_at = $3,
                version = version + 1
          WHERE id = $1
            AND version = $2
            AND status = 'active'`,
        [sessionId, expectedVersion, now],
      );

      return (result.rowCount ?? 0) === 1;
    },
    revokeSession: async (
      sessionId: string,
      expectedVersion: number,
      now: string,
    ): Promise<boolean> => {
      const result = await runtimeQuery(
        `UPDATE public.orgawork_sessions
            SET status = 'revoked',
                session_revision = session_revision + 1,
                revoked_at = $3,
                updated_at = $3,
                version = version + 1
          WHERE id = $1
            AND version = $2
            AND status = 'active'`,
        [sessionId, expectedVersion, now],
      );

      return (result.rowCount ?? 0) === 1;
    },
    revokeAllUserSessions: async (userId: string, now: string): Promise<number> => {
      const result = await runtimeQuery(
        `UPDATE public.orgawork_sessions
            SET status = 'revoked',
                session_revision = session_revision + 1,
                revoked_at = $2,
                updated_at = $2,
                version = version + 1
          WHERE user_id = $1
            AND status = 'active'`,
        [userId, now],
      );

      return result.rowCount ?? 0;
    },
    readRateLimit: async (keyHash: string): Promise<AuthenticationRateLimitRecord | undefined> => {
      const result = await runtimeQuery(
        `SELECT failure_count, window_started_at, blocked_until
           FROM public.orgawork_login_rate_limits
          WHERE key_hash = $1`,
        [keyHash],
      );
      const row = rowAt<RateLimitRow>(result.rows, 0);

      return row === undefined ? undefined : mapRateLimitRow(row);
    },
    recordLoginFailure: async (
      keyHash: string,
      now: string,
      windowMilliseconds: number,
      failureLimit: number,
    ): Promise<AuthenticationRateLimitRecord> => {
      const result = await runtimeQuery(
        `INSERT INTO public.orgawork_login_rate_limits
           (
             key_hash,
             failure_count,
             window_started_at,
             blocked_until,
             created_at,
             updated_at
           )
         VALUES ($1, 1, $2, NULL, $2, $2)
         ON CONFLICT (key_hash)
         DO UPDATE SET
           failure_count = CASE
             WHEN EXCLUDED.updated_at - public.orgawork_login_rate_limits.window_started_at
                  >= ($3::bigint * interval '1 millisecond')
               THEN 1
             ELSE public.orgawork_login_rate_limits.failure_count + 1
           END,
           window_started_at = CASE
             WHEN EXCLUDED.updated_at - public.orgawork_login_rate_limits.window_started_at
                  >= ($3::bigint * interval '1 millisecond')
               THEN EXCLUDED.updated_at
             ELSE public.orgawork_login_rate_limits.window_started_at
           END,
           blocked_until = CASE
             WHEN (
               CASE
                 WHEN EXCLUDED.updated_at - public.orgawork_login_rate_limits.window_started_at
                      >= ($3::bigint * interval '1 millisecond')
                   THEN 1
                 ELSE public.orgawork_login_rate_limits.failure_count + 1
               END
             ) >= $4
               THEN EXCLUDED.updated_at + ($3::bigint * interval '1 millisecond')
             ELSE NULL
           END,
           updated_at = EXCLUDED.updated_at
         RETURNING failure_count, window_started_at, blocked_until`,
        [keyHash, now, windowMilliseconds, failureLimit],
      );
      const row = rowAt<RateLimitRow>(result.rows, 0);

      if (row === undefined) {
        throw new Error('ثبت محدودسازی ورود ناموفق بود.');
      }

      return mapRateLimitRow(row);
    },
    clearRateLimit: async (keyHash: string): Promise<void> => {
      await runtimeQuery('DELETE FROM public.orgawork_login_rate_limits WHERE key_hash = $1', [
        keyHash,
      ]);
    },
    createPasswordResetToken: async (input): Promise<void> => {
      await withRuntimeTransaction(access, async (transaction): Promise<void> => {
        await transaction.query(
          `UPDATE public.orgawork_password_reset_tokens
              SET status = 'revoked', consumed_at = $2
            WHERE user_id = $1 AND status = 'active'`,
          [input.userId, input.now],
        );
        await transaction.query(
          `INSERT INTO public.orgawork_password_reset_tokens
             (id, user_id, token_hash, status, expires_at, created_at)
           VALUES ($1, $2, $3, 'active', $4, $5)`,
          [input.id, input.userId, input.tokenHash, input.expiresAt, input.now],
        );
      });
    },
    consumePasswordResetToken: async (tokenHash: string, now: string) =>
      withRuntimeTransaction(access, async (transaction) => {
        const result = await transaction.query(
          `UPDATE public.orgawork_password_reset_tokens
              SET status = 'consumed', consumed_at = $2
            WHERE token_hash = $1
              AND status = 'active'
              AND expires_at > $2
          RETURNING id::text AS id, user_id::text AS user_id`,
          [tokenHash, now],
        );
        const row = rowAt<{ readonly id: string; readonly user_id: string }>(result.rows, 0);
        return row === undefined ? undefined : { id: row.id, userId: row.user_id };
      }),
  };
}

function authenticationError(code: AuthenticationErrorCode): AuthenticationError {
  const messages: Readonly<Record<AuthenticationErrorCode, string>> = {
    AUTH_INVALID_CREDENTIALS: 'ایمیل یا گذرواژه واردشده صحیح نیست.',
    AUTH_ACCOUNT_DISABLED: 'حساب کاربری امکان ورود ندارد.',
    AUTH_SESSION_REQUIRED: 'نشست معتبر لازم است.',
    AUTH_SESSION_EXPIRED: 'نشست منقضی شده است.',
    AUTH_SESSION_REVOKED: 'نشست لغو شده است.',
    AUTH_CSRF_INVALID: 'درخواست امنیتی معتبر نیست.',
    AUTH_PASSWORD_POLICY_FAILED: 'گذرواژه با سیاست امنیتی سامانه سازگار نیست.',
    AUTH_PASSWORD_RESET_INVALID: 'درخواست بازیابی گذرواژه معتبر نیست.',
    RATE_LIMITED: 'تعداد تلاش‌های ورود بیش از حد مجاز است.',
  };

  return new AuthenticationError(code, messages[code]);
}

function dateAt(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

function sessionView(record: AuthenticationSessionRecord): AuthenticationSessionView {
  return {
    id: record.id,
    userId: record.userId,
    email: record.userEmail,
    status: 'active',
    sessionRevision: record.sessionRevision,
    currentOrganizationId: record.currentOrganizationId,
    csrfToken: record.csrfToken,
    idleExpiresAt: record.idleExpiresAt,
    absoluteExpiresAt: record.absoluteExpiresAt,
  };
}

function rateLimitIdentity(clientAddress: string, normalizedEmail: string): string {
  return hashSecurityToken(clientAddress.trim() + '\u0000' + normalizedEmail);
}

function normalizeEmailForRateLimit(email: string): string {
  try {
    return normalizeLoginEmail(email);
  } catch {
    return '<invalid-email>';
  }
}

async function assertRateLimitAllowed(
  repository: AuthenticationRepository,
  keyHash: string,
  now: Date,
): Promise<void> {
  const current = await repository.readRateLimit(keyHash);

  if (
    current?.blockedUntil !== null &&
    current?.blockedUntil !== undefined &&
    new Date(current.blockedUntil).getTime() > now.getTime()
  ) {
    throw authenticationError('RATE_LIMITED');
  }
}

async function recordFailure(
  repository: AuthenticationRepository,
  keyHash: string,
  now: Date,
): Promise<void> {
  await repository.recordLoginFailure(
    keyHash,
    now.toISOString(),
    authenticationPolicy.loginFailureWindowMilliseconds,
    authenticationPolicy.loginFailureLimit,
  );
}

async function resolveActiveSession(
  dependencies: AuthenticationServiceDependencies,
  sessionSecret: string,
  touch: boolean,
): Promise<AuthenticationSessionRecord> {
  const secretHash = hashSecurityToken(sessionSecret);
  const record = await dependencies.repository.findSessionBySecretHash(secretHash);

  if (record === undefined) {
    throw authenticationError('AUTH_SESSION_REQUIRED');
  }

  if (record.status === 'revoked') {
    throw authenticationError('AUTH_SESSION_REVOKED');
  }

  if (record.status === 'expired') {
    throw authenticationError('AUTH_SESSION_EXPIRED');
  }

  const now = dependencies.now();
  const nowMilliseconds = now.getTime();
  const idleExpiry = new Date(record.idleExpiresAt).getTime();
  const absoluteExpiry = new Date(record.absoluteExpiresAt).getTime();

  if (nowMilliseconds >= idleExpiry || nowMilliseconds >= absoluteExpiry) {
    await dependencies.repository.expireSession(record.id, record.version, now.toISOString());
    throw authenticationError('AUTH_SESSION_EXPIRED');
  }

  if (record.userStatus !== 'active') {
    await dependencies.repository.revokeAllUserSessions(record.userId, now.toISOString());
    throw authenticationError('AUTH_SESSION_REVOKED');
  }

  if (!touch) {
    return record;
  }

  const nextIdleExpiry = Math.min(
    nowMilliseconds + authenticationPolicy.idleTimeoutMilliseconds,
    absoluteExpiry,
  );
  const touched = await dependencies.repository.touchSession(
    record.id,
    now.toISOString(),
    dateAt(nextIdleExpiry),
    now.toISOString(),
  );

  if (!touched) {
    throw authenticationError('AUTH_SESSION_REVOKED');
  }

  return {
    ...record,
    lastSeenAt: now.toISOString(),
    idleExpiresAt: dateAt(nextIdleExpiry),
    version: record.version + 1,
  };
}

function assertCsrf(record: AuthenticationSessionRecord, csrfToken: string): void {
  if (csrfToken === '' || !timingSafeTextEqual(record.csrfToken, csrfToken)) {
    throw authenticationError('AUTH_CSRF_INVALID');
  }
}

async function assertAcceptedPassword(
  password: string,
  checker: PasswordCompromiseChecker | undefined,
): Promise<void> {
  assertPasswordPolicy(password);

  if (checker !== undefined && (await checker.isCompromised(password))) {
    throw new PasswordSecurityError(
      'PASSWORD_COMPROMISED',
      'گذرواژه انتخاب‌شده در فهرست مقادیر افشاشده قرار دارد.',
    );
  }
}

export async function createAuthenticationService(
  options: CreateAuthenticationServiceOptions,
): Promise<AuthenticationService> {
  const passwordHasher = options.passwordHasher ?? createArgon2idPasswordHasher();
  const dummyPasswordHash =
    options.dummyPasswordHash ?? (await passwordHasher.hash(generateSecurityToken()));
  const dependencies: AuthenticationServiceDependencies = {
    repository: options.repository,
    passwordHasher,
    passwordCompromiseChecker: options.passwordCompromiseChecker,
    now: options.now ?? (() => new Date()),
    createId: options.createId ?? randomUUID,
    createSessionSecret: options.createSessionSecret ?? generateSecurityToken,
    createCsrfToken: options.createCsrfToken ?? generateSecurityToken,
    dummyPasswordHash,
  };

  return {
    setPasswordCredential: async (userId: string, password: string): Promise<void> => {
      try {
        await assertAcceptedPassword(password, dependencies.passwordCompromiseChecker);
      } catch (error: unknown) {
        if (error instanceof PasswordSecurityError) {
          throw authenticationError('AUTH_PASSWORD_POLICY_FAILED');
        }

        throw error;
      }

      const passwordHash = await dependencies.passwordHasher.hash(password);
      const now = dependencies.now().toISOString();

      await dependencies.repository.replacePasswordCredentialAndRevokeSessions(
        userId,
        passwordHash,
        now,
      );
    },
    login: async (input): Promise<AuthenticationLoginResult> => {
      const normalizedForLimit = normalizeEmailForRateLimit(input.email);
      const keyHash = rateLimitIdentity(input.clientAddress, normalizedForLimit);
      const now = dependencies.now();

      await assertRateLimitAllowed(dependencies.repository, keyHash, now);

      let normalizedEmail: string | undefined;

      try {
        normalizedEmail = normalizeLoginEmail(input.email);
      } catch {
        normalizedEmail = undefined;
      }

      const user =
        normalizedEmail === undefined
          ? undefined
          : await dependencies.repository.findUserCredentialByEmail(normalizedEmail);
      const encodedHash = user?.passwordHash ?? dependencies.dummyPasswordHash;
      const passwordValid = await dependencies.passwordHasher.verify(encodedHash, input.password);

      if (user === undefined || user.passwordHash === null || !passwordValid) {
        await recordFailure(dependencies.repository, keyHash, now);
        throw authenticationError('AUTH_INVALID_CREDENTIALS');
      }

      if (user.status !== 'active') {
        await recordFailure(dependencies.repository, keyHash, now);
        throw authenticationError('AUTH_ACCOUNT_DISABLED');
      }

      await dependencies.repository.clearRateLimit(keyHash);

      if (dependencies.passwordHasher.needsRehash(user.passwordHash)) {
        const replacement = await dependencies.passwordHasher.hash(input.password);
        await dependencies.repository.updatePasswordHash(
          user.id,
          user.passwordHash,
          replacement,
          now.toISOString(),
        );
      }

      const sessionSecret = dependencies.createSessionSecret();
      const csrfToken = dependencies.createCsrfToken();
      const absoluteExpiresAt = dateAt(
        now.getTime() + authenticationPolicy.absoluteTimeoutMilliseconds,
      );
      const idleExpiresAt = dateAt(now.getTime() + authenticationPolicy.idleTimeoutMilliseconds);
      const id = dependencies.createId();

      await dependencies.repository.createSession({
        id,
        userId: user.id,
        secretHash: hashSecurityToken(sessionSecret),
        csrfToken,
        createdAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        idleExpiresAt,
        absoluteExpiresAt,
      });

      return {
        sessionSecret,
        session: {
          id,
          userId: user.id,
          email: user.email,
          status: 'active',
          sessionRevision: 1,
          currentOrganizationId: null,
          csrfToken,
          idleExpiresAt,
          absoluteExpiresAt,
        },
      };
    },
    getSession: async (sessionSecret: string): Promise<AuthenticationSessionView> => {
      const record = await resolveActiveSession(dependencies, sessionSecret, true);
      return sessionView(record);
    },
    logout: async (sessionSecret: string, csrfToken: string): Promise<void> => {
      const record = await resolveActiveSession(dependencies, sessionSecret, false);
      assertCsrf(record, csrfToken);

      const revoked = await dependencies.repository.revokeSession(
        record.id,
        record.version,
        dependencies.now().toISOString(),
      );

      if (!revoked) {
        throw authenticationError('AUTH_SESSION_REVOKED');
      }
    },
    logoutAll: async (sessionSecret: string, csrfToken: string): Promise<number> => {
      const record = await resolveActiveSession(dependencies, sessionSecret, false);
      assertCsrf(record, csrfToken);

      return dependencies.repository.revokeAllUserSessions(
        record.userId,
        dependencies.now().toISOString(),
      );
    },
    requestPasswordReset: async (email: string): Promise<{ readonly token?: string }> => {
      let normalized: string | undefined;
      try {
        normalized = normalizeLoginEmail(email);
      } catch {
        normalized = undefined;
      }
      const user =
        normalized === undefined
          ? undefined
          : await dependencies.repository.findUserCredentialByEmail(normalized);
      if (user === undefined || user.status !== 'active') {
        await dependencies.passwordHasher.verify(
          dependencies.dummyPasswordHash,
          generateSecurityToken(),
        );
        return {};
      }
      const token = generateSecurityToken();
      const now = dependencies.now();
      await dependencies.repository.createPasswordResetToken({
        id: dependencies.createId(),
        userId: user.id,
        tokenHash: hashSecurityToken(token),
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        now: now.toISOString(),
      });
      return { token };
    },
    confirmPasswordReset: async (token: string, password: string): Promise<void> => {
      try {
        await assertAcceptedPassword(password, dependencies.passwordCompromiseChecker);
      } catch (error: unknown) {
        if (error instanceof PasswordSecurityError) {
          throw authenticationError('AUTH_PASSWORD_POLICY_FAILED');
        }
        throw error;
      }
      const now = dependencies.now();
      const consumed = await dependencies.repository.consumePasswordResetToken(
        hashSecurityToken(token),
        now.toISOString(),
      );
      if (consumed === undefined) {
        throw new AuthenticationError(
          'AUTH_PASSWORD_RESET_INVALID' as AuthenticationErrorCode,
          'درخواست بازیابی گذرواژه معتبر نیست.',
        );
      }
      const passwordHash = await dependencies.passwordHasher.hash(password);
      await dependencies.repository.replacePasswordCredentialAndRevokeSessions(
        consumed.userId,
        passwordHash,
        now.toISOString(),
      );
    },
  };
}
