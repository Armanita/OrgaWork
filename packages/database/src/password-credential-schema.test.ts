import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync('infra/migrations/0005_create-password-credentials.sql', 'utf8');

describe('Password credential PostgreSQL schema', () => {
  it('creates only the P2.4 password credential table', () => {
    expect(migration).toContain('CREATE TABLE public.orgawork_password_credentials');
    expect(migration).not.toContain('CREATE TABLE public.orgawork_sessions');
    expect(migration).not.toContain('CREATE TABLE public.orgawork_login_failures');
  });

  it('binds one credential to one user and removes it with the user', () => {
    expect(migration).toContain('user_id uuid PRIMARY KEY');
    expect(migration).toContain('REFERENCES public.orgawork_users (id)');
    expect(migration).toContain('ON DELETE CASCADE');
  });

  it('allows only Argon2id encoded hashes and valid versioned timestamps', () => {
    expect(migration).toContain("password_hash LIKE '$argon2id$%'");
    expect(migration).toContain('char_length(password_hash) BETWEEN 80 AND 512');
    expect(migration).toContain('CHECK (version > 0)');
    expect(migration).toContain('updated_at >= password_changed_at');
  });

  it('enforces immutable ownership and hash rotation', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.orgawork_validate_password_credential_update()',
    );
    expect(migration).toContain('NEW.version <> OLD.version + 1');
    expect(migration).toContain('NEW.password_hash = OLD.password_hash');
    expect(migration).toContain('CREATE TRIGGER orgawork_password_credentials_validate_update');
  });

  it('removes public access and grants only required runtime operations', () => {
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.orgawork_password_credentials FROM PUBLIC',
    );
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE');
    expect(migration).not.toContain('GRANT SELECT, INSERT, UPDATE, DELETE');
  });
});
