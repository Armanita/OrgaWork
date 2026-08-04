import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui';
import { getTranslations } from 'next-intl/server';

import { DashboardShell } from '@/components/dashboard-shell';

export default async function HomePage(): Promise<React.ReactElement> {
  const dashboard = await getTranslations('dashboard');

  const cards = ['activeMembers', 'pendingInvitations', 'activeTeams', 'activeSessions'] as const;

  const activityItems = ['invitation', 'role', 'session'] as const;

  return (
    <DashboardShell>
      <section className="dashboard-page-heading">
        <p className="eyebrow">{dashboard('eyebrow')}</p>
        <h1>{dashboard('title')}</h1>
        <p className="lead">{dashboard('description')}</p>
      </section>

      <div className="metric-grid">
        {cards.map((card) => (
          <Card className="metric-card" key={card}>
            <span>{dashboard(`cards.${card}.label`)}</span>
            <strong>{dashboard(`cards.${card}.value`)}</strong>
          </Card>
        ))}
      </div>

      <Card className="activity-panel">
        <CardHeader className="activity-panel__header">
          <CardTitle>{dashboard('recentActivity.title')}</CardTitle>
          <CardDescription>{dashboard('recentActivity.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="activity-list">
            {activityItems.map((item) => (
              <li key={item}>
                <span className="activity-dot" aria-hidden="true" />
                {dashboard(`recentActivity.items.${item}`)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
