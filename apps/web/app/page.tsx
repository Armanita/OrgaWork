import { userFacingMessages } from '@/lib/messages.fa';

export default function HomePage(): React.ReactElement {
  const messages = userFacingMessages.home;

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="page-title">
        <p className="eyebrow">{messages.eyebrow}</p>

        <h1 id="page-title">{messages.title}</h1>

        <p className="description">{messages.description}</p>

        <ul className="foundation-list" aria-label={messages.foundationItemsLabel}>
          {messages.foundationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="status-panel" role="status">
          <span className="status-indicator" aria-hidden="true" />
          <span>{messages.readyStatus}</span>
        </div>
      </section>
    </main>
  );
}
