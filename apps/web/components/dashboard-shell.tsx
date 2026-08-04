'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { DashboardHeader } from '@/components/dashboard-header';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { identityRequest, type WebSession } from '@/lib/identity-api';

interface OrganizationSummary {
  readonly id: string;
  readonly name: string;
}

export function DashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  const navigation = useTranslations('navigation');
  const common = useTranslations('common');
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [organizationName, setOrganizationName] = React.useState<string>();
  const [organizationLoading, setOrganizationLoading] = React.useState(true);

  const closeMobileNavigation = React.useCallback(() => {
    setMobileOpen(false);
  }, []);

  const toggleMobileNavigation = React.useCallback(() => {
    setMobileOpen((open) => !open);
  }, []);

  React.useEffect(() => {
    let active = true;

    void Promise.all([
      identityRequest<{ readonly session: WebSession }>('auth/session'),
      identityRequest<{
        readonly organizations: readonly OrganizationSummary[];
      }>('organizations'),
    ])
      .then(([sessionData, organizationData]) => {
        if (!active) {
          return;
        }

        const currentOrganization = organizationData.organizations.find(
          (organization) => organization.id === sessionData.session.currentOrganizationId,
        );

        setOrganizationName(currentOrganization?.name);
      })
      .catch(() => {
        if (active) {
          setOrganizationName(undefined);
        }
      })
      .finally(() => {
        if (active) {
          setOrganizationLoading(false);
        }
      });

    return () => {
      active = false;
    };
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
        organizationLoading={organizationLoading}
        organizationName={organizationName}
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
        <DashboardHeader
          mobileOpen={mobileOpen}
          organizationLoading={organizationLoading}
          organizationName={organizationName}
          onToggleNavigation={toggleMobileNavigation}
        />
        <main id="dashboard-content" className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
}
