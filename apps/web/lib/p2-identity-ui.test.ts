import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { collectUserFacingTexts, userFacingMessages } from './messages.fa.js';

describe('P2 Persian identity UI', () => {
  it('keeps all declared user-facing messages Persian', () => {
    for (const value of collectUserFacingTexts(userFacingMessages)) {
      expect(value).not.toMatch(/[A-Za-z]{3,}/u);
    }
  });

  it('uses RTL and the locally installed Vazirmatn package', () => {
    const layout = readFileSync('apps/web/app/layout.tsx', 'utf8');
    const styles = readFileSync('apps/web/app/globals.css', 'utf8');

    expect(layout).toContain('dir="rtl"');
    expect(styles).toContain("@import '@fontsource-variable/vazirmatn/wght.css';");
    expect(styles).toMatch(/font-family:\s*['"]Vazirmatn Variable['"]/u);
  });

  it('does not store session secrets in browser storage', () => {
    const files = [
      'apps/web/app/page.tsx',
      'apps/web/app/login/page.tsx',
      'apps/web/app/organization/page.tsx',
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
    }
  });
});
