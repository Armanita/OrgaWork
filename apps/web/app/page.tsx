import Link from 'next/link';
import { userFacingMessages } from '@/lib/messages.fa';
export default function HomePage(): React.ReactElement {
  const m = userFacingMessages.dashboard;
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">ا</span>
          <div>
            <strong>اورگاوُرک</strong>
            <small>سامانه پیگیری سازمانی</small>
          </div>
        </div>
        <nav>
          <Link className="active" href="/">
            {userFacingMessages.navigation.overview}
          </Link>
          <Link href="/organization/members">{userFacingMessages.navigation.members}</Link>
          <Link href="/organization/teams">{userFacingMessages.navigation.teams}</Link>
          <Link href="/login">{userFacingMessages.navigation.security}</Link>
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="muted">سازمان جاری</span>
            <strong>سازمان نمونه</strong>
          </div>
          <Link className="secondary-button" href="/organization">
            تغییر سازمان
          </Link>
        </header>
        <div className="content">
          <p className="eyebrow">{m.eyebrow}</p>
          <h1>{m.title}</h1>
          <p className="lead">{m.description}</p>
          <div className="metric-grid">
            {m.cards.map(([label, value]) => (
              <article className="metric-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <section className="panel">
            <div>
              <h2>فعالیت‌های اخیر</h2>
              <p className="muted">آخرین تغییرات عضویت تیم و دسترسی‌ها</p>
            </div>
            <ul className="activity-list">
              <li>
                <span className="activity-dot" />
                دعوت عضو جدید برای بررسی ارسال شد
              </li>
              <li>
                <span className="activity-dot" />
                نقش مدیر تیم فروش به‌روزرسانی شد
              </li>
              <li>
                <span className="activity-dot" />
                نشست قدیمی کاربر لغو شد
              </li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
