'use client';

import { Button, Card, CardContent, Input, Label, Mail } from '@workspace/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { AuthPageShell } from '@/components/auth-page-shell';
import { identityRequest } from '@/lib/identity-api';

interface PasswordResetRequestResult {
  readonly accepted: true;
  readonly developmentToken?: string;
}

export default function PasswordResetRequestPage(): React.ReactElement {
  const application = useTranslations('application');
  const authExperience = useTranslations('authExperience');
  const messages = useTranslations('passwordReset');
  const errors = useTranslations('common.errors');
  const [error, setError] = useState('');
  const [developmentToken, setDevelopmentToken] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const securityFeatures = [
    authExperience('features.session'),
    authExperience('features.csrf'),
    authExperience('features.organization'),
  ];

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setAccepted(false);
    const form = new FormData(event.currentTarget);

    try {
      const result = await identityRequest<PasswordResetRequestResult>(
        'auth/password-reset/request',
        {
          method: 'POST',
          body: JSON.stringify({ email: form.get('email') }),
        },
      );
      setDevelopmentToken(result.developmentToken ?? '');
      setAccepted(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('passwordResetRequestFailed'));
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
      <div className="auth-form-heading">
        <p className="eyebrow">{messages('eyebrow')}</p>
        <h1>{messages('requestTitle')}</h1>
        <p>{messages('requestDescription')}</p>
      </div>

      {accepted ? (
        <Card className="recovery-result" role="status">
          <CardContent>
            <h2>{messages('acceptedTitle')}</h2>
            <p>{messages('acceptedDescription')}</p>

            {developmentToken === '' ? null : (
              <div className="development-token">
                <span>{messages('developmentTokenLabel')}</span>
                <code>{developmentToken}</code>
                <Button asChild>
                  <Link href={`/login/reset/confirm?token=${encodeURIComponent(developmentToken)}`}>
                    {messages('continueAction')}
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <form className="auth-form" aria-busy={submitting} onSubmit={(event) => void submit(event)}>
          <div className="form-field">
            <Label htmlFor="reset-email">{messages('email')}</Label>
            <div className="input-control">
              <Mail aria-hidden="true" />
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={messages('emailPlaceholder')}
                required
              />
            </div>
          </div>

          {error === '' ? null : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <Button className="auth-form__submit" type="submit" disabled={submitting}>
            {submitting ? messages('requesting') : messages('requestAction')}
          </Button>
        </form>
      )}

      <div className="auth-form__footer">
        <Link href="/login">{messages('backToLogin')}</Link>
      </div>
    </AuthPageShell>
  );
}
