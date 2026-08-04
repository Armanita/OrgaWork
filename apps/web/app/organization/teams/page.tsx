'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';

import { identityRequest, type WebSession } from '@/lib/identity-api';

interface TeamRow {
  readonly id: string;
  readonly name: string;
  readonly memberCount: number;
}

export default function TeamsPage(): React.ReactElement {
  const application = useTranslations('application');
  const messages = useTranslations('teams');
  const common = useTranslations('common');
  const errors = useTranslations('common.errors');
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
      setError(caught instanceof Error ? caught.message : errors('teamsLoadFailed')),
    );
  }, [errors]);

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
      setError(caught instanceof Error ? caught.message : errors('teamCreationFailed'));
    }
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
        <h2>{messages('createTitle')}</h2>
        <form onSubmit={(event) => void createTeam(event)}>
          <input name="name" placeholder={messages('namePlaceholder')} required />
          <button type="submit">{messages('createAction')}</button>
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
            <div className="team-icon">{application('brandMark')}</div>
            <h2>{team.name}</h2>
            <p>{messages('memberCount', { count: team.memberCount })}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
