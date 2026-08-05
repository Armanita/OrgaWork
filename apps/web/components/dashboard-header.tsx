'use client';

import { Building2, Button, LoaderCircle, Menu, X } from '@workspace/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggleControl } from '@/components/theme-toggle-control';

export interface DashboardHeaderProps {
  readonly menuButtonRef: React.Ref<HTMLButtonElement>;
  readonly mobileOpen: boolean;
  readonly organizationLoading: boolean;
  readonly organizationName: string | undefined;
  readonly onToggleNavigation: () => void;
}

export function DashboardHeader({
  menuButtonRef,
  mobileOpen,
  organizationLoading,
  organizationName,
  onToggleNavigation,
}: DashboardHeaderProps): React.ReactElement {
  const navigation = useTranslations('navigation');
  const common = useTranslations('common');

  return (
    <header className="dashboard-header">
      <div className="dashboard-header__identity">
        <Button
          ref={menuButtonRef}
          type="button"
          variant="outline"
          size="icon"
          className="dashboard-header__menu-button"
          aria-controls="dashboard-sidebar"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? navigation('closeMenu') : navigation('openMenu')}
          onClick={onToggleNavigation}
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>

        <Building2 aria-hidden="true" />
        <div className="dashboard-header__organization">
          <span>{common('currentOrganization')}</span>
          <strong aria-live="polite">
            {organizationLoading ? (
              <>
                <LoaderCircle className="management-spin" aria-hidden="true" />
                {common('organizationLoading')}
              </>
            ) : (
              (organizationName ?? common('organizationUnavailable'))
            )}
          </strong>
        </div>
      </div>

      <div className="dashboard-header__actions">
        <LanguageSwitcher />
        <ThemeToggleControl />
        <Button asChild variant="secondary" size="sm">
          <Link href="/organization">{common('changeOrganization')}</Link>
        </Button>
      </div>
    </header>
  );
}
