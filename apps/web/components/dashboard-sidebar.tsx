'use client';

import {
  Badge,
  Button,
  LayoutDashboard,
  LoaderCircle,
  Network,
  ShieldCheck,
  Users,
  X,
} from '@workspace/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

const navigationItems = [
  {
    href: '/',
    key: 'overview',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: '/organization/members',
    key: 'members',
    icon: Users,
    exact: false,
  },
  {
    href: '/organization/teams',
    key: 'teams',
    icon: Network,
    exact: false,
  },
  {
    href: '/login',
    key: 'security',
    icon: ShieldCheck,
    exact: false,
  },
] as const;

export interface DashboardSidebarProps {
  readonly mobileOpen: boolean;
  readonly organizationLoading: boolean;
  readonly organizationName: string | undefined;
  readonly onClose: () => void;
  readonly onNavigate: () => void;
}

export function DashboardSidebar({
  mobileOpen,
  organizationLoading,
  organizationName,
  onClose,
  onNavigate,
}: DashboardSidebarProps): React.ReactElement {
  const pathname = usePathname();
  const application = useTranslations('application');
  const navigation = useTranslations('navigation');
  const common = useTranslations('common');

  return (
    <aside
      id="dashboard-sidebar"
      className="dashboard-sidebar"
      data-mobile-open={mobileOpen}
      aria-label={navigation('primaryLabel')}
    >
      <div className="dashboard-sidebar__top">
        <Link className="dashboard-brand" href="/" onClick={onNavigate}>
          <span className="dashboard-brand__mark">{application('brandMark')}</span>
          <span className="dashboard-brand__copy">
            <strong>{application('name')}</strong>
            <span>{application('tagline')}</span>
          </span>
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="dashboard-sidebar__close"
          aria-label={navigation('closeMenu')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <nav className="dashboard-nav" aria-label={navigation('primaryLabel')}>
        {navigationItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className="dashboard-nav__link"
              data-active={active}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" />
              <span>{navigation(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="dashboard-sidebar__footer">
        <span>{common('activeMembership')}</span>
        <strong>
          {organizationLoading ? (
            <>
              <LoaderCircle className="management-spin" aria-hidden="true" />
              {common('organizationLoading')}
            </>
          ) : (
            (organizationName ?? common('organizationUnavailable'))
          )}
        </strong>
        <Badge variant="success">{common('status.active')}</Badge>
      </div>
    </aside>
  );
}
