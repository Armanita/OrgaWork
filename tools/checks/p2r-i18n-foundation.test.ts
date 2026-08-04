import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  developmentDefaultLocale,
  finalProductDefaultLocale,
  getLocaleDirection,
  isSupportedLocale,
  localeCookieName,
  supportedLocales,
} from '../../apps/web/i18n/config.js';

describe('P2R bilingual locale foundation', () => {
  it('supports English and Persian with explicit development and product defaults', () => {
    expect(supportedLocales).toEqual(['en', 'fa']);
    expect(developmentDefaultLocale).toBe('en');
    expect(finalProductDefaultLocale).toBe('fa');
    expect(getLocaleDirection('en')).toBe('ltr');
    expect(getLocaleDirection('fa')).toBe('rtl');
  });

  it('validates locale values and persists them in a dedicated cookie', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('fa')).toBe(true);
    expect(isSupportedLocale('de')).toBe(false);
    expect(localeCookieName).toBe('orgawork-locale');

    const route = readFileSync('apps/web/app/api/locale/route.ts', 'utf8');
    expect(route).toContain('httpOnly: true');
    expect(route).toContain("sameSite: 'lax'");
    expect(route).toContain("path: '/'");
  });

  it('loads next-intl through the official plugin and request configuration', () => {
    const nextConfig = readFileSync('apps/web/next.config.ts', 'utf8');
    const requestConfig = readFileSync('apps/web/i18n/request.ts', 'utf8');
    const packageJson = readFileSync('apps/web/package.json', 'utf8');

    expect(nextConfig).toContain("createNextIntlPlugin('./i18n/request.ts')");
    expect(requestConfig).toContain('getRequestConfig');
    expect(packageJson).toContain('"next-intl": "4.13.4"');
  });

  it('moves visible page copy behind translation APIs', () => {
    const pages = [
      'apps/web/app/page.tsx',
      'apps/web/app/login/page.tsx',
      'apps/web/app/organization/page.tsx',
      'apps/web/app/organization/members/page.tsx',
      'apps/web/app/organization/teams/page.tsx',
    ];

    for (const page of pages) {
      const source = readFileSync(page, 'utf8');

      expect(source).not.toContain('messages.fa');
      expect(source).toMatch(/useTranslations|getTranslations/u);
    }
  });

  it('keeps locale switching independent from authentication state', () => {
    const switcher = readFileSync('apps/web/components/language-switcher.tsx', 'utf8');
    const route = readFileSync('apps/web/app/api/locale/route.ts', 'utf8');

    expect(switcher).toContain("fetch('/api/locale'");
    expect(switcher).toContain('router.refresh()');
    expect(route).not.toContain('identityRequest');
    expect(route).not.toContain('session');
  });
});
