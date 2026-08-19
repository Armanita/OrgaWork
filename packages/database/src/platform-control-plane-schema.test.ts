import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('infra/migrations/0011_create-platform-control-plane.sql', 'utf8');
const managementMigration = readFileSync(
  'infra/migrations/0012_extend-platform-control-plane-management.sql',
  'utf8',
);

describe('OA Platform Control Plane PostgreSQL schema', () => {
  it('creates global authority, audit and idempotency outside tenant membership', () => {
    for (const table of [
      'orgawork_platform_operators',
      'orgawork_platform_provisioning_audit',
      'orgawork_platform_idempotency',
    ]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
    }
    expect(migration).toContain('user_id uuid PRIMARY KEY');
    expect(migration).not.toContain('INSERT INTO public.orgawork_membership_roles');
  });

  it('removes historical platform_operator tenant role allowance and tightens invitations', () => {
    expect(migration).toContain("CHECK (role_key IN ('member', 'manager', 'organization_admin'))");
    expect(migration).toContain("CHECK (role_key IN ('member', 'manager'))");
    expect(migration).toContain("WHERE role_key = 'platform_operator'");
    expect(migration).toContain("WHERE role_key = 'organization_admin'");
  });

  it('keeps platform data under FORCE RLS and runtime least privilege', () => {
    for (const table of [
      'orgawork_platform_operators',
      'orgawork_platform_provisioning_audit',
      'orgawork_platform_idempotency',
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC`);
    }
    expect(migration).not.toContain('BYPASSRLS');
    expect(migration).not.toContain('orgawork_app_runtime');
    expect(migration).not.toMatch(/GRANT\s+UPDATE[\s\S]*orgawork_platform_provisioning_audit/iu);
    expect(migration).not.toMatch(/GRANT\s+DELETE[\s\S]*orgawork_platform_provisioning_audit/iu);
  });

  it('uses a narrow transaction-local platform target rather than tenant context', () => {
    expect(migration).toContain('orgawork.platform_target_organization_id');
    expect(migration).toContain('orgawork_current_platform_target_organization_id');
    expect(migration).toContain('orgawork_organizations_platform_target_insert');
    expect(migration).toContain('orgawork_memberships_platform_target_insert');
    expect(migration).toContain('orgawork_membership_roles_platform_target_insert');
    expect(migration).not.toContain("set_config('orgawork.organization_id'");
  });

  it('does not grant platform policies on Work Management content', () => {
    for (const table of [
      'orgawork_cases',
      'orgawork_case_responsibilities',
      'orgawork_actions',
      'orgawork_case_current_work',
    ]) {
      expect(migration).not.toContain(`ON public.${table}`);
    }
  });

  it('stores replay-safe global idempotency keyed by actor and operation', () => {
    expect(migration).toContain('PRIMARY KEY (actor_user_id, operation, idempotency_key)');
    expect(migration).toContain("request_fingerprint ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain("idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'");
  });

  it('delegates the transaction boundary to the tracked migration runner', () => {
    expect(migration).not.toMatch(/^\s*(?:BEGIN|COMMIT);\s*$/imu);
  });

  it('extends only explicit Platform management metadata paths', () => {
    for (const action of ['organization.rename', 'organization_admin.revoke']) {
      expect(managementMigration).toContain(action);
    }
    for (const policy of [
      'orgawork_platform_audit_active_operator_select_all',
      'orgawork_organizations_platform_operator_list_select',
      'orgawork_organizations_platform_target_update',
      'orgawork_memberships_platform_target_update',
    ]) {
      expect(managementMigration).toContain(policy);
    }
    expect(managementMigration).not.toContain('ON public.orgawork_cases');
    expect(managementMigration).not.toContain('BYPASSRLS');
  });
});
