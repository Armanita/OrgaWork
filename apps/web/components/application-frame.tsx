'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggleControl } from '@/components/theme-toggle-control';

function isDashboardRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/organization/members') ||
    pathname.startsWith('/organization/teams')
  );
}

export function ApplicationFrame({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  const pathname = usePathname();
  const common = useTranslations('common');

  if (isDashboardRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <a className="skip-link" href="#standalone-content">
        {common('skipToContent')}
      </a>
      <div className="standalone-controls">
        <LanguageSwitcher />
        <ThemeToggleControl />
      </div>
      <div id="standalone-content" tabIndex={-1}>
        {children}
      </div>
    </>
  );
}
