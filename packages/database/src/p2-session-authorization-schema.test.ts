import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sessionMigration = readFileSync(
  'infra/migrations/0006_create-session-and-organization-context.sql',
  'utf8',
);
const authorizationMigration = readFileSync(
  'infra/migrations/0007_create-authorization-and-administration.sql',
  'utf8',
);

describe('P2 session and authorization migrations', () => {
  it('stores only the session-secret hash and bounded expiry', () => {
    expect(sessionMigration).toContain(
      "secret_hash text NOT NULL UNIQUE CHECK (secret_hash ~ '^[0-9a-f]{64}$')",
    );
    expect(sessionMigration).toContain("absolute_expires_at <= created_at + interval '7 days'");
    expect(sessionMigration).not.toContain('JWT');
  });
  it('stores current organization and session revision server side', () => {
    expect(sessionMigration).toContain('current_organization_id uuid NULL');
    expect(sessionMigration).toContain('session_revision integer NOT NULL DEFAULT 1');
  });
  it('gives explicit denials and invitation tokens persistent structures', () => {
    expect(authorizationMigration).toContain('CREATE TABLE public.orgawork_explicit_denials');
    expect(authorizationMigration).toContain('CREATE TABLE public.orgawork_invitations');
    expect(authorizationMigration).toContain(
      "token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$')",
    );
  });
});
