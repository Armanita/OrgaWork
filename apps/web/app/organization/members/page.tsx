'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';

import { identityRequest, type WebSession } from '@/lib/identity-api';

interface MemberRow {
  readonly id: string;
  readonly email: string;
  readonly status: 'invited' | 'active' | 'suspended' | 'revoked';
  readonly roleKeys: readonly string[];
}

type KnownRole = 'member' | 'manager' | 'organization_admin';

function isKnownRole(role: string): role is KnownRole {
  return role === 'member' || role === 'manager' || role === 'organization_admin';
}

export default function MembersPage(): React.ReactElement {
  const messages = useTranslations('members');
  const common = useTranslations('common');
  const errors = useTranslations('common.errors');
  const [session, setSession] = useState<WebSession>();
  const [members, setMembers] = useState<readonly MemberRow[]>([]);
  const [error, setError] = useState('');

  async function load(): Promise<void> {
    const sessionData = await identityRequest<{ readonly session: WebSession }>('auth/session');

    if (sessionData.session.currentOrganizationId === null) {
      window.location.assign('/organization');
      return;
    }

    setSession(sessionData.session);
    const data = await identityRequest<{ readonly memberships: readonly MemberRow[] }>(
      `organizations/${sessionData.session.currentOrganizationId}/memberships`,
    );
    setMembers(data.memberships);
  }

  useEffect(() => {
    void load().catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : errors('membersLoadFailed')),
    );
  }, [errors]);

  async function invite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (session?.currentOrganizationId === null || session === undefined) return;

    const form = new FormData(event.currentTarget);

    try {
      await identityRequest(`organizations/${session.currentOrganizationId}/invitations`, {
        method: 'POST',
        headers: { 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({
          email: form.get('email'),
          roleKey: form.get('roleKey'),
        }),
      });
      event.currentTarget.reset();
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('invitationFailed'));
    }
  }

  function roleLabel(role: string): string {
    return isKnownRole(role) ? common(`roles.${role}`) : role;
  }

  return (
    <main className="management-shell">
      <header className="management-header">
        <div>
          <Link href="/">{common('backToOverview')}</Link>
          <h1>{messages('title')}</h1>
        </div>
      </header>
      <section className="panel management-form">
        <h2>{messages('inviteTitle')}</h2>
        <form onSubmit={(event) => void invite(event)}>
          <input name="email" type="email" placeholder={messages('emailPlaceholder')} required />
          <select name="roleKey" defaultValue="member" aria-label={messages('roleLabel')}>
            <option value="member">{common('roles.member')}</option>
            <option value="manager">{common('roles.manager')}</option>
            <option value="organization_admin">{common('roles.organization_admin')}</option>
          </select>
          <button type="submit">{messages('sendInvitation')}</button>
        </form>
      </section>
      {error === '' ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{messages('columns.email')}</th>
                <th>{messages('columns.role')}</th>
                <th>{messages('columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.email}</td>
                  <td>
                    {member.roleKeys.length === 0
                      ? common('noRole')
                      : member.roleKeys.map(roleLabel).join(', ')}
                  </td>
                  <td>
                    <span
                      className={member.status === 'active' ? 'badge success' : 'badge warning'}
                    >
                      {common(`status.${member.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
