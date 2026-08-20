'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Check,
  Input,
  Label,
  LoaderCircle,
} from '@workspace/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { identityRequest, type WebSession } from '@/lib/identity-api';
import {
  WorkManagementApiError,
  workManagementRequest,
  type CreateOwnCaseResult,
} from '@/lib/work-management-api';

type Priority = 'low' | 'normal' | 'high';
type ErrorKey = 'required' | 'authorization' | 'conflict' | 'session' | 'unavailable';

function textField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function priorityField(data: FormData): Priority | undefined {
  const value = data.get('priority');
  return value === 'low' || value === 'normal' || value === 'high' ? value : undefined;
}

function errorKey(error: unknown): ErrorKey {
  if (!(error instanceof WorkManagementApiError)) return 'unavailable';
  if (error.code === 'AUTHORIZATION_DENIED') return 'authorization';
  if (error.code === 'CONFLICT') return 'conflict';
  if (error.code === 'VALIDATION_ERROR') return 'required';
  return 'unavailable';
}

export function CreateOwnCaseForm(): React.ReactElement {
  const messages = useTranslations('workManagement.createOwnCase');
  const [session, setSession] = useState<WebSession | undefined>();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorKey | undefined>();
  const [created, setCreated] = useState<CreateOwnCaseResult | undefined>();

  useEffect(() => {
    let cancelled = false;

    void identityRequest<{ session: WebSession }>('auth/session')
      .then((data) => {
        if (!cancelled) setSession(data.session);
      })
      .catch(() => {
        if (!cancelled) setError('session');
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (session?.currentOrganizationId === null || session === undefined) {
      setError('session');
      return;
    }

    const data = new FormData(event.currentTarget);
    const title = textField(data, 'title');
    const description = textField(data, 'description');
    const initialActionTitle = textField(data, 'initialActionTitle');
    const priority = priorityField(data);

    if (title === '' || description === '' || initialActionTitle === '' || priority === undefined) {
      setError('required');
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      const result = await workManagementRequest<CreateOwnCaseResult>(
        `organizations/${session.currentOrganizationId}/cases`,
        {
          method: 'POST',
          headers: {
            'x-csrf-token': session.csrfToken,
            'x-idempotency-key': `wm01:web:${crypto.randomUUID()}`,
          },
          body: JSON.stringify({
            title,
            description,
            priority,
            initialActionTitle,
          }),
        },
      );
      setCreated(result);
    } catch (requestError) {
      setError(errorKey(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionLoading) {
    return (
      <Card className="case-create-card" aria-live="polite">
        <CardContent className="case-create-loading">
          <LoaderCircle className="management-spin" aria-hidden="true" />
          <span>{messages('loadingSession')}</span>
        </CardContent>
      </Card>
    );
  }

  if (created !== undefined) {
    return (
      <Card className="case-create-card case-create-success" aria-live="polite">
        <CardHeader>
          <div className="case-create-success__mark" aria-hidden="true">
            <Check />
          </div>
          <p className="eyebrow">{messages('successEyebrow')}</p>
          <CardTitle>{messages('successTitle')}</CardTitle>
          <CardDescription>{messages('successDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="case-create-success__content">
          <dl className="case-create-summary">
            <div>
              <dt>{messages('statusLabel')}</dt>
              <dd>
                <Badge variant="success">{messages(`statuses.${created.status}`)}</Badge>
              </dd>
            </div>
            <div>
              <dt>{messages('prioritySummaryLabel')}</dt>
              <dd>{messages(`priorities.${created.priority}`)}</dd>
            </div>
            <div>
              <dt>{messages('actionLabel')}</dt>
              <dd>{created.initialAction.title}</dd>
            </div>
            <div>
              <dt>{messages('caseIdLabel')}</dt>
              <dd>
                <code className="case-create-reference">{created.caseId}</code>
              </dd>
            </div>
          </dl>
          <Button type="button" variant="outline" onClick={() => setCreated(undefined)}>
            {messages('createAnother')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const missingOrganization = session?.currentOrganizationId === null;

  return (
    <Card className="case-create-card">
      <CardHeader>
        <CardTitle>{messages('formTitle')}</CardTitle>
        <CardDescription>{messages('formDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {missingOrganization ? (
          <p className="case-create-alert" role="alert">
            {messages('missingOrganization')}
          </p>
        ) : null}
        {error !== undefined ? (
          <p className="case-create-alert" role="alert">
            {messages(`errors.${error}`)}
          </p>
        ) : null}

        <form
          className="case-create-form"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <div className="case-create-field">
            <Label htmlFor="case-title">{messages('titleLabel')}</Label>
            <Input
              id="case-title"
              name="title"
              required
              autoComplete="off"
              placeholder={messages('titlePlaceholder')}
              disabled={missingOrganization || submitting}
            />
          </div>

          <div className="case-create-field">
            <Label htmlFor="case-description">{messages('descriptionLabel')}</Label>
            <textarea
              id="case-description"
              name="description"
              required
              rows={5}
              placeholder={messages('descriptionPlaceholder')}
              disabled={missingOrganization || submitting}
            />
          </div>

          <div className="case-create-field">
            <Label htmlFor="case-priority">{messages('priorityLabel')}</Label>
            <select
              id="case-priority"
              name="priority"
              defaultValue="normal"
              disabled={missingOrganization || submitting}
            >
              <option value="low">{messages('priorities.low')}</option>
              <option value="normal">{messages('priorities.normal')}</option>
              <option value="high">{messages('priorities.high')}</option>
            </select>
          </div>

          <div className="case-create-field">
            <Label htmlFor="case-initial-action">{messages('initialActionLabel')}</Label>
            <Input
              id="case-initial-action"
              name="initialActionTitle"
              required
              autoComplete="off"
              placeholder={messages('initialActionPlaceholder')}
              disabled={missingOrganization || submitting}
            />
          </div>

          <div className="case-create-actions">
            <Button type="submit" disabled={missingOrganization || submitting}>
              {submitting ? (
                <>
                  <LoaderCircle className="management-spin" aria-hidden="true" />
                  {messages('submitting')}
                </>
              ) : (
                messages('submit')
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
