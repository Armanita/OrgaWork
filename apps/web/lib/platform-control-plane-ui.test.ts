import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OA Platform Control Plane web UI', () => {
  it('routes an authenticated global platform operator to /platform after login', () => {
    const login = readFileSync('apps/web/app/login/page.tsx', 'utf8');
    expect(login).toContain("platformRequest('session')");
    expect(login).toContain("window.location.assign('/platform')");
    expect(login).toContain("window.location.assign('/organization')");
  });

  it('exposes organization and administrator management plus platform audit through the web proxy', () => {
    const proxy = readFileSync('apps/web/app/api/platform/[...path]/route.ts', 'utf8');
    const page = readFileSync('apps/web/app/platform/page.tsx', 'utf8');
    expect(proxy).toContain('idempotency-key');
    expect(proxy).toContain('/v1/platform/');
    expect(page).toContain("platformRequest<OrganizationResult>('organizations'");
    expect(page).toContain('/admins');
    expect(page).toContain('/api/identity/auth/logout');
    expect(page).toContain('oa-admin-revoke');
    expect(page).toContain('platformRequest<{ readonly audit:');
  });

  it('renders public dates with the Persian calendar while keeping technical time UTC', () => {
    const page = readFileSync('apps/web/app/platform/page.tsx', 'utf8');
    expect(page).toContain("'fa-IR-u-ca-persian'");
    expect(page).toContain("'en-US-u-ca-persian'");
    expect(page).toContain("timeZone: 'UTC'");
  });

  it('removes organization_admin from tenant role mutation controls', () => {
    const members = readFileSync('apps/web/app/organization/members/page.tsx', 'utf8');
    const editor = readFileSync('apps/web/components/member-access-editor.tsx', 'utf8');
    expect(members).not.toContain('<option value="organization_admin">');
    expect(editor).toContain('readonly OrganizationRoleKey[]');
    expect(editor).toContain('TenantAssignableOrganizationRoleKey');
    expect(editor).toContain("roleKeys.includes('organization_admin')");
    expect(editor).toContain('roleKeys.filter(isTenantAssignableRole)');
    expect(editor).toContain("messages('organizationAdminPlatformManaged')");
  });

  it('keeps Persian and English Platform Control Plane namespaces aligned', () => {
    const fa = JSON.parse(readFileSync('apps/web/messages/fa.json', 'utf8')) as Record<
      string,
      unknown
    >;
    const en = JSON.parse(readFileSync('apps/web/messages/en.json', 'utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(fa['platformControlPlane'] as object).sort()).toEqual(
      Object.keys(en['platformControlPlane'] as object).sort(),
    );
  });

  it('rejects dot characters in next-intl message object keys', () => {
    function findDottedKeys(value: unknown, prefix = ''): string[] {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return [];
      }

      const dotted: string[] = [];
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        if (key.includes('.')) {
          dotted.push(path);
        }
        dotted.push(...findDottedKeys(child, path));
      }
      return dotted;
    }

    const fa = JSON.parse(readFileSync('apps/web/messages/fa.json', 'utf8')) as Record<
      string,
      unknown
    >;
    const en = JSON.parse(readFileSync('apps/web/messages/en.json', 'utf8')) as Record<
      string,
      unknown
    >;

    expect(findDottedKeys(fa)).toEqual([]);
    expect(findDottedKeys(en)).toEqual([]);

    const faPlatform = fa['platformControlPlane'] as Record<string, unknown>;
    const enPlatform = en['platformControlPlane'] as Record<string, unknown>;
    const faActions = faPlatform['actions'] as Record<string, unknown>;
    const enActions = enPlatform['actions'] as Record<string, unknown>;

    expect(typeof (faActions['organization'] as Record<string, unknown>)['create']).toBe('string');
    expect(typeof (faActions['organization_admin'] as Record<string, unknown>)['provision']).toBe(
      'string',
    );
    expect(typeof (enActions['organization'] as Record<string, unknown>)['create']).toBe('string');
    expect(typeof (enActions['organization_admin'] as Record<string, unknown>)['provision']).toBe(
      'string',
    );
  });

  it('organizes the Platform Console into isolated professional workspaces', () => {
    const page = readFileSync('apps/web/app/platform/page.tsx', 'utf8');
    const css = readFileSync('apps/web/app/globals.css', 'utf8');

    expect(page).toContain(
      "type PlatformSection = 'overview' | 'organizations' | 'administration' | 'audit'",
    );
    expect(page).toContain("React.useState<PlatformSection>('overview')");
    expect(page).toContain('platform-console__sidebar');
    expect(page).toContain("hidden={activeSection !== 'organizations'}");
    expect(page).toContain(
      "activeSection === 'administration' && selectedOrganization !== undefined && (",
    );
    expect(page).toContain("hidden={activeSection !== 'audit'}");
    expect(page).toContain("setSelectedOrganizationId('')");
    expect(page).not.toContain("result.organizations[0]?.id ?? ''");
    expect(page).not.toContain(
      "setSelectedOrganizationId(organizationData.organizations[0]?.id ?? '')",
    );
    expect(page).toContain('platform-audit-summary');
    expect(page).toContain('platform-audit-details');
    expect(css).toContain('ORGAWORK:OA-PLATFORM-PROFESSIONAL-WORKSPACE-V2');
    expect(css).toContain('.platform-console__layout');
    expect(css).toContain('.platform-console__nav');
  });

  it('keeps the Platform sidebar physically right in RTL and consolidates operator actions', () => {
    const page = readFileSync('apps/web/app/platform/page.tsx', 'utf8');
    const css = readFileSync('apps/web/app/globals.css', 'utf8');

    expect(page).toContain('ORGAWORK_PLATFORM_SIDEBAR_ACCOUNT_V3');
    expect(page).toContain('platform-console__sidebar-account');
    expect(page).toContain('platform-console__logout');
    expect(page).toContain('platform-console__workspace-heading');
    expect(page).toContain('platform-audit-center');
    expect(page).not.toContain('className="organization-selection__account"');

    expect(css).toContain('ORGAWORK:OA-PLATFORM-RTL-LAYOUT-REPORT-CENTER-V3');
    expect(css).toContain('direction: ltr');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) 304px');
    expect(css).toContain('.platform-console__sidebar');
    expect(css).toContain('grid-column: 2');
    expect(css).toContain('.platform-console__workspace');
    expect(css).toContain('grid-column: 1');
    expect(css).toContain('.platform-audit-center .management-table thead th');
  });
});
