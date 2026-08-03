import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'infra/migrations/0004_create-identity-organization-schema.sql',
  'utf8',
);

describe('identity and organization PostgreSQL schema', () => {
  it('creates all P2.3 persistence tables without later-stage tables', () => {
    for (const table of [
      'orgawork_users',
      'orgawork_organizations',
      'orgawork_memberships',
      'orgawork_teams',
      'orgawork_team_memberships',
    ]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
    }

    expect(migration).not.toContain('orgawork_password_credentials');
    expect(migration).not.toContain('orgawork_sessions');
    expect(migration).not.toContain('orgawork_invitations');
  });

  it('maps the approved status and role values', () => {
    expect(migration).toContain("CHECK (status IN ('pending', 'active', 'disabled'))");
    expect(migration).toContain("CHECK (status IN ('invited', 'active', 'suspended', 'revoked'))");
    expect(migration).toContain("CHECK (role IN ('member', 'team_manager'))");
  });

  it('uses composite ownership constraints for tenant relations', () => {
    for (const marker of [
      'UNIQUE (organization_id, user_id)',
      'UNIQUE (id, organization_id)',
      'FOREIGN KEY (team_id, organization_id)',
      'REFERENCES public.orgawork_teams (id, organization_id)',
      'FOREIGN KEY (membership_id, organization_id)',
      'REFERENCES public.orgawork_memberships (id, organization_id)',
      'UNIQUE (team_id, membership_id)',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  it('enforces domain transitions and immutable ownership', () => {
    for (const functionName of [
      'orgawork_validate_user_update',
      'orgawork_validate_organization_update',
      'orgawork_validate_membership_update',
      'orgawork_validate_team_update',
      'orgawork_validate_team_membership',
    ]) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${functionName}()`);
    }

    expect(migration).toContain("OLD.status = 'invited' AND NEW.status IN ('active', 'revoked')");
    expect(migration).toContain("OLD.status = 'suspended' AND NEW.status IN ('active', 'revoked')");
    expect(migration).toContain("IF resolved_status <> 'active' THEN");
  });

  it('forces RLS on every organization-scoped table', () => {
    for (const table of [
      'orgawork_organizations',
      'orgawork_memberships',
      'orgawork_teams',
      'orgawork_team_memberships',
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
    }

    expect(migration).not.toContain('ALTER TABLE public.orgawork_users ENABLE ROW LEVEL SECURITY');
  });

  it('binds all tenant policies to the transaction-local organization', () => {
    expect(migration.match(/public\.orgawork_current_organization_id\(\)/gu)).toHaveLength(8);

    for (const policy of [
      'orgawork_organizations_organization_policy',
      'orgawork_memberships_organization_policy',
      'orgawork_teams_organization_policy',
      'orgawork_team_memberships_organization_policy',
    ]) {
      expect(migration).toContain(`CREATE POLICY ${policy}`);
      expect(migration).toContain('TO orgawork_runtime');
    }
  });

  it('grants runtime access explicitly and removes public access', () => {
    for (const table of [
      'orgawork_users',
      'orgawork_organizations',
      'orgawork_memberships',
      'orgawork_teams',
      'orgawork_team_memberships',
    ]) {
      expect(migration).toContain(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC`);
      expect(migration).toContain(`ON TABLE public.${table}\n  TO orgawork_runtime`);
    }
  });
});
