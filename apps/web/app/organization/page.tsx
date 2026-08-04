'use client';

import {
  Badge,
  Building2,
  Button,
  Card,
  CardContent,
  Check,
  LoaderCircle,
  ShieldCheck,
} from '@workspace/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { identityRequest, type WebSession } from '@/lib/identity-api';

interface OrganizationRow {
  readonly id: string;
  readonly name: string;
  readonly membershipId: string;
  readonly membershipStatus: 'active';
}

export default function OrganizationPage(): React.ReactElement {
  const application = useTranslations('application');
  const messages = useTranslations('organization');
  const errors = useTranslations('common.errors');
  const [session, setSession] = React.useState<WebSession>();
  const [organizations, setOrganizations] = React.useState<readonly OrganizationRow[]>([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [selectingId, setSelectingId] = React.useState<string>();

  React.useEffect(() => {
    let active = true;

    void Promise.all([
      identityRequest<{ readonly session: WebSession }>('auth/session'),
      identityRequest<{
        readonly organizations: readonly OrganizationRow[];
      }>('organizations'),
    ])
      .then(([sessionData, organizationData]) => {
        if (!active) {
          return;
        }

        setSession(sessionData.session);
        setOrganizations(organizationData.organizations);
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }

        setError(caught instanceof Error ? caught.message : errors('organizationsLoadFailed'));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [errors]);

  async function selectOrganization(organizationId: string): Promise<void> {
    if (session === undefined || selectingId !== undefined) {
      return;
    }

    if (session.currentOrganizationId === organizationId) {
      window.location.assign('/');
      return;
    }

    setSelectingId(organizationId);
    setError('');

    try {
      await identityRequest('auth/current-organization', {
        method: 'POST',
        headers: { 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ organizationId }),
      });
      window.location.assign('/');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('organizationSwitchFailed'));
      setSelectingId(undefined);
    }
  }

  return (
    <main className="organization-selection">
      <section className="organization-selection__container">
        <header className="organization-selection__header">
          <div className="organization-selection__brand">
            <span>{application('brandMark')}</span>
            <div>
              <strong>{application('name')}</strong>
              <small>{application('tagline')}</small>
            </div>
          </div>

          {session === undefined ? null : (
            <div className="organization-selection__account">
              <span>{messages('accountLabel')}</span>
              <strong>{session.email}</strong>
            </div>
          )}
        </header>

        <div className="organization-selection__heading">
          <span className="organization-selection__heading-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <p className="eyebrow">{messages('eyebrow')}</p>
          <h1>{messages('title')}</h1>
          <p>{messages('description')}</p>

          {loading ? null : (
            <Badge variant="secondary">
              {messages('organizationCount', {
                count: organizations.length,
              })}
            </Badge>
          )}
        </div>

        {error === '' ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div
          className="organization-selection__grid"
          aria-busy={loading || selectingId !== undefined}
          aria-live="polite"
        >
          {loading ? (
            <>
              <div className="organization-card organization-card--loading" />
              <div className="organization-card organization-card--loading" />
            </>
          ) : null}

          {organizations.map((organization) => {
            const current = session?.currentOrganizationId === organization.id;
            const selecting = selectingId === organization.id;

            return (
              <Card className="organization-card" data-current={current} key={organization.id}>
                <CardContent>
                  <div className="organization-card__icon">
                    <Building2 aria-hidden="true" />
                  </div>

                  <div className="organization-card__copy">
                    <div>
                      <h2>{organization.name}</h2>
                      {current ? (
                        <Badge variant="success">
                          <Check aria-hidden="true" />
                          {messages('currentBadge')}
                        </Badge>
                      ) : null}
                    </div>
                    <p>{messages('membershipLabel')}</p>
                  </div>

                  <Button
                    type="button"
                    variant={current ? 'secondary' : 'default'}
                    disabled={selectingId !== undefined}
                    onClick={() => void selectOrganization(organization.id)}
                  >
                    {selecting ? (
                      <LoaderCircle className="organization-card__spinner" aria-hidden="true" />
                    ) : null}
                    {selecting
                      ? messages('selecting')
                      : current
                        ? messages('continueAction')
                        : messages('switchAction')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {!loading && organizations.length === 0 && error === '' ? (
            <div className="organization-selection__empty">
              <Building2 aria-hidden="true" />
              <p>{messages('empty')}</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
