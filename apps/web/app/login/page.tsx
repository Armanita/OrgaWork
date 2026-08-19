'use client';

import { Button, Input, Label, LockKeyhole, Mail } from '@workspace/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { AuthPageShell } from '@/components/auth-page-shell';
import { PasswordField } from '@/components/password-field';
import { identityRequest } from '@/lib/identity-api';
import { PlatformRequestError, platformRequest } from '@/lib/platform-api';

export default function LoginPage(): React.ReactElement {
  const application = useTranslations('application');
  const authExperience = useTranslations('authExperience');
  const messages = useTranslations('login');
  const errors = useTranslations('common.errors');
  const [error, setError] = useState('');
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
    const form = new FormData(event.currentTarget);

    try {
      await identityRequest('auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      try {
        await platformRequest('session');
        window.location.assign('/platform');
      } catch (platformError: unknown) {
        if (platformError instanceof PlatformRequestError && platformError.status === 403) {
          window.location.assign('/organization');
          return;
        }
        throw platformError;
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('loginFailed'));
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
        <span className="auth-form-heading__icon">
          <LockKeyhole aria-hidden="true" />
        </span>
        <p className="eyebrow">{messages('eyebrow')}</p>
        <h1>{messages('title')}</h1>
        <p>{messages('description')}</p>
      </div>

      <form className="auth-form" aria-busy={submitting} onSubmit={(event) => void submit(event)}>
        <div className="form-field">
          <Label htmlFor="login-email">{messages('email')}</Label>
          <div className="input-control">
            <Mail aria-hidden="true" />
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={messages('emailPlaceholder')}
              required
            />
          </div>
        </div>

        <PasswordField
          id="login-password"
          name="password"
          autoComplete="current-password"
          minLength={15}
          placeholder={messages('passwordPlaceholder')}
          label={messages('password')}
          showLabel={messages('showPassword')}
          hideLabel={messages('hidePassword')}
          required
        />

        {error === '' ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <Button className="auth-form__submit" type="submit" disabled={submitting}>
          {submitting ? messages('submitting') : messages('submit')}
        </Button>
      </form>

      <div className="auth-form__footer">
        <Link href="/login/reset">{messages('forgot')}</Link>
        <p>{messages('securityHint')}</p>
      </div>
    </AuthPageShell>
  );
}
