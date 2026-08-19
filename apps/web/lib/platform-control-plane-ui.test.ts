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
});
