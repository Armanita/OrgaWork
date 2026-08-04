import { Badge } from '@workspace/ui';

export interface ManagementPageHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly countLabel: string;
  readonly actions?: React.ReactNode;
}

export function ManagementPageHeader({
  eyebrow,
  title,
  description,
  countLabel,
  actions,
}: ManagementPageHeaderProps): React.ReactElement {
  return (
    <header className="management-page__header">
      <div className="management-page__heading">
        <p className="management-page__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="management-page__header-actions">
        <Badge variant="outline">{countLabel}</Badge>
        {actions}
      </div>
    </header>
  );
}
