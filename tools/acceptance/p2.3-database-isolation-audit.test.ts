import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { inspectP23DatabaseIsolation, type P23AuditMode } from './p2.3-database-isolation-audit.js';

function currentMode(): P23AuditMode {
  const roadmap = readFileSync(resolve(process.cwd(), 'docs/ROADMAP.md'), 'utf8');

  return roadmap.includes('- [x] P2.3 ') ? 'closed' : 'pre';
}

describe('P2.3 database isolation acceptance', () => {
  it('accepts the current repository state without hidden issues', () => {
    const report = inspectP23DatabaseIsolation(
      process.cwd(),
      currentMode(),
      new Date('2026-08-03T00:00:00.000Z'),
    );

    expect(report.issues).toEqual([]);
    expect(report.migrationVersion).toBe(4);
    expect(report.tenantTables).toBe(4);
    expect(report.evidenceCount).toBe(report.mode === 'closed' ? 33 : 32);
  }, 30_000);

  it('keeps later authentication persistence outside P2.3', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'infra/migrations/0004_create-identity-organization-schema.sql'),
      'utf8',
    );

    expect(migration).not.toContain('orgawork_password_credentials');
    expect(migration).not.toContain('orgawork_sessions');
    expect(migration).not.toContain('orgawork_invitations');
  });

  it('requires transaction-local tenant isolation', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'infra/migrations/0004_create-identity-organization-schema.sql'),
      'utf8',
    );

    expect(migration).toContain('public.orgawork_current_organization_id()');
    expect(migration).toContain('FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('FOREIGN KEY (membership_id, organization_id)');
  });
});
