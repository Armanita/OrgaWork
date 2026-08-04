import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const organizationLookupMigration = readFileSync(
  'infra/migrations/0008_fix-organization-user-lookup-policy.sql',
  'utf8',
);
const rolePermissionGrantMigration = readFileSync(
  'infra/migrations/0009_grant-role-permission-catalog-read.sql',
  'utf8',
);

describe('P2 organization user lookup policy repair', () => {
  it('qualifies the outer organization identifier explicitly', () => {
    expect(organizationLookupMigration).toContain(
      'membership.organization_id = orgawork_organizations.id',
    );
    expect(organizationLookupMigration).not.toMatch(
      /membership\.organization_id\s*=\s*id(?:\s|$)/u,
    );
  });

  it('replaces only the user lookup policy for active memberships', () => {
    expect(organizationLookupMigration).toContain(
      'DROP POLICY IF EXISTS orgawork_organizations_user_lookup_policy',
    );
    expect(organizationLookupMigration).toContain(
      'CREATE POLICY orgawork_organizations_user_lookup_policy',
    );
    expect(organizationLookupMigration).toContain("membership.status = 'active'");
    expect(organizationLookupMigration).toContain(
      'membership.user_id = public.orgawork_current_user_id()',
    );
  });

  it('grants runtime read access to the static role permission catalog', () => {
    expect(rolePermissionGrantMigration).toContain(
      'REVOKE ALL ON TABLE public.orgawork_role_permissions FROM PUBLIC',
    );
    expect(rolePermissionGrantMigration).toMatch(
      /GRANT\s+SELECT\s+ON TABLE public\.orgawork_role_permissions\s+TO orgawork_runtime/u,
    );
    expect(rolePermissionGrantMigration).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|DELETE)/u);
  });
});
