'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { identityRequest } from '@/lib/identity-api';
import { userFacingMessages } from '@/lib/messages.fa';

export default function LoginPage(): React.ReactElement {
  const messages = userFacingMessages.login;
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await identityRequest('auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      window.location.assign('/organization');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'ورود ناموفق بود.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand centered">
          <span className="brand-mark">ا</span>
          <div>
            <strong>اورگاوُرک</strong>
            <small>سامانه پیگیری سازمانی</small>
          </div>
        </div>
        <h1>{messages.title}</h1>
        <p className="muted">{messages.description}</p>
        <form className="form-stack" onSubmit={submit}>
          <label>
            {messages.email}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            {messages.password}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={15}
              required
            />
          </label>
          {error === '' ? null : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? 'در حال ورود' : messages.submit}
          </button>
        </form>
        <Link className="text-link" href="/login/reset">
          {messages.forgot}
        </Link>
      </section>
    </main>
  );
}
