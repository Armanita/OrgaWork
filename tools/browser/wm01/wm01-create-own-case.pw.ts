import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3218';

test('creates an own case from the Dashboard and renders the created-case detail', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'orgawork-locale',
      value: 'en',
      url: baseUrl,
    },
  ]);

  await page.goto('/cases/new');

  await expect(page.getByRole('heading', { name: 'Create a case' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  await page.getByLabel('Case title').fill('Customer renewal');
  await page
    .getByLabel('Description')
    .fill('Follow the customer renewal through to a clear outcome.');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByLabel('First action').fill('Call customer');

  await page.getByRole('button', { name: 'Create case' }).click();

  await expect(page.getByRole('heading', { name: 'Your case is ready' })).toBeVisible();
  await expect(page.getByText('Call customer')).toBeVisible();
  await expect(page.getByText('High')).toBeVisible();
  await expect(page.getByText('Open')).toBeVisible();
  await expect(page.getByText('55555555-5555-4555-8555-555555555555')).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('.case-create-card')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('renders the same Create Own Case surface in Persian RTL', async ({ context, page }) => {
  await context.addCookies([
    {
      name: 'orgawork-locale',
      value: 'fa',
      url: baseUrl,
    },
  ]);

  await page.goto('/cases/new');

  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'ایجاد پرونده' })).toBeVisible();
  await expect(page.getByLabel('عنوان پرونده')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ایجاد پرونده' })).toBeVisible();
});
