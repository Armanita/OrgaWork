'use client';

import {
  Badge,
  Building2,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoaderCircle,
  MailPlus,
  ShieldCheck,
  UserRoundCheck,
} from '@workspace/ui';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

import { identityRequest, type WebSession } from '@/lib/identity-api';
import { PlatformRequestError, platformRequest } from '@/lib/platform-api';

interface PlatformOperator {
  readonly userId: string;
  readonly email: string;
  readonly status: 'active';
}

interface OrganizationAdmin {
  readonly membershipId: string;
  readonly userId: string;
  readonly email: string;
  readonly membershipStatus: 'active' | 'suspended';
}

interface OrganizationSummary {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly admins: readonly OrganizationAdmin[];
}

interface OrganizationResult {
  readonly organization: {
    readonly id: string;
    readonly name: string;
  };
  readonly replayed: boolean;
}

interface AdminProvisioningResult {
  readonly organizationId: string;
  readonly userId: string;
  readonly email: string;
  readonly membershipId: string;
  readonly role: 'organization_admin';
  readonly accountSetupRequired: boolean;
  readonly replayed: boolean;
}

interface AdminRevokeResult {
  readonly organizationId: string;
  readonly userId: string;
  readonly email: string;
  readonly membershipId: string;
  readonly replayed: boolean;
}

type AuditAction =
  | 'organization.create'
  | 'organization.rename'
  | 'organization_admin.provision'
  | 'organization_admin.revoke';

type PlatformSection = 'overview' | 'organizations' | 'administration' | 'audit';

