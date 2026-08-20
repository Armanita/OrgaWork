'use client';

import {
  Badge,
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
  RefreshCw,
  Search,
  UserRoundCheck,
  Users,
} from '@workspace/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import {
  MemberAccessEditor,
  type MembershipStatus,
  type OrganizationRoleKey,
  type TenantAssignableOrganizationRoleKey,
} from '@/components/member-access-editor';
import { DashboardShell } from '@/components/dashboard-shell';
import { ManagementPageHeader } from '@/components/management-page-header';
import { identityRequest, type WebSession } from '@/lib/identity-api';

interface MemberRow {
  readonly id: string;
  readonly email: string;
  readonly status: MembershipStatus;
  readonly roleKeys: readonly OrganizationRoleKey[];
}

interface InvitationResult {
  readonly id: string;
  readonly reused: boolean;
  readonly token?: string;
}

const statusValues: readonly MembershipStatus[] = ['invited', 'active', 'suspended', 'revoked'];

function statusVariant(
  status: MembershipStatus,
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'invited') return 'warning';
  if (status === 'revoked') return 'destructive';
  return 'secondary';
}

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function isRole(value: string): value is TenantAssignableOrganizationRoleKey {
  return value === 'member' || value === 'manager';
}

export default function MembersPage(): React.ReactElement {
  const messages = useTranslations('members');
  const common = useTranslations('common');
  const errors = useTranslations('common.errors');
  const [session, setSession] = React.useState<WebSession>();
  const [members, setMembers] = React.useState<readonly MemberRow[]>([]);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [inviting, setInviting] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string>();
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<MembershipStatus | 'all'>('all');
  const [invitation, setInvitation] = React.useState<InvitationResult>();

  const load = React.useCallback(
    async (showLoading = true): Promise<void> => {
      if (showLoading) {
        setLoading(true);
      }

      setError('');

      try {
        const sessionData = await identityRequest<{ readonly session: WebSession }>('auth/session');

        if (sessionData.session.currentOrganizationId === null) {
          window.location.assign('/organization');
          return;
        }

        const organizationId = sessionData.session.currentOrganizationId;
        const data = await identityRequest<{
          readonly memberships: readonly MemberRow[];
        }>(`organizations/${organizationId}/memberships`, {
          headers: { 'x-csrf-token': sessionData.session.csrfToken },
        });

        setSession(sessionData.session);
        setMembers(data.memberships);
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : errors('membersLoadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [errors],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const filteredMembers = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('en-US');

    return members.filter((member) => {
      const matchesQuery =
        normalizedQuery === '' || member.email.toLocaleLowerCase('en-US').includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [members, query, statusFilter]);

  const memberCounts = React.useMemo(
    () => ({
      total: members.length,
      active: members.filter((member) => member.status === 'active').length,
      invited: members.filter((member) => member.status === 'invited').length,
      suspended: members.filter((member) => member.status === 'suspended').length,
    }),
    [members],
  );

  async function invite(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (session === undefined || session.currentOrganizationId === null || inviting) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = readText(form, 'email');
    const roleCandidate = readText(form, 'roleKey');
    const roleKey: TenantAssignableOrganizationRoleKey = isRole(roleCandidate)
      ? roleCandidate
      : 'member';

    if (email === '') {
      return;
    }

    setInviting(true);
    setError('');
    setNotice('');
    setInvitation(undefined);

    try {
      const result = await identityRequest<InvitationResult>(
        `organizations/${session.currentOrganizationId}/invitations`,
        {
          method: 'POST',
          headers: { 'x-csrf-token': session.csrfToken },
          body: JSON.stringify({ email, roleKey }),
        },
      );

      formElement.reset();
      setInvitation(result);
      setNotice(result.reused ? messages('invitationReused') : messages('invitationSent'));
      await load(false);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('invitationFailed'));
    } finally {
      setInviting(false);
    }
  }

  async function updateMemberStatus(memberId: string, status: MembershipStatus): Promise<boolean> {
    if (session?.currentOrganizationId === null || session === undefined) {
      return false;
    }

    setUpdatingId(memberId);
    setError('');
    setNotice('');

    try {
      await identityRequest(
        `organizations/${session.currentOrganizationId}/memberships/${memberId}`,
        {
          method: 'PATCH',
          headers: { 'x-csrf-token': session.csrfToken },
          body: JSON.stringify({ status }),
        },
      );
      setNotice(messages('updateSuccess'));
      await load(false);
      return true;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('memberUpdateFailed'));
      return false;
    } finally {
      setUpdatingId(undefined);
    }
  }

  async function updateMemberRoles(
    memberId: string,
    roleKeys: readonly TenantAssignableOrganizationRoleKey[],
  ): Promise<boolean> {
    if (session?.currentOrganizationId === null || session === undefined || roleKeys.length === 0) {
      return false;
    }

    setUpdatingId(memberId);
    setError('');
    setNotice('');

    try {
      await identityRequest(
        `organizations/${session.currentOrganizationId}/memberships/${memberId}/roles`,
        {
          method: 'PATCH',
          headers: { 'x-csrf-token': session.csrfToken },
          body: JSON.stringify({ roleKeys }),
        },
      );
      setNotice(messages('updateSuccess'));
      await load(false);
      return true;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('memberRolesUpdateFailed'));
      return false;
    } finally {
      setUpdatingId(undefined);
    }
  }

  return (
    <DashboardShell>
      <section className="management-page">
        <ManagementPageHeader
          eyebrow={messages('eyebrow')}
          title={messages('title')}
          description={messages('description')}
          countLabel={messages('memberCount', { count: memberCounts.total })}
          actions={
            <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={loading ? 'management-spin' : undefined} aria-hidden="true" />
              {messages('refresh')}
            </Button>
          }
        />

        <div className="management-metrics" aria-label={messages('summaryLabel')}>
          <Card className="management-metric">
            <CardContent>
              <span>
                <Users aria-hidden="true" />
              </span>
              <div>
                <strong>{memberCounts.total}</strong>
                <p>{messages('totalCount')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="management-metric">
            <CardContent>
              <span>
                <UserRoundCheck aria-hidden="true" />
              </span>
              <div>
                <strong>{memberCounts.active}</strong>
                <p>{messages('activeCount')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="management-metric">
            <CardContent>
              <span>
                <MailPlus aria-hidden="true" />
              </span>
              <div>
                <strong>{memberCounts.invited}</strong>
                <p>{messages('invitedCount')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="management-metric">
            <CardContent>
              <span>
                <Users aria-hidden="true" />
              </span>
              <div>
                <strong>{memberCounts.suspended}</strong>
                <p>{messages('suspendedCount')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="management-card">
          <CardHeader>
            <CardTitle>{messages('inviteTitle')}</CardTitle>
            <CardDescription>{messages('inviteDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="management-form-grid" onSubmit={(event) => void invite(event)}>
              <div className="field-group">
                <Label htmlFor="member-email">{messages('emailLabel')}</Label>
                <Input
                  id="member-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={messages('emailPlaceholder')}
                  disabled={inviting}
                  required
                />
              </div>
              <div className="field-group">
                <Label htmlFor="member-role">{messages('roleLabel')}</Label>
                <select id="member-role" name="roleKey" defaultValue="member" disabled={inviting}>
                  <option value="member">{common('roles.member')}</option>
                  <option value="manager">{common('roles.manager')}</option>
                </select>
              </div>
              <Button type="submit" disabled={inviting}>
                {inviting ? (
                  <LoaderCircle className="management-spin" aria-hidden="true" />
                ) : (
                  <MailPlus aria-hidden="true" />
                )}
                {inviting ? messages('sendingInvitation') : messages('sendInvitation')}
              </Button>
            </form>

            {notice === '' ? null : (
              <div className="management-notice" role="status">
                <UserRoundCheck aria-hidden="true" />
                <div>
                  <strong>{notice}</strong>
                  {invitation?.token === undefined ? null : (
                    <>
                      <p>{messages('invitationDevelopmentLink')}</p>
                      <Link href={`/invitations/${encodeURIComponent(invitation.token)}`}>
                        {messages('openInvitation')}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error === '' ? null : (
          <p className="form-error management-page__error" role="alert">
            {error}
          </p>
        )}

        <Card className="management-card">
          <CardHeader>
            <CardTitle>{messages('directoryTitle')}</CardTitle>
            <CardDescription>{messages('directoryDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="management-toolbar">
              <label className="management-search">
                <Search aria-hidden="true" />
                <span className="sr-only">{messages('searchLabel')}</span>
                <Input
                  value={query}
                  type="search"
                  placeholder={messages('searchPlaceholder')}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
              </label>
              <label className="management-filter">
                <span>{messages('statusFilterLabel')}</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.currentTarget.value as MembershipStatus | 'all')
                  }
                >
                  <option value="all">{messages('allStatuses')}</option>
                  {statusValues.map((status) => (
                    <option key={status} value={status}>
                      {common(`status.${status}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <div className="management-loading" aria-live="polite">
                <LoaderCircle className="management-spin" aria-hidden="true" />
                <span>{messages('loading')}</span>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="management-empty">
                <Users aria-hidden="true" />
                <strong>{members.length === 0 ? messages('empty') : messages('noResults')}</strong>
              </div>
            ) : (
              <div className="management-table-wrap">
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>{messages('columns.email')}</th>
                      <th>{messages('columns.role')}</th>
                      <th>{messages('columns.status')}</th>
                      <th>{messages('columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr key={member.id}>
                        <td data-label={messages('columns.email')}>
                          <div className="member-identity">
                            <span>{member.email.slice(0, 1).toLocaleUpperCase('en-US')}</span>
                            <strong>{member.email}</strong>
                          </div>
                        </td>
                        <td data-label={messages('columns.role')}>
                          <div className="member-role-list">
                            {member.roleKeys.length === 0 ? (
                              <Badge variant="outline">{common('noRole')}</Badge>
                            ) : (
                              member.roleKeys.map((role) => (
                                <Badge key={role} variant="secondary">
                                  {common(`roles.${role}`)}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td data-label={messages('columns.status')}>
                          <Badge variant={statusVariant(member.status)}>
                            {common(`status.${member.status}`)}
                          </Badge>
                        </td>
                        <td data-label={messages('columns.actions')}>
                          <MemberAccessEditor
                            key={`${member.id}:${member.status}:${member.roleKeys.join(',')}`}
                            memberId={member.id}
                            status={member.status}
                            roleKeys={member.roleKeys}
                            busy={updatingId === member.id}
                            onStatusChange={updateMemberStatus}
                            onRolesChange={updateMemberRoles}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}
