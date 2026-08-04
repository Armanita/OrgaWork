'use client';

import { useEffect, useState } from 'react';

import { identityRequest, type WebSession } from '@/lib/identity-api';
import { userFacingMessages } from '@/lib/messages.fa';

interface OrganizationRow {
  readonly id: string;
  readonly name: string;
  readonly membershipId: string;
  readonly membershipStatus: 'active';
}

export default function OrganizationPage(): React.ReactElement {
  const messages = userFacingMessages.organization;
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
        setError(caught instanceof Error ? caught.message : 'خواندن سازمان‌ها ناموفق بود.');
      }
    })();
  }, []);

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
      setError(caught instanceof Error ? caught.message : 'تغییر سازمان ناموفق بود.');
    }
  }

  return (
    <main className="center-shell">
      <section className="wide-card">
        <p className="eyebrow">فضای کاری</p>
        <h1>{messages.title}</h1>
        <p className="lead">{messages.description}</p>
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
                <span>عضویت فعال</span>
              </div>
              <button type="button" onClick={() => void selectOrganization(organization.id)}>
                {messages.switchAction}
              </button>
            </article>
          ))}
          {organizations.length === 0 && error === '' ? (
            <p className="muted">سازمان فعالی برای این حساب پیدا نشد.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
