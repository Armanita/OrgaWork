import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { inspectArchitecture } from './architecture-policy.js';
import { inspectRepositorySecurity } from './repository-security.js';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('P2R login, recovery, and organization selection', () => {
  it('redesigns sign-in with shared primitives while preserving the login contract', () => {
    const login = read('apps/web/app/login/page.tsx');
    const shell = read('apps/web/components/auth-page-shell.tsx');
    const password = read('apps/web/components/password-field.tsx');

    expect(login).toContain("identityRequest('auth/login'");
    expect(login).toContain("window.location.assign('/organization')");
    expect(login).toContain('autoComplete="email"');
    expect(login).toContain('autoComplete="current-password"');
    expect(login).toContain('minLength={15}');
    expect(login).toContain('<AuthPageShell');
    expect(login).toContain('<PasswordField');
    expect(shell).toContain('auth-experience__visual');
    expect(password).toContain("visible ? 'text' : 'password'");
    expect(password).toContain('aria-pressed={visible}');
  });

  it('provides complete password reset request and confirmation routes', () => {
    const requestPage = read('apps/web/app/login/reset/page.tsx');
    const confirmPage = read('apps/web/app/login/reset/confirm/page.tsx');
    const confirmForm = read('apps/web/components/password-reset-confirm-form.tsx');
    const proxy = read('apps/web/app/api/identity/[...path]/route.ts');

    expect(requestPage).toContain("'auth/password-reset/request'");
    expect(requestPage).toContain('developmentToken');
    expect(requestPage).toContain('/login/reset/confirm?token=');
    expect(confirmPage).toContain('searchParams: Promise');
    expect(confirmPage).toContain('<PasswordResetConfirmForm');
    expect(confirmForm).toContain("'auth/password-reset/confirm'");
    expect(confirmForm).toContain('password !== confirmation');
    expect(confirmForm).toContain('minLength={15}');
    expect(proxy).toContain("'auth/password-reset/request'");
    expect(proxy).toContain("'auth/password-reset/confirm'");
  });

  it('loads real session and organization data without sample organizations', () => {
    const organization = read('apps/web/app/organization/page.tsx');

    expect(organization).toContain('Promise.all([');
    expect(organization).toContain("'auth/session'");
    expect(organization).toContain("'organizations'");
    expect(organization).toContain('session.currentOrganizationId');
    expect(organization).toContain("'x-csrf-token': session.csrfToken");
    expect(organization).toContain("window.location.assign('/');");
    expect(organization).not.toContain('Sample organization');
    expect(organization).not.toContain('سازمان نمونه');
  });

  it('implements localized loading, error, current, and submitting states', () => {
    const English = read('apps/web/messages/en.json');
    const Persian = read('apps/web/messages/fa.json');
    const organization = read('apps/web/app/organization/page.tsx');

    for (const marker of [
      '"authExperience"',
      '"passwordReset"',
      '"showPassword"',
      '"hidePassword"',
      '"loading"',
      '"currentBadge"',
      '"selecting"',
      '"organizationCount"',
      '"passwordResetRequestFailed"',
      '"passwordResetConfirmFailed"',
    ]) {
      expect(English).toContain(marker);
      expect(Persian).toContain(marker);
    }

    expect(organization).toContain('organization-card--loading');
    expect(organization).toContain('aria-live="polite"');
    expect(organization).toContain('disabled={selectingId !== undefined}');
  });

  it('uses responsive logical styling for both LTR and RTL', () => {
    const styles = read('apps/web/app/globals.css');

    expect(styles).toContain('.auth-experience');
    expect(styles).toContain('.organization-selection');
    expect(styles).toContain('inset-inline-end');
    expect(styles).toContain('padding-inline');
    expect(styles).toContain('@media (max-width: 960px)');
    expect(styles).toContain('@media (max-width: 720px)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('excludes template authentication, social login, demo data, and browser storage', () => {
    const files = [
      'apps/web/app/login/page.tsx',
      'apps/web/app/login/reset/page.tsx',
      'apps/web/app/login/reset/confirm/page.tsx',
      'apps/web/components/password-reset-confirm-form.tsx',
      'apps/web/app/organization/page.tsx',
      'apps/web/components/auth-page-shell.tsx',
      'apps/web/components/password-field.tsx',
    ];

    for (const file of files) {
      const source = read(file);

      for (const forbidden of [
        'Clerk',
        'Vercel Analytics',
        'Sign in with Google',
        'Sign in with X',
        'demo@gmail.com',
        'localStorage',
        'sessionStorage',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('preserves architecture, repository security, and the shared UI boundary', () => {
    const uiIndex = read('packages/ui/src/index.ts');

    for (const icon of ['Check', 'Eye', 'EyeOff', 'LoaderCircle', 'LockKeyhole', 'Mail']) {
      expect(uiIndex).toContain(icon);
    }

    expect(inspectArchitecture(process.cwd()).issues).toEqual([]);
    expect(inspectRepositorySecurity(process.cwd()).issues).toEqual([]);
  });
});
