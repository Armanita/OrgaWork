import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function HomePage(): Promise<React.ReactElement> {
  const application = await getTranslations('application');
  const navigation = await getTranslations('navigation');
  const common = await getTranslations('common');
  const dashboard = await getTranslations('dashboard');

  const cards = ['activeMembers', 'pendingInvitations', 'activeTeams', 'activeSessions'] as const;

  const activityItems = ['invitation', 'role', 'session'] as const;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">{application('brandMark')}</span>
          <div>
            <strong>{application('name')}</strong>
            <small>{application('tagline')}</small>
          </div>
        </div>
        <nav>
          <Link className="active" href="/">
            {navigation('overview')}
          </Link>
          <Link href="/organization/members">{navigation('members')}</Link>
          <Link href="/organization/teams">{navigation('teams')}</Link>
          <Link href="/login">{navigation('security')}</Link>
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="muted">{common('currentOrganization')}</span>
            <strong>{common('sampleOrganization')}</strong>
          </div>
          <Link className="secondary-button" href="/organization">
            {common('changeOrganization')}
          </Link>
        </header>
        <div className="content">
          <p className="eyebrow">{dashboard('eyebrow')}</p>
          <h1>{dashboard('title')}</h1>
          <p className="lead">{dashboard('description')}</p>
          <div className="metric-grid">
            {cards.map((card) => (
              <article className="metric-card" key={card}>
                <span>{dashboard(`cards.${card}.label`)}</span>
                <strong>{dashboard(`cards.${card}.value`)}</strong>
              </article>
            ))}
          </div>
          <section className="panel">
            <div>
              <h2>{dashboard('recentActivity.title')}</h2>
              <p className="muted">{dashboard('recentActivity.description')}</p>
            </div>
            <ul className="activity-list">
              {activityItems.map((item) => (
                <li key={item}>
                  <span className="activity-dot" />
                  {dashboard(`recentActivity.items.${item}`)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
