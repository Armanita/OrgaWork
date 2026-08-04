import { ThemeProvider, TooltipProvider } from '@workspace/ui';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggleControl } from '@/components/theme-toggle-control';
import { getLocaleDirection } from '@/i18n/config';

import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('application');

  return {
    title: {
      default: t('name'),
      template: `%s | ${t('name')}`,
    },
    description: t('description'),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={getLocaleDirection(locale)} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              <div className="app-controls">
                <LanguageSwitcher />
                <ThemeToggleControl />
              </div>
              {children}
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
