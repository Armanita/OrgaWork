'use client';

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

  if (isDashboardRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="standalone-controls">
        <LanguageSwitcher />
        <ThemeToggleControl />
      </div>
      {children}
    </>
  );
}
