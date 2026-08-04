import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { inspectArchitecture } from './architecture-policy.js';
import { inspectRepositorySecurity } from './repository-security.js';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('P2R responsive dashboard shell', () => {
  it('composes the dashboard page through the shared shell', () => {
    const page = read('apps/web/app/page.tsx');
    const shell = read('apps/web/components/dashboard-shell.tsx');
    const layout = read('apps/web/app/layout.tsx');
    const uiIndex = read('packages/ui/src/index.ts');

    expect(page).toContain('<DashboardShell>');
    expect(page).toContain('Card className="metric-card"');
    expect(shell).toContain('<DashboardSidebar');
    expect(shell).toContain('<DashboardHeader');
    expect(shell).toContain('id="dashboard-content"');
    expect(layout).toContain('<ApplicationFrame>{children}</ApplicationFrame>');
    expect(uiIndex).toContain('Building2');
    expect(uiIndex).toContain("from './icons'");
  });

  it('supports route-aware navigation without template content', () => {
    const sidebar = read('apps/web/components/dashboard-sidebar.tsx');

    expect(sidebar).toContain('usePathname');
    expect(sidebar).toContain("aria-current={active ? 'page' : undefined}");
    expect(sidebar).toContain('pathname.startsWith(item.href)');

    for (const forbidden of [
      'Studio Admin',
      'Kiranism',
      'TailAdmin',
      'Upgrade To Pro',
      'Clerk',
      'Vercel Analytics',
    ]) {
      expect(sidebar).not.toContain(forbidden);
    }
  });

  it('implements mobile navigation controls and cleanup', () => {
    const shell = read('apps/web/components/dashboard-shell.tsx');
    const header = read('apps/web/components/dashboard-header.tsx');

    expect(shell).toContain("window.matchMedia('(min-width: 961px)')");
    expect(shell).toContain("event.key === 'Escape'");
    expect(shell).toContain("document.body.style.overflow = 'hidden'");
    expect(shell).toContain('className="dashboard-backdrop"');
    expect(header).toContain('aria-controls="dashboard-sidebar"');
    expect(header).toContain('aria-expanded={mobileOpen}');
  });

  it('uses logical CSS and locale-safe responsive motion', () => {
    const styles = read('apps/web/app/globals.css');

    expect(styles).toContain('border-inline-end');
    expect(styles).toContain('inset-inline-start');
    expect(styles).toContain("html[dir='rtl'] .dashboard-sidebar");
    expect(styles).toContain('@media (max-width: 960px)');
    expect(styles).toContain(".dashboard-sidebar[data-mobile-open='true']");
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps all visible shell copy in both message catalogs', () => {
    const English = read('apps/web/messages/en.json');
    const Persian = read('apps/web/messages/fa.json');
    const header = read('apps/web/components/dashboard-header.tsx');
    const sidebar = read('apps/web/components/dashboard-sidebar.tsx');

    for (const marker of ['"primaryLabel"', '"openMenu"', '"closeMenu"', '"skipToContent"']) {
      expect(English).toContain(marker);
      expect(Persian).toContain(marker);
    }

    expect(header).toContain("useTranslations('navigation')");
    expect(header).toContain("useTranslations('common')");
    expect(sidebar).toContain("useTranslations('application')");
    expect(sidebar).toContain("useTranslations('navigation')");
    expect(sidebar).toContain("useTranslations('common')");
  });

  it('preserves architecture, security, and browser-storage boundaries', () => {
    const files = [
      'apps/web/components/application-frame.tsx',
      'apps/web/components/dashboard-header.tsx',
      'apps/web/components/dashboard-shell.tsx',
      'apps/web/components/dashboard-sidebar.tsx',
    ];

    for (const file of files) {
      const source = read(file);
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
    }

    expect(inspectArchitecture(process.cwd()).issues).toEqual([]);
    expect(inspectRepositorySecurity(process.cwd()).issues).toEqual([]);
  });
});
