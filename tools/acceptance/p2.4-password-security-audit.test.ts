import { describe, expect, it } from 'vitest';

import { inspectP24PasswordSecurity } from './p2.4-password-security-audit.js';

describe('P2.4 password security acceptance', () => {
  it('accepts the technical implementation after stage closure', () => {
    const report = inspectP24PasswordSecurity(
      process.cwd(),
      'closed',
      new Date('2026-08-04T08:00:00.000Z'),
    );

    expect(report.issues).toEqual([]);
    expect(report.migrationVersion).toBe(5);
    expect(report.argon2MemoryMiB).toBe(32);
    expect(report.argon2TimeCost).toBe(3);
    expect(report.argon2Parallelism).toBe(1);
    expect(report.evidenceCount).toBe(35);
  }, 30_000);

  it('keeps session and CSRF persistence outside P2.4', async () => {
    const { readFile } = await import('node:fs/promises');
    const migration = await readFile(
      'infra/migrations/0005_create-password-credentials.sql',
      'utf8',
    );

    expect(migration).not.toContain('orgawork_sessions');
    expect(migration).not.toContain('csrf_token_hash');
    expect(migration).not.toContain('orgawork_login_failures');
  });

  it('records the measured profile rather than the minimum floor', () => {
    const report = inspectP24PasswordSecurity(
      process.cwd(),
      'pre',
      new Date('2026-08-04T08:00:00.000Z'),
    );

    expect(report.argon2MemoryMiB).toBeGreaterThan(19);
    expect(report.argon2TimeCost).toBeGreaterThan(2);
  }, 30_000);
});
