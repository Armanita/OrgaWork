import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const utf8 = 'utf8';

function read(path: string): string {
  return readFileSync(path, utf8);
}

describe('WM-01 web slice boundaries', () => {
  it('uses a strict create-case BFF and forwards CSRF plus idempotency', () => {
    const proxy = read('apps/web/app/api/work-management/[...path]/route.ts');

    expect(proxy).toContain('createOwnCasePattern');
    expect(proxy).toContain("'x-csrf-token'");
    expect(proxy).toContain("'x-idempotency-key'");
    expect(proxy).toContain('export const POST = proxy');
    expect(proxy).not.toContain('export const GET');
    expect(proxy).not.toContain('export const DELETE');
  });

  it('keeps browser storage and Gregorian date input out of Create Own Case', () => {
    const form = read('apps/web/components/create-own-case-form.tsx');

    expect(form).toContain('workManagementRequest');
    expect(form).toContain('crypto.randomUUID()');
    expect(form).not.toContain('localStorage');
    expect(form).not.toContain('sessionStorage');
    expect(form).not.toContain('type="date"');
  });

  it('links the Dashboard and sidebar to the real Create Case page', () => {
    const page = read('apps/web/app/page.tsx');
    const sidebar = read('apps/web/components/dashboard-sidebar.tsx');

    expect(page).toContain('href="/cases/new"');
    expect(sidebar).toContain("href: '/cases/new'");
  });

  it('keeps English and Persian message keys aligned for WM-01', () => {
    const english = JSON.parse(read('apps/web/messages/en.json')) as Record<string, unknown>;
    const persian = JSON.parse(read('apps/web/messages/fa.json')) as Record<string, unknown>;

    const englishSerialized = JSON.stringify(english);
    const persianSerialized = JSON.stringify(persian);

    for (const marker of [
      '"cases"',
      '"createOwnCase"',
      '"titleLabel"',
      '"descriptionLabel"',
      '"priorityLabel"',
      '"initialActionLabel"',
      '"successTitle"',
      '"caseIdLabel"',
    ]) {
      expect(englishSerialized).toContain(marker);
      expect(persianSerialized).toContain(marker);
    }
  });
});
