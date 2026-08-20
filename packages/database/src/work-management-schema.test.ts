import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'infra/migrations/0010_create-work-management-foundation.sql',
  'utf8',
);

describe('Work Management PostgreSQL schema', () => {
  it('creates only canonical prefixed P3.2 tables', () => {
    for (const table of [
      'orgawork_cases',
      'orgawork_case_responsibilities',
      'orgawork_actions',
      'orgawork_case_current_work',
      'orgawork_idempotency_records',
    ]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
    }

    expect(migration).not.toMatch(/CREATE TABLE public\.(cases|case_assignments|action_items)\b/u);
  });

  it('uses composite organization ownership for every cross-tenant relation', () => {
    for (const marker of [
      'FOREIGN KEY (created_by_membership_id, organization_id)',
      'REFERENCES public.orgawork_memberships (id, organization_id)',
      'FOREIGN KEY (case_id, organization_id)',
      'REFERENCES public.orgawork_cases (id, organization_id)',
      'FOREIGN KEY (target_team_id, organization_id)',
      'REFERENCES public.orgawork_teams (id, organization_id)',
      'FOREIGN KEY (source_responsibility_id, case_id, organization_id)',
      'REFERENCES public.orgawork_case_responsibilities (id, case_id, organization_id)',
      'FOREIGN KEY (action_id, case_id, organization_id)',
      'REFERENCES public.orgawork_actions (id, case_id, organization_id)',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  it('enforces one active primary responsibility, action and current work', () => {
    expect(migration).toContain('orgawork_case_responsibilities_active_primary_unique');
    expect(migration).toContain("WHERE role = 'primary' AND status IN ('pending', 'accepted')");
    expect(migration).toContain('orgawork_actions_active_primary_unique');
    expect(migration).toContain("WHERE kind = 'primary' AND status IN ('pending', 'in_progress')");
    expect(migration).toContain('orgawork_case_current_work_active_unique');
    expect(migration).toContain('WHERE ended_at IS NULL');
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain('orgawork_validate_work_management_case_invariants');
  });

  it('keeps Work Management current work limited to action or responsibility acceptance', () => {
    expect(migration).toContain("kind = 'action'");
    expect(migration).toContain("kind = 'responsibility_acceptance'");
    expect(migration).not.toContain("kind = 'internal_wait'");
    expect(migration).not.toContain("kind = 'external_wait'");
    expect(migration).not.toContain("kind = 'blocked'");
    expect(migration).not.toContain("kind = 'paused'");
    expect(migration).not.toContain("kind = 'decision_request'");
  });

  it('enforces organization-scoped replay-safe idempotency storage', () => {
    expect(migration).toContain('PRIMARY KEY (organization_id, operation, idempotency_key)');
    expect(migration).toContain("request_fingerprint ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain("idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'");
    expect(migration).toContain("state IN ('in_progress', 'completed')");
    expect(migration).toContain('request_id uuid NOT NULL');
    expect(migration).toContain('correlation_id uuid NOT NULL');
  });

  it('uses FORCE RLS and the canonical runtime tenant context on every Work Management table', () => {
    for (const table of [
      'orgawork_cases',
      'orgawork_case_responsibilities',
      'orgawork_actions',
      'orgawork_case_current_work',
      'orgawork_idempotency_records',
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC`);
    }

    expect(migration).toContain('TO orgawork_runtime');
    expect(migration).toContain('organization_id = public.orgawork_current_organization_id()');
    expect(migration).not.toContain('orgawork_app_runtime');
  });

  it('keeps runtime table privileges least-privilege without DELETE', () => {
    for (const table of [
      'orgawork_cases',
      'orgawork_case_responsibilities',
      'orgawork_actions',
      'orgawork_case_current_work',
      'orgawork_idempotency_records',
    ]) {
      expect(migration).toContain(
        `GRANT SELECT, INSERT, UPDATE\n  ON TABLE public.${table}\n  TO orgawork_runtime`,
      );
    }

    expect(migration).not.toMatch(
      /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE[\s\S]*?TO orgawork_runtime/u,
    );
  });

  it('grants CreateOwnCase only to business member and manager roles', () => {
    expect(migration).toContain("('member', 'case.create_self')");
    expect(migration).toContain("('manager', 'case.create_self')");
    expect(migration).not.toContain("('organization_admin', 'case.create_self')");
    expect(migration).not.toContain("('platform_operator', 'case.create_self')");
  });
});
