'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  LoaderCircle,
  MailPlus,
  ShieldCheck,
} from '@workspace/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import * as React from 'react';

import { AuthPageShell } from '@/components/auth-page-shell';
import { identityRequest, type WebSession } from '@/lib/identity-api';

export default function InvitationAcceptancePage(): React.ReactElement {
  const application = useTranslations('application');
  const authExperience = useTranslations('authExperience');
  const messages = useTranslations('invitationAcceptance');
  const errors = useTranslations('common.errors');
  const params = useParams<{ readonly token: string }>();
  const [error, setError] = React.useState('');
  const [accepted, setAccepted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const securityFeatures = [
    authExperience('features.session'),
    authExperience('features.csrf'),
    authExperience('features.organization'),
  ];

  async function acceptInvitation(): Promise<void> {
    if (submitting || accepted) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const sessionData = await identityRequest<{ readonly session: WebSession }>('auth/session');

      await identityRequest(`invitations/${encodeURIComponent(params.token)}/accept`, {
        method: 'POST',
        headers: { 'x-csrf-token': sessionData.session.csrfToken },
      });
      setAccepted(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('invitationAcceptFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      applicationName={application('name')}
      brandMark={application('brandMark')}
      tagline={application('tagline')}
      visualEyebrow={authExperience('eyebrow')}
      visualTitle={authExperience('title')}
      visualDescription={authExperience('description')}
      features={securityFeatures}
    >
      <Card className="auth-form-card invitation-acceptance">
        <CardHeader>
          <span className="auth-form-card__icon">
            {accepted ? <ShieldCheck aria-hidden="true" /> : <MailPlus aria-hidden="true" />}
          </span>
          <p className="auth-form-card__eyebrow">{messages('eyebrow')}</p>
          <h1 className="invitation-acceptance__title">
            {accepted ? messages('acceptedTitle') : messages('title')}
          </h1>
          <CardDescription>
            {accepted ? messages('acceptedDescription') : messages('description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error === '' ? null : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {accepted ? (
            <Button asChild className="auth-form-card__submit">
              <Link href="/organization">{messages('continueAction')}</Link>
            </Button>
          ) : (
            <div className="invitation-acceptance__actions">
              <p>{messages('accountRequired')}</p>
              <Button
                type="button"
                disabled={submitting || params.token.trim() === ''}
                onClick={() => void acceptInvitation()}
              >
                {submitting ? (
                  <LoaderCircle className="management-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck aria-hidden="true" />
                )}
                {submitting ? messages('accepting') : messages('acceptAction')}
              </Button>
              <Button asChild variant="link">
                <Link href="/login">{messages('backToLogin')}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
