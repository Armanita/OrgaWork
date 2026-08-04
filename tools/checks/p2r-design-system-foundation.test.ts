import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { inspectArchitecture } from './architecture-policy.js';
import { inspectRepositorySecurity } from './repository-security.js';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('P2R design-system foundation', () => {
  it('creates the UI workspace with pinned dependencies and source exports', () => {
    const packageDocument = JSON.parse(read('packages/ui/package.json')) as Readonly<
      Record<string, unknown>
    >;
    const dependencies = packageDocument['dependencies'] as Readonly<Record<string, string>>;
    const exports = packageDocument['exports'] as Readonly<Record<string, unknown>>;

    expect(packageDocument['name']).toBe('@workspace/ui');
    expect(dependencies).toMatchObject({
      'class-variance-authority': '0.7.1',
      clsx: '2.1.1',
      'lucide-react': '1.28.0',
      'next-themes': '0.4.6',
      'radix-ui': '1.6.0',
      'tailwind-merge': '3.6.0',
    });
    expect(exports).toHaveProperty('.');
    expect(exports).toHaveProperty('./styles.css');
  });

  it('exports the approved primitive component surface', () => {
    const index = read('packages/ui/src/index.ts');

    for (const symbol of [
      'Badge',
      'Button',
      'Card',
      'Input',
      'Label',
      'Separator',
      'ThemeProvider',
      'ThemeToggle',
      'Tooltip',
      'cn',
    ]) {
      expect(index).toContain(symbol);
    }
  });

  it('owns light and dark semantic tokens and exposes them to Tailwind', () => {
    const tokens = read('packages/ui/src/styles.css');
    const applicationStyles = read('apps/web/app/globals.css');

    expect(tokens).toContain('@custom-variant dark');
    expect(tokens).toContain('@theme inline');
    expect(tokens).toContain('--background:');
    expect(tokens).toContain('--primary:');
    expect(tokens).toContain('.dark {');
    expect(applicationStyles).toContain("@import '@workspace/ui/styles.css';");
    expect(applicationStyles).toContain("@source '../../../packages/ui/src';");
  });

  it('integrates theme and tooltip providers without hardcoded visible copy', () => {
    const layout = read('apps/web/app/layout.tsx');
    const control = read('apps/web/components/theme-toggle-control.tsx');
    const English = read('apps/web/messages/en.json');
    const Persian = read('apps/web/messages/fa.json');

    expect(layout).toContain('suppressHydrationWarning');
    expect(layout).toContain('<ThemeProvider');
    expect(layout).toContain('<TooltipProvider>');
    expect(control).toContain("useTranslations('themeSwitcher')");
    expect(English).toContain('"toDark": "Use dark theme"');
    expect(Persian).toContain('"toDark": "استفاده از پوسته تیره"');
  });

  it('declares the web-to-UI dependency and keeps architecture and security clean', () => {
    const webPackage = read('apps/web/package.json');
    const nextConfig = read('apps/web/next.config.ts');
    const p2Audit = read('tools/acceptance/p2-complete-audit.ts');

    expect(webPackage).toContain('"@workspace/ui": "workspace:*"');
    expect(nextConfig).toContain("transpilePackages: ['@workspace/ui']");
    expect(p2Audit).toContain('const legacyFixedRtl');
    expect(p2Audit).toContain('const dynamicLocaleDirection');
    expect(p2Audit).toContain('dir={getLocaleDirection(locale)}');
    expect(inspectArchitecture(process.cwd()).issues).toEqual([]);
    expect(inspectRepositorySecurity(process.cwd()).issues).toEqual([]);
  });
});
