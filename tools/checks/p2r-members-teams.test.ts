import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { inspectArchitecture } from './architecture-policy.js';
import { inspectRepositorySecurity } from './repository-security.js';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('P2R members, invitations, and teams management', () => {
  it('redesigns members through the shared dashboard shell and real contracts', () => {
    const page = read('apps/web/app/organization/members/page.tsx');

    expect(page).toContain('<DashboardShell>');
    expect(page).toContain("'auth/session'");
    expect(page).toContain('`organizations/${organizationId}/memberships`');
    expect(page).toContain("'x-csrf-token': sessionData.session.csrfToken");
    expect(page).toContain("'x-csrf-token': session.csrfToken");
    expect(page).toContain("method: 'POST'");
    expect(page).toContain("method: 'PATCH'");
    expect(page).toContain('/memberships/${memberId}/roles');
    expect(page).toContain("typeof value === 'string'");
    expect(page).toContain('<MemberAccessEditor');
  });

  it('supports status and multi-role updates without weakening role constraints', () => {
    const editor = read('apps/web/components/member-access-editor.tsx');

    expect(editor).toContain('type MembershipStatus =');
    expect(editor).toContain('type OrganizationRoleKey =');
    expect(editor).toContain('selectedRoles.length === 0');
    expect(editor).toContain('checked={selectedRoles.includes(role)}');
    expect(editor).toContain('onStatusChange');
    expect(editor).toContain('onRolesChange');
    expect(editor).toContain("aria-label={messages('statusEditor')}");
  });

  it('completes invitation acceptance with session and CSRF protection', () => {
    const page = read('apps/web/app/invitations/[token]/page.tsx');
    const proxy = read('apps/web/app/api/identity/[...path]/route.ts');

    expect(page).toContain("'auth/session'");
    expect(page).toContain('`invitations/${encodeURIComponent(params.token)}/accept`');
    expect(page).toContain("'x-csrf-token': sessionData.session.csrfToken");
    expect(page).toContain("method: 'POST'");
    expect(page).not.toContain('localStorage');
    expect(page).not.toContain('sessionStorage');
    expect(proxy).toContain('invitationAcceptPattern');
  });

  it('redesigns team creation, search, and rename with real CSRF contracts', () => {
    const page = read('apps/web/app/organization/teams/page.tsx');
    const rename = read('apps/web/components/team-rename-form.tsx');

    expect(page).toContain('<DashboardShell>');
    expect(page).toContain('`organizations/${organizationId}/teams`');
    expect(page).toContain("'x-csrf-token': sessionData.session.csrfToken");
    expect(page).toContain("'x-csrf-token': session.csrfToken");
    expect(page).toContain("method: 'POST'");
    expect(page).toContain("method: 'PATCH'");
    expect(page).toContain('<TeamRenameForm');
    expect(rename).toContain('name.trim()');
    expect(rename).toContain('maxLength={120}');
  });

  it('uses real current-organization data in the dashboard shell', () => {
    const shell = read('apps/web/components/dashboard-shell.tsx');
    const header = read('apps/web/components/dashboard-header.tsx');
    const sidebar = read('apps/web/components/dashboard-sidebar.tsx');

    expect(shell).toContain("identityRequest<{ readonly session: WebSession }>('auth/session')");
    expect(shell).toContain("'organizations'");
    expect(shell).toContain('sessionData.session.currentOrganizationId');
    expect(header).toContain("organizationName ?? common('organizationUnavailable')");
    expect(sidebar).toContain("organizationName ?? common('organizationUnavailable')");
    expect(header).not.toContain("common('sampleOrganization')");
    expect(sidebar).not.toContain("common('sampleOrganization')");
  });

  it('keeps dashboard controls inside dashboard routes only', () => {
    const frame = read('apps/web/components/application-frame.tsx');

    expect(frame).toContain("pathname.startsWith('/organization/members')");
    expect(frame).toContain("pathname.startsWith('/organization/teams')");
    expect(frame).toContain('isDashboardRoute(pathname)');
  });

  it('provides complete English and Persian management copy', () => {
    const English = read('apps/web/messages/en.json');
    const Persian = read('apps/web/messages/fa.json');

    for (const marker of [
      '"memberCount"',
      '"manageAccess"',
      '"saveStatus"',
      '"saveRoles"',
      '"invitationDevelopmentLink"',
      '"teamCount"',
      '"renameAction"',
      '"renameSuccess"',
      '"invitationAcceptance"',
      '"invitationAcceptFailed"',
    ]) {
      expect(English).toContain(marker);
      expect(Persian).toContain(marker);
    }
  });

  it('uses responsive logical styling for tables, cards, and forms', () => {
    const styles = read('apps/web/app/globals.css');

    expect(styles).toContain('/* P2R.1.6 organization administration */');
    expect(styles).toContain('.management-page');
    expect(styles).toContain('.management-table td::before');
    expect(styles).toContain('.team-management-grid');
    expect(styles).toContain('padding-inline-start');
    expect(styles).toContain('inset-inline-start');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('excludes template brands, demo accounts, and browser storage', () => {
    const files = [
      'apps/web/app/organization/members/page.tsx',
      'apps/web/app/organization/teams/page.tsx',
      'apps/web/app/invitations/[token]/page.tsx',
      'apps/web/components/member-access-editor.tsx',
      'apps/web/components/team-rename-form.tsx',
      'apps/web/components/management-page-header.tsx',
    ];

    for (const file of files) {
      const source = read(file);

      for (const forbidden of [
        'Clerk',
        'Vercel Analytics',
        'Studio Admin',
        'Kiranism',
        'TailAdmin',
        'demo@gmail.com',
        'localStorage',
        'sessionStorage',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('preserves architecture, repository security, and shared UI exports', () => {
    const uiIndex = read('packages/ui/src/index.ts');

    for (const icon of ['MailPlus', 'Pencil', 'Plus', 'RefreshCw', 'Search', 'UserRoundCheck']) {
      expect(uiIndex).toContain(icon);
    }

    expect(inspectArchitecture(process.cwd()).issues).toEqual([]);
    expect(inspectRepositorySecurity(process.cwd()).issues).toEqual([]);
  });
});
