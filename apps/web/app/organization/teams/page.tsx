'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoaderCircle,
  Network,
  Plus,
  RefreshCw,
  Search,
  Users,
} from '@workspace/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { DashboardShell } from '@/components/dashboard-shell';
import { ManagementPageHeader } from '@/components/management-page-header';
import { TeamRenameForm } from '@/components/team-rename-form';
import { identityRequest, type WebSession } from '@/lib/identity-api';

interface TeamRow {
  readonly id: string;
  readonly name: string;
  readonly memberCount: number;
}

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export default function TeamsPage(): React.ReactElement {
  const messages = useTranslations('teams');
  const errors = useTranslations('common.errors');
  const [session, setSession] = React.useState<WebSession>();
  const [teams, setTeams] = React.useState<readonly TeamRow[]>([]);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string>();
  const [query, setQuery] = React.useState('');

  const load = React.useCallback(
    async (showLoading = true): Promise<void> => {
      if (showLoading) {
        setLoading(true);
      }

      setError('');

      try {
        const sessionData = await identityRequest<{ readonly session: WebSession }>('auth/session');

        if (sessionData.session.currentOrganizationId === null) {
          window.location.assign('/organization');
          return;
        }

        const organizationId = sessionData.session.currentOrganizationId;
        const data = await identityRequest<{
          readonly teams: readonly TeamRow[];
        }>(`organizations/${organizationId}/teams`, {
          headers: { 'x-csrf-token': sessionData.session.csrfToken },
        });

        setSession(sessionData.session);
        setTeams(data.teams);
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : errors('teamsLoadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [errors],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const filteredTeams = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('en-US');

    return teams.filter(
      (team) =>
        normalizedQuery === '' || team.name.toLocaleLowerCase('en-US').includes(normalizedQuery),
    );
  }, [query, teams]);

  const totalMembers = React.useMemo(
    () => teams.reduce((total, team) => total + team.memberCount, 0),
    [teams],
  );

  async function createTeam(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (session === undefined || session.currentOrganizationId === null || creating) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = readText(form, 'name');

    if (name === '') {
      return;
    }

    setCreating(true);
    setError('');
    setNotice('');

    try {
      await identityRequest(`organizations/${session.currentOrganizationId}/teams`, {
        method: 'POST',
        headers: { 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ name }),
      });
      formElement.reset();
      setNotice(messages('creationSuccess'));
      await load(false);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('teamCreationFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function renameTeam(teamId: string, name: string): Promise<boolean> {
    if (session?.currentOrganizationId === null || session === undefined) {
      return false;
    }

    setUpdatingId(teamId);
    setError('');
    setNotice('');

    try {
      await identityRequest(`organizations/${session.currentOrganizationId}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ name }),
      });
      setNotice(messages('renameSuccess'));
      await load(false);
      return true;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : errors('teamRenameFailed'));
      return false;
    } finally {
      setUpdatingId(undefined);
    }
  }

  return (
    <DashboardShell>
      <section className="management-page">
        <ManagementPageHeader
          eyebrow={messages('eyebrow')}
          title={messages('title')}
          description={messages('description')}
          countLabel={messages('teamCount', { count: teams.length })}
          actions={
            <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={loading ? 'management-spin' : undefined} aria-hidden="true" />
              {messages('refresh')}
            </Button>
          }
        />

        <div className="management-metrics management-metrics--compact">
          <Card className="management-metric">
            <CardContent>
              <span>
                <Network aria-hidden="true" />
              </span>
              <div>
                <strong>{teams.length}</strong>
                <p>{messages('totalTeams')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="management-metric">
            <CardContent>
              <span>
                <Users aria-hidden="true" />
              </span>
              <div>
                <strong>{totalMembers}</strong>
                <p>{messages('totalMembers')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="management-card">
          <CardHeader>
            <CardTitle>{messages('createTitle')}</CardTitle>
            <CardDescription>{messages('createDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="management-form-grid management-form-grid--team"
              onSubmit={(event) => void createTeam(event)}
            >
              <div className="field-group">
                <Label htmlFor="team-name">{messages('nameLabel')}</Label>
                <Input
                  id="team-name"
                  name="name"
                  maxLength={120}
                  placeholder={messages('namePlaceholder')}
                  disabled={creating}
                  required
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <LoaderCircle className="management-spin" aria-hidden="true" />
                ) : (
                  <Plus aria-hidden="true" />
                )}
                {creating ? messages('creating') : messages('createAction')}
              </Button>
            </form>

            {notice === '' ? null : (
              <div className="management-notice" role="status">
                <Network aria-hidden="true" />
                <strong>{notice}</strong>
              </div>
            )}
          </CardContent>
        </Card>

        {error === '' ? null : (
          <p className="form-error management-page__error" role="alert">
            {error}
          </p>
        )}

        <Card className="management-card">
          <CardHeader>
            <CardTitle>{messages('directoryTitle')}</CardTitle>
            <CardDescription>{messages('directoryDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="management-toolbar">
              <label className="management-search">
                <Search aria-hidden="true" />
                <span className="sr-only">{messages('searchLabel')}</span>
                <Input
                  value={query}
                  type="search"
                  placeholder={messages('searchPlaceholder')}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
              </label>
            </div>

            {loading ? (
              <div className="management-loading" aria-live="polite">
                <LoaderCircle className="management-spin" aria-hidden="true" />
                <span>{messages('loading')}</span>
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="management-empty">
                <Network aria-hidden="true" />
                <strong>{teams.length === 0 ? messages('empty') : messages('noResults')}</strong>
              </div>
            ) : (
              <div className="team-management-grid">
                {filteredTeams.map((team) => (
                  <article className="team-management-card" key={team.id}>
                    <div className="team-management-card__top">
                      <span className="team-management-card__icon">
                        <Network aria-hidden="true" />
                      </span>
                      <TeamRenameForm
                        key={`${team.id}:${team.name}`}
                        teamId={team.id}
                        currentName={team.name}
                        busy={updatingId === team.id}
                        onRename={renameTeam}
                      />
                    </div>
                    <div className="team-management-card__body">
                      <h2>{team.name}</h2>
                      <p>{messages('memberCount', { count: team.memberCount })}</p>
                    </div>
                    <div className="team-management-card__footer">
                      <Users aria-hidden="true" />
                      <span>{messages('memberCount', { count: team.memberCount })}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}
