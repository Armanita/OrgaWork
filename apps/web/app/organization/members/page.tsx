'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

import { identityRequest, type WebSession } from '@/lib/identity-api';
import { userFacingMessages } from '@/lib/messages.fa';

interface MemberRow {
  readonly id: string;
  readonly email: string;
  readonly status: 'invited' | 'active' | 'suspended' | 'revoked';
  readonly roleKeys: readonly string[];
}

export default function MembersPage(): React.ReactElement {
  const messages = userFacingMessages.members;
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
      setError(caught instanceof Error ? caught.message : 'خواندن اعضا ناموفق بود.'),
    );
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (session?.currentOrganizationId === null || session === undefined) return;
    const form = new FormData(event.currentTarget);
    try {
      await identityRequest(`organizations/${session.currentOrganizationId}/invitations`, {
        method: 'POST',
        headers: { 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ email: form.get('email'), roleKey: form.get('roleKey') }),
      });
      event.currentTarget.reset();
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'ارسال دعوت ناموفق بود.');
    }
  }

  return (
    <main className="management-shell">
      <header className="management-header">
        <div>
          <Link href="/">بازگشت به نمای کلی</Link>
          <h1>{messages.title}</h1>
        </div>
      </header>
      <section className="panel management-form">
        <h2>{messages.invite}</h2>
        <form onSubmit={invite}>
          <input name="email" type="email" placeholder="ایمیل عضو" required />
          <select name="roleKey" defaultValue="member">
            <option value="member">عضو</option>
            <option value="manager">مدیر</option>
            <option value="organization_admin">مدیر سازمان</option>
          </select>
          <button type="submit">ارسال دعوت</button>
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
                <th>ایمیل</th>
                <th>نقش</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.email}</td>
                  <td>{member.roleKeys.join('، ') || 'بدون نقش'}</td>
                  <td>
                    <span
                      className={member.status === 'active' ? 'badge success' : 'badge warning'}
                    >
                      {member.status === 'active'
                        ? 'فعال'
                        : member.status === 'suspended'
                          ? 'تعلیق‌شده'
                          : member.status === 'revoked'
                            ? 'لغوشده'
                            : 'دعوت‌شده'}
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
