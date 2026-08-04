'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { DashboardHeader } from '@/components/dashboard-header';
import { DashboardSidebar } from '@/components/dashboard-sidebar';

export function DashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  const navigation = useTranslations('navigation');
  const common = useTranslations('common');
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const closeMobileNavigation = React.useCallback(() => {
    setMobileOpen(false);
  }, []);

  const toggleMobileNavigation = React.useCallback(() => {
    setMobileOpen((open) => !open);
  }, []);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 961px)');

    function closeWhenDesktop(event: MediaQueryListEvent): void {
      if (event.matches) {
        setMobileOpen(false);
      }
    }

    mediaQuery.addEventListener('change', closeWhenDesktop);

    return () => {
      mediaQuery.removeEventListener('change', closeWhenDesktop);
    };
  }, []);

  React.useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        closeMobileNavigation();
      }
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeMobileNavigation, mobileOpen]);

  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#dashboard-content">
        {common('skipToContent')}
      </a>

      <DashboardSidebar
        mobileOpen={mobileOpen}
        onNavigate={closeMobileNavigation}
        onClose={closeMobileNavigation}
      />

      {mobileOpen ? (
        <button
          type="button"
          className="dashboard-backdrop"
          aria-label={navigation('closeMenu')}
          onClick={closeMobileNavigation}
        />
      ) : null}

      <div className="dashboard-workspace">
        <DashboardHeader mobileOpen={mobileOpen} onToggleNavigation={toggleMobileNavigation} />
        <main id="dashboard-content" className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
}
