'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

import { identityRequest, type WebSession } from '@/lib/identity-api';
import { userFacingMessages } from '@/lib/messages.fa';

interface TeamRow {
  readonly id: string;
  readonly name: string;
  readonly memberCount: number;
}

export default function TeamsPage(): React.ReactElement {
  const messages = userFacingMessages.teams;
  const [session, setSession] = useState<WebSession>();
  const [teams, setTeams] = useState<readonly TeamRow[]>([]);
  const [error, setError] = useState('');

  async function load(): Promise<void> {
    const sessionData = await identityRequest<{ readonly session: WebSession }>('auth/session');
    if (sessionData.session.currentOrganizationId === null) {
      window.location.assign('/organization');
      return;
    }
    setSession(sessionData.session);
    const data = await identityRequest<{ readonly teams: readonly TeamRow[] }>(
      `organizations/${sessionData.session.currentOrganizationId}/teams`,
    );
    setTeams(data.teams);
  }

  useEffect(() => {
    void load().catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : 'خواندن تیم‌ها ناموفق بود.'),
    );
  }, []);

  async function createTeam(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (session?.currentOrganizationId === null || session === undefined) return;
    const form = new FormData(event.currentTarget);
    try {
      await identityRequest(`organizations/${session.currentOrganizationId}/teams`, {
        method: 'POST',
        headers: { 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ name: form.get('name') }),
      });
      event.currentTarget.reset();
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'ایجاد تیم ناموفق بود.');
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
        <h2>{messages.create}</h2>
        <form onSubmit={createTeam}>
          <input name="name" placeholder="نام تیم" required />
          <button type="submit">ایجاد تیم</button>
        </form>
      </section>
      {error === '' ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="team-grid">
        {teams.map((team) => (
          <article className="panel team-card" key={team.id}>
            <div className="team-icon">ت</div>
            <h2>{team.name}</h2>
            <p>{team.memberCount.toLocaleString('fa-IR')} عضو</p>
          </article>
        ))}
      </section>
    </main>
  );
}
