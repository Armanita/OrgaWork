import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('P2 identity UI security preserved by P2R i18n', () => {
  it('uses request-scoped locale resolution and dynamic document direction', () => {
    const layout = readFileSync('apps/web/app/layout.tsx', 'utf8');
    const requestConfig = readFileSync('apps/web/i18n/request.ts', 'utf8');
    const localeConfig = readFileSync('apps/web/i18n/config.ts', 'utf8');

    expect(layout).toContain('getLocaleDirection(locale)');
    expect(layout).toContain('NextIntlClientProvider');
    expect(requestConfig).toContain('localeCookieName');
    expect(localeConfig).toContain("developmentDefaultLocale: AppLocale = 'en'");
    expect(localeConfig).toContain("finalProductDefaultLocale: AppLocale = 'fa'");
  });

  it('keeps the locally installed Vazirmatn package for Persian rendering', () => {
    const styles = readFileSync('apps/web/app/globals.css', 'utf8');

    expect(styles).toContain("@import '@fontsource-variable/vazirmatn/wght.css';");
    expect(styles).toContain("html[lang='fa'] body");
    expect(styles).toContain("'Vazirmatn Variable'");
  });

  it('does not store session secrets or locale preferences in browser storage', () => {
    const files = [
      'apps/web/app/page.tsx',
      'apps/web/app/login/page.tsx',
      'apps/web/app/organization/page.tsx',
      'apps/web/components/language-switcher.tsx',
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
    }
  });
});
