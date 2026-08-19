import { getTranslations } from 'next-intl/server';

import { CreateOwnCaseForm } from '@/components/create-own-case-form';
import { DashboardShell } from '@/components/dashboard-shell';

export default async function CreateOwnCasePage(): Promise<React.ReactElement> {
  const messages = await getTranslations('workManagement.createOwnCase');

  return (
    <DashboardShell>
      <section className="work-management-page">
        <header className="dashboard-page-heading">
          <p className="eyebrow">{messages('eyebrow')}</p>
          <h1>{messages('title')}</h1>
          <p className="lead">{messages('description')}</p>
        </header>
        <CreateOwnCaseForm />
      </section>
    </DashboardShell>
  );
}