interface AuditRow {
  readonly id: string;
  readonly action: AuditAction;
  readonly reason: string;
  readonly actorUserId: string;
  readonly actorEmail: string;
  readonly organizationId: string | null;
  readonly organizationName: string | null;
  readonly targetUserId: string | null;
  readonly requestId: string;
  readonly correlationId: string;
  readonly result: 'succeeded' | 'failed';
  readonly createdAt: string;
}

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function idempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function formatAuditDate(value: string, locale: string): string {
  const calendarLocale = locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US-u-ca-persian';
  return new Intl.DateTimeFormat(calendarLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function PlatformControlPlanePage(): React.ReactElement {
  const locale = useLocale();
  const application = useTranslations('application');
  const messages = useTranslations('platformControlPlane');
  const errors = useTranslations('common.errors');

  const [session, setSession] = React.useState<WebSession>();
  const [operator, setOperator] = React.useState<PlatformOperator>();
  const [organizations, setOrganizations] = React.useState<readonly OrganizationSummary[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState('');
  const [audit, setAudit] = React.useState<readonly AuditRow[]>([]);
  const [adminResult, setAdminResult] = React.useState<AdminProvisioningResult>();
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [creatingOrganization, setCreatingOrganization] = React.useState(false);
  const [renamingOrganization, setRenamingOrganization] = React.useState(false);
  const [provisioningAdmin, setProvisioningAdmin] = React.useState(false);
  const [revokingMembershipId, setRevokingMembershipId] = React.useState<string>();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [revokeReason, setRevokeReason] = React.useState('');
  const [organizationSearch, setOrganizationSearch] = React.useState('');
  const [auditOrganizationFilter, setAuditOrganizationFilter] = React.useState('');
  const [auditTextFilter, setAuditTextFilter] = React.useState('');
  const [activeSection, setActiveSection] = React.useState<PlatformSection>('overview');

  const loadOrganizations = React.useCallback(async (preferredId?: string): Promise<void> => {
    const result = await platformRequest<{
      readonly organizations: readonly OrganizationSummary[];
    }>('organizations');
    setOrganizations(result.organizations);
    setSelectedOrganizationId((current) => {
      if (
        preferredId !== undefined &&
        result.organizations.some((organization) => organization.id === preferredId)
      ) {
        return preferredId;
      }
      if (result.organizations.some((organization) => organization.id === current)) {
        return current;
      }
      return '';
    });
  }, []);

  const loadAudit = React.useCallback(async (): Promise<void> => {
    const result = await platformRequest<{ readonly audit: readonly AuditRow[] }>(
      'audit?limit=100',
    );
    setAudit(result.audit);
  }, []);

  React.useEffect(() => {
    let active = true;
    void Promise.all([
      identityRequest<{ readonly session: WebSession }>('auth/session'),
      platformRequest<{ readonly platformOperator: PlatformOperator }>('session'),
      platformRequest<{ readonly organizations: readonly OrganizationSummary[] }>('organizations'),
      platformRequest<{ readonly audit: readonly AuditRow[] }>('audit?limit=100'),
    ])
      .then(([sessionData, platformData, organizationData, auditData]) => {
        if (!active) return;
        setSession(sessionData.session);
        setOperator(platformData.platformOperator);
        setOrganizations(organizationData.organizations);
        setSelectedOrganizationId('');
        setAudit(auditData.audit);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof PlatformRequestError && caught.status === 403) {
          window.location.assign('/organization');
          return;
        }
        setError(
          caught instanceof Error ? caught.message : errors('platformControlPlaneLoadFailed'),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [errors]);

  const selectedOrganization = React.useMemo(
    () => organizations.find((organization) => organization.id === selectedOrganizationId),
    [organizations, selectedOrganizationId],
  );

  const filteredOrganizations = React.useMemo(() => {
    const query = organizationSearch.trim().toLocaleLowerCase(locale === 'fa' ? 'fa-IR' : 'en-US');
    if (query === '') return organizations;
    return organizations.filter((organization) =>
      `${organization.name} ${organization.id}`
        .toLocaleLowerCase(locale === 'fa' ? 'fa-IR' : 'en-US')
        .includes(query),
    );
  }, [locale, organizationSearch, organizations]);

  const visibleAudit = React.useMemo(() => {
    const query = auditTextFilter.trim().toLocaleLowerCase(locale === 'fa' ? 'fa-IR' : 'en-US');
    return audit.filter((row) => {
      if (auditOrganizationFilter !== '' && row.organizationId !== auditOrganizationFilter) {
        return false;
      }
      if (query === '') return true;
      return `${row.reason} ${row.actorEmail} ${row.organizationName ?? ''} ${row.organizationId ?? ''} ${row.targetUserId ?? ''}`
        .toLocaleLowerCase(locale === 'fa' ? 'fa-IR' : 'en-US')
        .includes(query);
    });
  }, [audit, auditOrganizationFilter, auditTextFilter, locale]);

  function actionLabel(action: AuditAction): string {
    if (action === 'organization.create') return messages('actions.organization.create');
    if (action === 'organization.rename') return messages('actions.organization.rename');
    if (action === 'organization_admin.provision') {
      return messages('actions.organization_admin.provision');
    }
    return messages('actions.organization_admin.revoke');
  }

  async function refreshPlatform(preferredOrganizationId?: string): Promise<void> {
    await Promise.all([loadOrganizations(preferredOrganizationId), loadAudit()]);
  }

  async function logout(): Promise<void> {
    if (session === undefined || loggingOut) return;
    setLoggingOut(true);
    setError('');
    try {
      const response = await fetch('/api/identity/auth/logout', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'x-csrf-token': session.csrfToken,
        },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(errors('logoutFailed'));
      window.location.assign('/login');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('logoutFailed'));
      setLoggingOut(false);
    }
  }

  async function createOrganization(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (session === undefined || creatingOrganization) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = readText(form, 'name');
    const reason = readText(form, 'reason');
    if (name === '' || reason.length < 10) return;

    setCreatingOrganization(true);
    setError('');
    setNotice('');
    setAdminResult(undefined);
    try {
      const result = await platformRequest<OrganizationResult>('organizations', {
        method: 'POST',
        headers: {
          'x-csrf-token': session.csrfToken,
          'idempotency-key': idempotencyKey('oa-create'),
        },
        body: JSON.stringify({ name, reason }),
      });
      setNotice(messages('organizationCreated'));
      formElement.reset();
      await refreshPlatform(result.organization.id);
      setActiveSection('administration');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : errors('platformOrganizationCreateFailed'),
      );
    } finally {
      setCreatingOrganization(false);
    }
  }

  async function renameOrganization(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (session === undefined || selectedOrganization === undefined || renamingOrganization) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = readText(form, 'name');
    const reason = readText(form, 'reason');
    if (name === '' || reason.length < 10) return;

    setRenamingOrganization(true);
    setError('');
    setNotice('');
    try {
      await platformRequest<OrganizationResult>(`organizations/${selectedOrganization.id}`, {
        method: 'PATCH',
        headers: {
          'x-csrf-token': session.csrfToken,
          'idempotency-key': idempotencyKey('oa-rename'),
        },
        body: JSON.stringify({ name, reason }),
      });
      setNotice(messages('organizationRenamed'));
      await refreshPlatform(selectedOrganization.id);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : errors('platformOrganizationRenameFailed'),
      );
    } finally {
      setRenamingOrganization(false);
    }
  }

  async function provisionAdmin(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (session === undefined || selectedOrganization === undefined || provisioningAdmin) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = readText(form, 'email');
    const reason = readText(form, 'reason');
    if (email === '' || reason.length < 10) return;

    setProvisioningAdmin(true);
    setError('');
    setNotice('');
    try {
      const result = await platformRequest<AdminProvisioningResult>(
        `organizations/${selectedOrganization.id}/admins`,
        {
          method: 'POST',
          headers: {
            'x-csrf-token': session.csrfToken,
            'idempotency-key': idempotencyKey('oa-admin'),
          },
          body: JSON.stringify({ email, reason }),
        },
      );
      setAdminResult(result);
      setNotice(messages('adminProvisioned'));
      formElement.reset();
      await refreshPlatform(selectedOrganization.id);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('platformAdminProvisionFailed'));
    } finally {
      setProvisioningAdmin(false);
    }
  }

  async function revokeAdmin(admin: OrganizationAdmin): Promise<void> {
    if (
      session === undefined ||
      selectedOrganization === undefined ||
      revokingMembershipId !== undefined ||
      revokeReason.trim().length < 10
    ) {
      return;
    }

    setRevokingMembershipId(admin.membershipId);
    setError('');
    setNotice('');
    try {
      await platformRequest<AdminRevokeResult>(
        `organizations/${selectedOrganization.id}/admins/${admin.membershipId}`,
        {
          method: 'DELETE',
          headers: {
            'x-csrf-token': session.csrfToken,
            'idempotency-key': idempotencyKey('oa-admin-revoke'),
          },
          body: JSON.stringify({ reason: revokeReason.trim() }),
        },
      );
      setNotice(messages('adminRevoked'));
      setRevokeReason('');
      setAdminResult(undefined);
      await refreshPlatform(selectedOrganization.id);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('platformAdminRevokeFailed'));
    } finally {
      setRevokingMembershipId(undefined);
    }
  }

  function exportAuditCsv(): void {
    const header = [
      messages('auditColumns.action'),
      messages('auditColumns.actor'),
      messages('auditColumns.organization'),
      messages('auditColumns.reason'),
      messages('auditColumns.target'),
      messages('auditColumns.result'),
      messages('auditColumns.time'),
      messages('auditColumns.requestId'),
      messages('auditColumns.correlationId'),
    ];
    const rows = visibleAudit.map((row) => [
      actionLabel(row.action),
      row.actorEmail,
      row.organizationName ?? row.organizationId ?? messages('notApplicable'),
      row.reason,
      row.targetUserId ?? messages('notApplicable'),
      row.result === 'succeeded' ? messages('results.succeeded') : messages('results.failed'),
      formatAuditDate(row.createdAt, locale),
      row.requestId,
      row.correlationId,
    ]);
    const content = [header, ...rows]
      .map((row) => row.map((value) => csvCell(String(value))).join(','))
      .join('\r\n');
    const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orgawork-platform-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="organization-selection platform-console">
      <section className="organization-selection__container">
        <header className="organization-selection__header">
          <div className="organization-selection__brand">
            <span>{application('brandMark')}</span>
            <div>
              <strong>{application('name')}</strong>
              <small>{messages('controlPlaneLabel')}</small>
            </div>
          </div>
        </header>

        <div className="organization-selection__heading">
          <span className="organization-selection__heading-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <p className="eyebrow">{messages('eyebrow')}</p>
          <h1>{messages('title')}</h1>
          <p>{messages('description')}</p>
          {!loading ? (
            <Badge variant="secondary">
              {messages('organizationCount', { count: organizations.length })}
            </Badge>
          ) : null}
        </div>

        {loading ? (
          <div className="management-loading" aria-live="polite">
            <LoaderCircle className="management-spin" aria-hidden="true" />
            <span>{messages('loading')}</span>
          </div>
        ) : null}

        {error === '' ? null : (
          <p className="form-error management-page__error" role="alert">
            {error}
          </p>
        )}
        {notice === '' ? null : (
          <div className="management-notice" role="status">
            <UserRoundCheck aria-hidden="true" />
            <strong>{notice}</strong>
          </div>
        )}

        <div className="platform-console__layout">
          <aside
            className="platform-console__sidebar"
            aria-label={messages('consoleNavigation.label')}
          >
            <div className="platform-console__nav-card">
              <div className="platform-console__nav-heading">
                <span className="organization-selection__heading-icon">
                  <ShieldCheck aria-hidden="true" />
                </span>
                <div>
                  <strong>{messages('consoleNavigation.title')}</strong>
                  <small>{messages('consoleNavigation.description')}</small>
                </div>
              </div>

              <nav className="platform-console__nav">
                <button
                  type="button"
                  data-active={activeSection === 'overview'}
                  onClick={() => setActiveSection('overview')}
                >
                  <span>{messages('consoleNavigation.overview')}</span>
                  <Badge variant="secondary">{organizations.length}</Badge>
                </button>
                <button
                  type="button"
                  data-active={activeSection === 'organizations'}
                  onClick={() => setActiveSection('organizations')}
                >
                  <span>{messages('consoleNavigation.organizations')}</span>
                  <Badge variant="secondary">{organizations.length}</Badge>
                </button>
                <button
                  type="button"
                  data-active={activeSection === 'administration'}
                  onClick={() => setActiveSection('administration')}
                >
                  <span>{messages('consoleNavigation.administration')}</span>
                  <Badge variant="secondary">
                    {organizations.reduce(
                      (count, organization) => count + organization.admins.length,
                      0,
                    )}
                  </Badge>
                </button>
                <button
                  type="button"
                  data-active={activeSection === 'audit'}
                  onClick={() => setActiveSection('audit')}
                >
                  <span>{messages('consoleNavigation.audit')}</span>
                  <Badge variant="secondary">{audit.length}</Badge>
                </button>
              </nav>

              {/* ORGAWORK_PLATFORM_SIDEBAR_ACCOUNT_V3 */}
              <div className="platform-console__nav-footer">
                <div className="platform-console__sidebar-account">
                  <span>{messages('accountLabel')}</span>
                  <strong>{operator?.email ?? '—'}</strong>
                  <Badge variant="secondary">{messages('operatorBadge')}</Badge>
                </div>
                <Button
                  className="platform-console__logout"
                  type="button"
                  variant="secondary"
                  disabled={operator === undefined || loggingOut}
                  onClick={() => void logout()}
                >
                  {loggingOut ? messages('loggingOut') : messages('logoutAction')}
                </Button>
              </div>
            </div>
          </aside>

          <div className="management-page platform-console__workspace">
            <header className="platform-console__workspace-heading">
              <span>{messages('controlPlaneLabel')}</span>
              <h2>
                {activeSection === 'overview'
                  ? messages('consoleNavigation.overview')
                  : activeSection === 'organizations'
                    ? messages('consoleNavigation.organizations')
                    : activeSection === 'administration'
                      ? messages('consoleNavigation.administration')
                      : messages('consoleNavigation.audit')}
              </h2>
            </header>

            {activeSection === 'overview' ? (
              <div className="platform-overview">
                <div className="platform-overview__metrics">
                  <Card className="management-metric">
                    <CardContent>
                      <span>
                        <Building2 aria-hidden="true" />
                      </span>
                      <div>
                        <strong>{organizations.length}</strong>
                        <p>{messages('consoleOverview.organizations')}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="management-metric">
                    <CardContent>
                      <span>
                        <UserRoundCheck aria-hidden="true" />
                      </span>
                      <div>
                        <strong>
                          {organizations.reduce(
                            (count, organization) =>
                              count +
                              organization.admins.filter(
                                (admin) => admin.membershipStatus === 'active',
                              ).length,
                            0,
                          )}
                        </strong>
                        <p>{messages('consoleOverview.activeAdmins')}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="management-metric">
                    <CardContent>
                      <span>
                        <ShieldCheck aria-hidden="true" />
                      </span>
                      <div>
                        <strong>{audit.length}</strong>
                        <p>{messages('consoleOverview.auditRows')}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="management-metric">
                    <CardContent>
                      <span>
                        <ShieldCheck aria-hidden="true" />
                      </span>
                      <div>
                        <strong>{audit.filter((row) => row.result === 'failed').length}</strong>
                        <p>{messages('consoleOverview.failedOperations')}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="management-card platform-overview__actions">
                  <CardHeader>
                    <CardTitle>{messages('consoleOverview.quickActionsTitle')}</CardTitle>
                    <CardDescription>
                      {messages('consoleOverview.quickActionsDescription')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="platform-quick-actions">
                      <Button type="button" onClick={() => setActiveSection('organizations')}>
                        <Building2 aria-hidden="true" />
                        {messages('consoleOverview.openOrganizations')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setActiveSection('audit')}
                      >
                        <ShieldCheck aria-hidden="true" />
                        {messages('consoleOverview.openAudit')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
            <Card className="management-card" hidden={activeSection !== 'organizations'}>
              <CardHeader>
                <CardTitle>{messages('createOrganizationTitle')}</CardTitle>
                <CardDescription>{messages('createOrganizationDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="management-form-grid"
                  onSubmit={(event) => void createOrganization(event)}
                >
                  <div className="field-group">
                    <Label htmlFor="platform-organization-name">
                      {messages('organizationName')}
                    </Label>
                    <Input
                      id="platform-organization-name"
                      name="name"
                      maxLength={120}
                      placeholder={messages('organizationNamePlaceholder')}
                      disabled={creatingOrganization}
                      required
                    />
                  </div>
                  <div className="field-group">
                    <Label htmlFor="platform-organization-reason">{messages('reason')}</Label>
                    <Input
                      id="platform-organization-reason"
                      name="reason"
                      minLength={10}
                      maxLength={500}
                      placeholder={messages('organizationReasonPlaceholder')}
                      disabled={creatingOrganization}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={creatingOrganization}>
                    {creatingOrganization ? (
                      <LoaderCircle className="management-spin" aria-hidden="true" />
                    ) : (
                      <Building2 aria-hidden="true" />
                    )}
                    {creatingOrganization
                      ? messages('creatingOrganization')
                      : messages('createOrganizationAction')}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="management-card" hidden={activeSection !== 'organizations'}>
              <CardHeader>
                <CardTitle>{messages('organizationDirectoryTitle')}</CardTitle>
                <CardDescription>{messages('organizationDirectoryDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="field-group">
                  <Label htmlFor="platform-organization-search">
                    {messages('organizationSearch')}
                  </Label>
                  <Input
                    id="platform-organization-search"
                    value={organizationSearch}
                    onChange={(event) => setOrganizationSearch(event.target.value)}
                    placeholder={messages('organizationSearchPlaceholder')}
                  />
                </div>

                {filteredOrganizations.length === 0 ? (
                  <div className="management-empty">
                    <Building2 aria-hidden="true" />
                    <strong>{messages('organizationDirectoryEmpty')}</strong>
                  </div>
                ) : (
                  <div className="management-table-wrap">
                    <table className="management-table">
                      <thead>
                        <tr>
                          <th>{messages('organizationColumns.name')}</th>
                          <th>{messages('organizationColumns.id')}</th>
                          <th>{messages('organizationColumns.admins')}</th>
                          <th>{messages('organizationColumns.action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrganizations.map((organization) => (
                          <tr key={organization.id}>
                            <td data-label={messages('organizationColumns.name')}>
                              <strong>{organization.name}</strong>
                              {organization.id === selectedOrganizationId ? (
                                <Badge variant="secondary">
                                  {messages('selectedOrganization')}
                                </Badge>
                              ) : null}
                            </td>
                            <td data-label={messages('organizationColumns.id')}>
                              {organization.id}
                            </td>
                            <td data-label={messages('organizationColumns.admins')}>
                              {organization.admins.length === 0
                                ? messages('noOrganizationAdmin')
                                : organization.admins.map((admin) => admin.email).join('، ')}
                            </td>
                            <td data-label={messages('organizationColumns.action')}>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedOrganizationId(organization.id);
                                  setRevokeReason('');
                                  setAdminResult(undefined);
                                  setActiveSection('administration');
                                }}
                              >
                                {messages('selectOrganizationAction')}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {activeSection === 'administration' && selectedOrganization === undefined ? (
              <Card className="management-card platform-selection-required">
                <CardHeader>
                  <CardTitle>{messages('organizationManagementTitle')}</CardTitle>
                  <CardDescription>{messages('selectOrganizationPrompt')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="field-group">
                    <Label htmlFor="platform-organization-selector-empty">
                      {messages('organizationSelector')}
                    </Label>
                    <select
                      id="platform-organization-selector-empty"
                      value=""
                      onChange={(event) => {
                        setSelectedOrganizationId(event.target.value);
                        setRevokeReason('');
                        setAdminResult(undefined);
                      }}
                    >
                      <option value="" disabled>
                        {messages('selectOrganizationPrompt')}
                      </option>
                      {organizations.map((organization) => (
                        <option value={organization.id} key={organization.id}>
                          {organization.name} — {organization.id}
                        </option>
                      ))}
                    </select>
                    <small>{messages('organizationSelectorHelp')}</small>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {activeSection === 'administration' && selectedOrganization !== undefined && (
              <Card className="management-card">
                <CardHeader>
                  <CardTitle>{messages('organizationManagementTitle')}</CardTitle>
                  <CardDescription>{messages('organizationManagementDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="management-form-grid">
                    <div className="field-group">
                      <Label htmlFor="platform-organization-selector">
                        {messages('organizationSelector')}
                      </Label>
                      <select
                        id="platform-organization-selector"
                        value={selectedOrganization.id}
                        onChange={(event) => {
                          setSelectedOrganizationId(event.target.value);
                          setRevokeReason('');
                          setAdminResult(undefined);
                        }}
                      >
                        {organizations.map((organization) => (
                          <option value={organization.id} key={organization.id}>
                            {organization.name} — {organization.id}
                          </option>
                        ))}
                      </select>
                      <small>{messages('organizationSelectorHelp')}</small>
                    </div>
                  </div>

                  <form
                    className="management-form-grid"
                    key={`rename-${selectedOrganization.id}-${selectedOrganization.name}`}
                    onSubmit={(event) => void renameOrganization(event)}
                  >
                    <div className="field-group">
                      <Label htmlFor="platform-rename-name">
                        {messages('renameOrganizationName')}
                      </Label>
                      <Input
                        id="platform-rename-name"
                        name="name"
                        defaultValue={selectedOrganization.name}
                        maxLength={120}
                        disabled={renamingOrganization}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <Label htmlFor="platform-rename-reason">{messages('reason')}</Label>
                      <Input
                        id="platform-rename-reason"
                        name="reason"
                        minLength={10}
                        maxLength={500}
                        placeholder={messages('renameReasonPlaceholder')}
                        disabled={renamingOrganization}
                        required
                      />
                    </div>
                    <Button type="submit" variant="secondary" disabled={renamingOrganization}>
                      {renamingOrganization ? (
                        <LoaderCircle className="management-spin" aria-hidden="true" />
                      ) : null}
                      {renamingOrganization
                        ? messages('renamingOrganization')
                        : messages('renameOrganizationAction')}
                    </Button>
                  </form>

                  <div className="management-notice">
                    <Building2 aria-hidden="true" />
                    <div>
                      <strong>{selectedOrganization.name}</strong>
                      <p>{messages('organizationId', { id: selectedOrganization.id })}</p>
                    </div>
                  </div>

                  <div>
                    <h3>{messages('adminsTitle')}</h3>
                    <p>{messages('adminsDescription')}</p>
                  </div>

                  <form
                    className="management-form-grid"
                    onSubmit={(event) => void provisionAdmin(event)}
                  >
                    <div className="field-group">
                      <Label htmlFor="platform-admin-email">{messages('adminEmail')}</Label>
                      <Input
                        id="platform-admin-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder={messages('adminEmailPlaceholder')}
                        disabled={provisioningAdmin}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <Label htmlFor="platform-admin-reason">{messages('reason')}</Label>
                      <Input
                        id="platform-admin-reason"
                        name="reason"
                        minLength={10}
                        maxLength={500}
                        placeholder={messages('adminReasonPlaceholder')}
                        disabled={provisioningAdmin}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={provisioningAdmin}>
                      {provisioningAdmin ? (
                        <LoaderCircle className="management-spin" aria-hidden="true" />
                      ) : (
                        <MailPlus aria-hidden="true" />
                      )}
                      {provisioningAdmin
                        ? messages('provisioningAdmin')
                        : messages('provisionAdminAction')}
                    </Button>
                  </form>

                  {adminResult === undefined ? null : (
                    <div className="management-notice" role="status">
                      <UserRoundCheck aria-hidden="true" />
                      <div>
                        <strong>{adminResult.email}</strong>
                        <p>{messages('adminRoleConfirmed')}</p>
                        {adminResult.accountSetupRequired ? (
                          <p>{messages('accountSetupRequired')}</p>
                        ) : (
                          <p>{messages('accountAlreadyReady')}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedOrganization.admins.length === 0 ? (
                    <div className="management-empty">
                      <UserRoundCheck aria-hidden="true" />
                      <strong>{messages('adminListEmpty')}</strong>
                    </div>
                  ) : (
                    <>
                      <div className="field-group">
                        <Label htmlFor="platform-revoke-reason">{messages('revokeReason')}</Label>
                        <Input
                          id="platform-revoke-reason"
                          value={revokeReason}
                          onChange={(event) => setRevokeReason(event.target.value)}
                          minLength={10}
                          maxLength={500}
                          placeholder={messages('revokeReasonPlaceholder')}
                        />
                        {selectedOrganization.admins.length === 1 ? (
                          <small>{messages('lastAdminProtected')}</small>
                        ) : null}
                      </div>
                      <div className="management-table-wrap">
                        <table className="management-table">
                          <thead>
                            <tr>
                              <th>{messages('adminColumns.email')}</th>
                              <th>{messages('adminColumns.status')}</th>
                              <th>{messages('adminColumns.action')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrganization.admins.map((admin) => (
                              <tr key={admin.membershipId}>
                                <td data-label={messages('adminColumns.email')}>{admin.email}</td>
                                <td data-label={messages('adminColumns.status')}>
                                  {admin.membershipStatus === 'active'
                                    ? messages('membershipStatus.active')
                                    : messages('membershipStatus.suspended')}
                                </td>
                                <td data-label={messages('adminColumns.action')}>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={
                                      selectedOrganization.admins.length === 1 ||
                                      revokeReason.trim().length < 10 ||
                                      revokingMembershipId !== undefined
                                    }
                                    onClick={() => void revokeAdmin(admin)}
                                  >
                                    {revokingMembershipId === admin.membershipId
                                      ? messages('revokingAdmin')
                                      : messages('revokeAdminAction')}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <Card
              className="management-card platform-audit-center"
              hidden={activeSection !== 'audit'}
            >
              <CardHeader>
                <CardTitle>{messages('auditTitle')}</CardTitle>
                <CardDescription>{messages('auditDescriptionAllOperators')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="platform-audit-summary" aria-label={messages('auditSummaryLabel')}>
                  <div>
                    <span>{messages('auditSummary.visibleRows')}</span>
                    <strong>{visibleAudit.length}</strong>
                  </div>
                  <div>
                    <span>{messages('auditSummary.succeeded')}</span>
                    <strong>
                      {visibleAudit.filter((row) => row.result === 'succeeded').length}
                    </strong>
                  </div>
                  <div>
                    <span>{messages('auditSummary.failed')}</span>
                    <strong>{visibleAudit.filter((row) => row.result === 'failed').length}</strong>
                  </div>
                  <div>
                    <span>{messages('auditSummary.organizations')}</span>
                    <strong>
                      {
                        new Set(
                          visibleAudit
                            .filter((row) => row.organizationId !== null)
                            .map((row) => row.organizationId),
                        ).size
                      }
                    </strong>
                  </div>
                </div>

                <div className="management-form-grid platform-report-toolbar">
                  <div className="field-group">
                    <Label htmlFor="platform-audit-organization">
                      {messages('auditOrganizationFilter')}
                    </Label>
                    <select
                      id="platform-audit-organization"
                      value={auditOrganizationFilter}
                      onChange={(event) => setAuditOrganizationFilter(event.target.value)}
                    >
                      <option value="">{messages('allOrganizations')}</option>
                      {organizations.map((organization) => (
                        <option value={organization.id} key={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <Label htmlFor="platform-audit-search">{messages('auditSearch')}</Label>
                    <Input
                      id="platform-audit-search"
                      value={auditTextFilter}
                      onChange={(event) => setAuditTextFilter(event.target.value)}
                      placeholder={messages('auditSearchPlaceholder')}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportAuditCsv}
                    disabled={visibleAudit.length === 0}
                  >
                    {messages('exportAuditCsv')}
                  </Button>
                </div>

                {visibleAudit.length === 0 ? (
                  <div className="management-empty">
                    <ShieldCheck aria-hidden="true" />
                    <strong>{messages('auditEmpty')}</strong>
                  </div>
                ) : (
                  <div className="management-table-wrap">
                    <table className="management-table">
                      <thead>
                        <tr>
                          <th>{messages('auditColumns.action')}</th>
                          <th>{messages('auditColumns.actor')}</th>
                          <th>{messages('auditColumns.organization')}</th>
                          <th>{messages('auditColumns.reason')}</th>
                          <th>{messages('auditColumns.target')}</th>
                          <th>{messages('auditColumns.result')}</th>
                          <th>{messages('auditColumns.time')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAudit.map((row) => (
                          <tr key={row.id}>
                            <td data-label={messages('auditColumns.action')}>
                              {actionLabel(row.action)}
                            </td>
                            <td data-label={messages('auditColumns.actor')}>{row.actorEmail}</td>
                            <td data-label={messages('auditColumns.organization')}>
                              {row.organizationName ?? row.organizationId ?? '—'}
                            </td>
                            <td data-label={messages('auditColumns.reason')}>{row.reason}</td>
                            <td data-label={messages('auditColumns.target')}>
                              {row.targetUserId ?? '—'}
                            </td>
                            <td data-label={messages('auditColumns.result')}>
                              {row.result === 'succeeded'
                                ? messages('results.succeeded')
                                : messages('results.failed')}
                            </td>
                            <td data-label={messages('auditColumns.time')}>
                              {formatAuditDate(row.createdAt, locale)}
                              <details className="platform-audit-details">
                                <summary>{messages('auditTechnicalDetails')}</summary>
                                <code>Request: {row.requestId}</code>
                                <code>Correlation: {row.correlationId}</code>
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
