import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { inspectArchitecture } from './architecture-policy.js';
import { inspectRepositorySecurity } from './repository-security.js';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('P2R accessibility, responsive, theme, and direction gates', () => {
  it('pins browser accessibility tooling and a dedicated command', () => {
    const packageDocument = JSON.parse(read('package.json')) as Readonly<{
      devDependencies?: Readonly<Record<string, string>>;
      scripts?: Readonly<Record<string, string>>;
    }>;

    const playwrightVersion = packageDocument.devDependencies?.['@playwright/test'];
    const axeVersion = packageDocument.devDependencies?.['@axe-core/playwright'];

    expect(playwrightVersion).toMatch(/^\d+\.\d+\.\d+$/u);
    expect(axeVersion).toMatch(/^\d+\.\d+\.\d+$/u);
    expect(packageDocument.scripts?.['test:p2r:browser']).toBe(
      'playwright test --config playwright.config.ts',
    );
  });

  it('uses installed Chrome without downloading browser binaries', () => {
    const config = read('playwright.config.ts');

    expect(config).toContain("testMatch: '**/*.pw.ts'");
    expect(config).toContain("channel: 'chrome'");
    expect(config).toContain('workers: 1');
    expect(config).toContain("outputDir: 'node_modules/.cache/orgawork-playwright'");
    expect(config).toContain('webServer: [');
    expect(config).toContain("command: 'node tools/browser/p2r-api-stub.mjs'");
    expect(config).toContain(
      "'pnpm --filter @workspace/web start --hostname 127.0.0.1 --port 3217'",
    );
    expect(config).toContain('ORGAWORK_API_INTERNAL_URL: apiStubUrl');
  });

  it('covers WCAG, responsive overflow, locale, theme, and reduced motion', () => {
    const browserTest = read('tools/browser/p2r-accessibility-responsive.pw.ts');

    expect(browserTest).toContain("from '@axe-core/playwright'");
    expect(browserTest).toContain("withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])");
    expect(browserTest).toContain('const locales = [');
    expect(browserTest).toContain("const themes = ['light', 'dark']");
    expect(browserTest).toContain('scrollWidth');
    expect(browserTest).toContain("reducedMotion: 'reduce'");
    expect(browserTest).toContain("window.localStorage.setItem('theme'");
    const apiStub = read('tools/browser/p2r-api-stub.mjs');

    expect(browserTest).toContain("page.route('**/api/identity/**'");
    expect(browserTest).toContain("waitUntil: 'domcontentloaded'");
    expect(apiStub).toContain('const port = 3317');
    expect(apiStub).toContain("path === 'auth/session'");
    expect(apiStub).toContain("path === 'organizations'");
    expect(apiStub).toContain("path.endsWith('/memberships')");
    expect(apiStub).toContain("path.endsWith('/teams')");
    expect(apiStub).toContain('P2R_API_STUB_READY');
    expect(browserTest).not.toContain("waitUntil: 'networkidle'");
    expect(browserTest).toContain('const violations: Array<');
    expect(browserTest).toContain('const overflowIssues: Array<');
  });

  it('preserves semantic badge contracts with Tailwind v4 important foreground tokens', () => {
    const badge = read('packages/ui/src/components/badge.tsx');
    const styles = read('packages/ui/src/styles.css');
    const normalizedBadge = badge.replace(/\s+/g, ' ');

    expect(normalizedBadge).toContain(
      "success: 'border-transparent bg-success text-success text-success-foreground!'",
    );
    expect(normalizedBadge).toContain(
      "warning: 'border-transparent bg-warning text-warning text-warning-foreground!'",
    );
    expect(normalizedBadge).toContain(
      "destructive: 'border-transparent bg-destructive text-destructive text-destructive-foreground!'",
    );

    expect(styles).toContain('--success: #006b3c;');
    expect(styles).toContain('--success-foreground: #ffffff;');
    expect(styles).toContain('--warning: #7c2d12;');
    expect(styles).toContain('--warning-foreground: #ffffff;');
    expect(styles).toContain('--destructive: #991b1b;');
    expect(styles).toContain('--destructive-foreground: #ffffff;');
    expect(styles).toContain('--success: #8ff0b8;');
    expect(styles).toContain('--success-foreground: #052e1b;');
    expect(styles).toContain('--warning: #fdba74;');
    expect(styles).toContain('--warning-foreground: #431407;');
    expect(styles).toContain('--destructive: #fca5a5;');
    expect(styles).toContain('--destructive-foreground: #450a0a;');
    expect(styles).toContain('--color-success-foreground: var(--success-foreground);');
    expect(styles).toContain('--color-warning-foreground: var(--warning-foreground);');
    expect(styles).toContain('--color-destructive-foreground: var(--destructive-foreground);');
    expect(normalizedBadge).toContain('text-success-foreground!');
    expect(normalizedBadge).toContain('text-warning-foreground!');
    expect(normalizedBadge).toContain('text-destructive-foreground!');
    expect(styles).not.toContain('/* P2R.1.7 semantic status utilities */');

    expect(badge).not.toContain('bg-success/15 text-success');
    expect(badge).not.toContain('bg-warning/15 text-warning');
    expect(badge).not.toContain('bg-destructive/15 text-destructive');
  });

  it('provides keyboard-operable skip targets for every presentation shell', () => {
    const frame = read('apps/web/components/application-frame.tsx');
    const shell = read('apps/web/components/dashboard-shell.tsx');

    expect(frame).toContain('href="#standalone-content"');
    expect(frame).toContain('id="standalone-content" tabIndex={-1}');
    expect(shell).toContain('href="#dashboard-content"');
    expect(shell).toContain('id="dashboard-content" className="dashboard-content" tabIndex={-1}');
  });

  it('moves focus into and out of mobile navigation', () => {
    const shell = read('apps/web/components/dashboard-shell.tsx');
    const header = read('apps/web/components/dashboard-header.tsx');
    const sidebar = read('apps/web/components/dashboard-sidebar.tsx');

    expect(shell).toContain('const menuButtonRef = React.useRef<HTMLButtonElement>(null)');
    expect(shell).toContain('const sidebarCloseButtonRef = React.useRef<HTMLButtonElement>(null)');
    expect(shell).toContain('sidebarCloseButtonRef.current?.focus()');
    expect(shell).toContain('menuButtonRef.current?.focus()');
    expect(header).toContain('ref={menuButtonRef}');
    expect(sidebar).toContain('ref={closeButtonRef}');
  });

  it('uses a semantic page heading on invitation acceptance', () => {
    const invitation = read('apps/web/app/invitations/[token]/page.tsx');

    expect(invitation).toContain('<h1 className="invitation-acceptance__title">');
    expect(invitation).not.toContain('<CardTitle>');
  });

  it('honors reduced motion after organization-management styles', () => {
    const styles = read('apps/web/app/globals.css');

    expect(styles).toContain('/* P2R.1.7 accessibility and presentation gates */');
    expect(styles).toContain('.management-spin {');
    expect(styles).toContain('animation: none !important;');
    expect(styles).toContain('.team-management-card {');
    expect(styles).toContain('transition: none !important;');
  });

  it('preserves dynamic direction, theme providers, architecture, and security', () => {
    const layout = read('apps/web/app/layout.tsx');
    const locale = read('apps/web/i18n/config.ts');
    const frame = read('apps/web/components/application-frame.tsx');

    expect(layout).toContain('dir={getLocaleDirection(locale)}');
    expect(layout).toContain('defaultTheme="system"');
    expect(locale).toContain('getLocaleDirection(locale: AppLocale)');
    expect(frame).not.toContain('Clerk');
    expect(frame).not.toContain('Vercel Analytics');
    expect(inspectArchitecture(process.cwd()).issues).toEqual([]);
    expect(inspectRepositorySecurity(process.cwd()).issues).toEqual([]);
  });
});
