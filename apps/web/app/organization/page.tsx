'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { identityRequest, type WebSession } from '@/lib/identity-api';

interface OrganizationRow {
  readonly id: string;
  readonly name: string;
  readonly membershipId: string;
  readonly membershipStatus: 'active';
}

export default function OrganizationPage(): React.ReactElement {
  const messages = useTranslations('organization');
  const common = useTranslations('common');
  const errors = useTranslations('common.errors');
  const [session, setSession] = useState<WebSession>();
  const [organizations, setOrganizations] = useState<readonly OrganizationRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const sessionData = await identityRequest<{ readonly session: WebSession }>('auth/session');
        const organizationData = await identityRequest<{
          readonly organizations: readonly OrganizationRow[];
        }>('organizations');
        setSession(sessionData.session);
        setOrganizations(organizationData.organizations);
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : errors('organizationsLoadFailed'));
      }
    })();
  }, [errors]);

  async function selectOrganization(organizationId: string): Promise<void> {
    if (session === undefined) return;

    try {
      await identityRequest('auth/current-organization', {
        method: 'POST',
        headers: { 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ organizationId }),
      });
      window.location.assign('/');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('organizationSwitchFailed'));
    }
  }

  return (
    <main className="center-shell">
      <section className="wide-card">
        <p className="eyebrow">{messages('eyebrow')}</p>
        <h1>{messages('title')}</h1>
        <p className="lead">{messages('description')}</p>
        {error === '' ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="organization-list">
          {organizations.map((organization) => (
            <article key={organization.id}>
              <div>
                <strong>{organization.name}</strong>
                <span>{common('activeMembership')}</span>
              </div>
              <button type="button" onClick={() => void selectOrganization(organization.id)}>
                {messages('switchAction')}
              </button>
            </article>
          ))}
          {organizations.length === 0 && error === '' ? (
            <p className="muted">{messages('empty')}</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
