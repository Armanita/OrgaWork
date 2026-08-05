import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3217';
const organizationId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const csrfToken = 'browser-audit-csrf-token';

const routes = [
  '/',
  '/login',
  '/login/reset',
  '/login/reset/confirm?token=browser-audit-token',
  '/organization',
  '/organization/members',
  '/organization/teams',
  '/invitations/browser-audit-token',
] as const;

const locales = [
  { locale: 'en', direction: 'ltr' },
  { locale: 'fa', direction: 'rtl' },
] as const;

const themes = ['light', 'dark'] as const;

type SupportedLocale = (typeof locales)[number]['locale'];
type SupportedTheme = (typeof themes)[number];

function envelope(data: unknown): string {
  return JSON.stringify({ ok: true, data });
}

async function fulfillIdentityRoute(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const identityPath = decodeURIComponent(url.pathname.replace(/^\/api\/identity\//u, ''));

  if (identityPath === 'auth/session') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({
        session: {
          id: '33333333-3333-4333-8333-333333333333',
          userId: '44444444-4444-4444-8444-444444444444',
          email: 'owner@orgawork.test',
          sessionRevision: 1,
          currentOrganizationId: organizationId,
          csrfToken,
        },
      }),
    });
    return;
  }

  if (identityPath === 'organizations') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({
        organizations: [
          {
            id: organizationId,
            name: 'OrgaWork Browser Audit',
            membershipId,
            membershipStatus: 'active',
          },
        ],
      }),
    });
    return;
  }

  if (identityPath.endsWith('/memberships')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({
        memberships: [
          {
            id: membershipId,
            email: 'owner@orgawork.test',
            status: 'active',
            roleKeys: ['organization_admin'],
          },
          {
            id: '55555555-5555-4555-8555-555555555555',
            email: 'manager@orgawork.test',
            status: 'invited',
            roleKeys: ['manager'],
          },
        ],
      }),
    });
    return;
  }

  if (identityPath.endsWith('/teams')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({
        teams: [
          {
            id: '66666666-6666-4666-8666-666666666666',
            name: 'Operations',
            memberCount: 2,
          },
          {
            id: '77777777-7777-4777-8777-777777777777',
            name: 'Quality',
            memberCount: 1,
          },
        ],
      }),
    });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: envelope({ accepted: true }),
  });
}

async function preparePage(page: Page): Promise<void> {
  await page.route('**/api/identity/**', fulfillIdentityRoute);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
}

async function applyPresentation(
  context: BrowserContext,
  page: Page,
  locale: SupportedLocale,
  theme: SupportedTheme,
): Promise<void> {
  await context.addCookies([
    {
      name: 'orgawork-locale',
      value: locale,
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await page.evaluate((requestedTheme) => {
    window.localStorage.setItem('theme', requestedTheme);
  }, theme);
}

async function openRoute(
  context: BrowserContext,
  page: Page,
  route: string,
  locale: SupportedLocale,
  theme: SupportedTheme,
): Promise<void> {
  await applyPresentation(context, page, locale, theme);
  await page.goto(route, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);

  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'fa' ? 'rtl' : 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);

  await expect
    .poll(async () => page.evaluate(() => document.documentElement.classList.contains('dark')))
    .toBe(theme === 'dark');
}

test.describe('P2R.1.7 browser accessibility and presentation gates', () => {
  test('passes WCAG A and AA checks across routes, languages, and themes', async ({
    context,
    page,
  }) => {
    test.setTimeout(180_000);
    await preparePage(page);

    const violations: Array<{
      readonly id: string;
      readonly impact: string | null;
      readonly help: string;
      readonly route: string;
      readonly locale: SupportedLocale;
      readonly theme: SupportedTheme;
      readonly target: readonly string[];
      readonly html: string;
      readonly failureSummary: string | undefined;
    }> = [];

    for (const localeCase of locales) {
      for (const theme of themes) {
        for (const route of routes) {
          await openRoute(context, page, route, localeCase.locale, theme);

          const result = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

          for (const violation of result.violations) {
            for (const node of violation.nodes) {
              violations.push({
                id: violation.id,
                impact: violation.impact,
                help: violation.help,
                route,
                locale: localeCase.locale,
                theme,
                target: node.target.map(String),
                html: node.html,
                failureSummary: node.failureSummary,
              });
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('prevents horizontal overflow on mobile and desktop in both directions', async ({
    context,
    page,
  }) => {
    test.setTimeout(180_000);
    await preparePage(page);

    const overflowIssues: Array<{
      readonly route: string;
      readonly locale: SupportedLocale;
      readonly viewportWidth: number;
      readonly overflow: number;
    }> = [];

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);

      for (const localeCase of locales) {
        for (const route of routes) {
          await openRoute(context, page, route, localeCase.locale, 'light');

          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );

          if (overflow > 1) {
            overflowIssues.push({
              route,
              locale: localeCase.locale,
              viewportWidth: viewport.width,
              overflow,
            });
          }
        }
      }
    }

    expect(overflowIssues).toEqual([]);
  });

  test('moves keyboard focus through skip links on standalone and dashboard routes', async ({
    context,
    page,
  }) => {
    await preparePage(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    await openRoute(context, page, '/login', 'en', 'light');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#standalone-content')).toBeFocused();

    await openRoute(context, page, '/organization/members', 'en', 'light');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dashboard-content')).toBeFocused();
  });

  test('manages mobile navigation focus and restores it after Escape', async ({
    context,
    page,
  }) => {
    await preparePage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(context, page, '/organization/members', 'en', 'light');

    const menuButton = page.locator(
      '.dashboard-header__menu-button[aria-controls="dashboard-sidebar"]',
    );
    const closeButton = page.locator('.dashboard-sidebar__close');

    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(closeButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(menuButton).toBeFocused();
  });

  test('switches theme and document direction through real controls', async ({ context, page }) => {
    await preparePage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoute(context, page, '/login', 'en', 'light');

    const themeButton = page.locator('.standalone-controls button').nth(1);
    await themeButton.click();

    await expect
      .poll(async () => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(true);

    await page.locator('.language-switcher').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('disables continuous motion when reduced motion is requested', async ({ context, page }) => {
    await preparePage(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRoute(context, page, '/organization/teams', 'en', 'light');

    const motion = await page.evaluate(() => {
      const spinner = document.createElement('span');
      spinner.className = 'management-spin';
      document.body.append(spinner);

      const spinnerStyle = window.getComputedStyle(spinner);
      const teamCard = document.querySelector<HTMLElement>('.team-management-card');
      const teamStyle = teamCard === null ? undefined : window.getComputedStyle(teamCard);

      const result = {
        spinnerAnimationName: spinnerStyle.animationName,
        spinnerAnimationDuration: spinnerStyle.animationDuration,
        teamTransitionDuration: teamStyle?.transitionDuration ?? 'missing',
      };

      spinner.remove();
      return result;
    });

    expect(motion.spinnerAnimationName).toBe('none');
    expect(motion.spinnerAnimationDuration).toBe('0s');
    expect(motion.teamTransitionDuration).toBe('0s');
  });
});
