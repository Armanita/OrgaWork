'use client';

import { Button, Input, Label } from '@workspace/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { AuthPageShell } from '@/components/auth-page-shell';
import { PasswordField } from '@/components/password-field';
import { identityRequest } from '@/lib/identity-api';

export interface PasswordResetConfirmFormProps {
  readonly initialToken: string;
}

export function PasswordResetConfirmForm({
  initialToken,
}: PasswordResetConfirmFormProps): React.ReactElement {
  const application = useTranslations('application');
  const authExperience = useTranslations('authExperience');
  const login = useTranslations('login');
  const messages = useTranslations('passwordReset');
  const errors = useTranslations('common.errors');
  const [token, setToken] = React.useState(initialToken);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const securityFeatures = [
    authExperience('features.session'),
    authExperience('features.csrf'),
    authExperience('features.organization'),
  ];

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const passwordValue = form.get('password');
    const confirmationValue = form.get('passwordConfirmation');
    const password = typeof passwordValue === 'string' ? passwordValue : '';
    const confirmation = typeof confirmationValue === 'string' ? confirmationValue : '';

    if (password !== confirmation) {
      setError(messages('passwordMismatch'));
      return;
    }

    setSubmitting(true);

    try {
      await identityRequest('auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('passwordResetConfirmFailed'));
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
        <h1>{messages('confirmTitle')}</h1>
        <p>{messages('confirmDescription')}</p>
      </div>

      {success ? (
        <div className="form-success" role="status">
          <h2>{messages('successTitle')}</h2>
          <p>{messages('successDescription')}</p>
          <Button asChild>
            <Link href="/login">{login('submit')}</Link>
          </Button>
        </div>
      ) : (
        <form className="auth-form" aria-busy={submitting} onSubmit={(event) => void submit(event)}>
          <div className="form-field">
            <Label htmlFor="reset-token">{messages('token')}</Label>
            <Input
              id="reset-token"
              name="token"
              value={token}
              autoComplete="off"
              placeholder={messages('tokenPlaceholder')}
              onChange={(event) => setToken(event.target.value)}
              required
            />
          </div>

          <PasswordField
            id="new-password"
            name="password"
            autoComplete="new-password"
            minLength={15}
            placeholder={messages('newPasswordPlaceholder')}
            label={messages('newPassword')}
            showLabel={login('showPassword')}
            hideLabel={login('hidePassword')}
            required
          />

          <PasswordField
            id="confirm-new-password"
            name="passwordConfirmation"
            autoComplete="new-password"
            minLength={15}
            placeholder={messages('confirmPasswordPlaceholder')}
            label={messages('confirmPassword')}
            showLabel={login('showPassword')}
            hideLabel={login('hidePassword')}
            required
          />

          {error === '' ? null : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <Button className="auth-form__submit" type="submit" disabled={submitting}>
            {submitting ? messages('confirming') : messages('confirmAction')}
          </Button>
        </form>
      )}

      <div className="auth-form__footer">
        <Link href="/login">{messages('backToLogin')}</Link>
      </div>
    </AuthPageShell>
  );
}
