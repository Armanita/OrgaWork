'use client';

import { Check, ShieldCheck } from '@workspace/ui';

export interface AuthPageShellProps {
  readonly applicationName: string;
  readonly brandMark: string;
  readonly tagline: string;
  readonly visualEyebrow: string;
  readonly visualTitle: string;
  readonly visualDescription: string;
  readonly features: readonly string[];
  readonly children: React.ReactNode;
}

export function AuthPageShell({
  applicationName,
  brandMark,
  tagline,
  visualEyebrow,
  visualTitle,
  visualDescription,
  features,
  children,
}: AuthPageShellProps): React.ReactElement {
  return (
    <main className="auth-experience">
      <section className="auth-experience__form-panel">
        <div className="auth-experience__brand">
          <span className="auth-experience__brand-mark">{brandMark}</span>
          <span className="auth-experience__brand-copy">
            <strong>{applicationName}</strong>
            <span>{tagline}</span>
          </span>
        </div>

        <div className="auth-experience__content">{children}</div>
      </section>

      <aside className="auth-experience__visual">
        <div className="auth-experience__visual-content">
          <span className="auth-experience__visual-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <p className="auth-experience__visual-eyebrow">{visualEyebrow}</p>
          <h2>{visualTitle}</h2>
          <p>{visualDescription}</p>

          <ul className="auth-experience__features">
            {features.map((feature) => (
              <li key={feature}>
                <span>
                  <Check aria-hidden="true" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
