'use client';

import { Button, Check, LoaderCircle, ShieldCheck } from '@workspace/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked';
export type OrganizationRoleKey = 'member' | 'manager' | 'organization_admin';

const roleOrder: readonly OrganizationRoleKey[] = ['member', 'manager', 'organization_admin'];

const statusOrder: readonly MembershipStatus[] = ['invited', 'active', 'suspended', 'revoked'];

export interface MemberAccessEditorProps {
  readonly memberId: string;
  readonly status: MembershipStatus;
  readonly roleKeys: readonly OrganizationRoleKey[];
  readonly busy: boolean;
  readonly onStatusChange: (memberId: string, status: MembershipStatus) => Promise<boolean>;
  readonly onRolesChange: (
    memberId: string,
    roleKeys: readonly OrganizationRoleKey[],
  ) => Promise<boolean>;
}

export function MemberAccessEditor({
  memberId,
  status,
  roleKeys,
  busy,
  onStatusChange,
  onRolesChange,
}: MemberAccessEditorProps): React.ReactElement {
  const messages = useTranslations('members');
  const common = useTranslations('common');
  const [selectedStatus, setSelectedStatus] = React.useState(status);
  const [selectedRoles, setSelectedRoles] =
    React.useState<readonly OrganizationRoleKey[]>(roleKeys);

  const rolesChanged =
    selectedRoles.length !== roleKeys.length ||
    roleOrder.some((role) => selectedRoles.includes(role) !== roleKeys.includes(role));

  function toggleRole(role: OrganizationRoleKey): void {
    setSelectedRoles((current) =>
      current.includes(role)
        ? current.filter((candidate) => candidate !== role)
        : [...current, role],
    );
  }

  async function saveStatus(): Promise<void> {
    const updated = await onStatusChange(memberId, selectedStatus);

    if (!updated) {
      setSelectedStatus(status);
    }
  }

  async function saveRoles(): Promise<void> {
    if (selectedRoles.length === 0) {
      return;
    }

    const updated = await onRolesChange(memberId, selectedRoles);

    if (!updated) {
      setSelectedRoles(roleKeys);
    }
  }

  return (
    <details className="member-access">
      <summary className="member-access__summary">
        <ShieldCheck aria-hidden="true" />
        <span>{messages('manageAccess')}</span>
      </summary>

      <div className="member-access__panel">
        <div className="member-access__group">
          <LabelText>{messages('statusEditor')}</LabelText>
          <div className="member-access__status-row">
            <select
              value={selectedStatus}
              aria-label={messages('statusEditor')}
              disabled={busy}
              onChange={(event) => setSelectedStatus(event.currentTarget.value as MembershipStatus)}
            >
              {statusOrder.map((statusValue) => (
                <option key={statusValue} value={statusValue}>
                  {common(`status.${statusValue}`)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || selectedStatus === status}
              onClick={() => void saveStatus()}
            >
              {busy ? (
                <LoaderCircle className="management-spin" aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {messages('saveStatus')}
            </Button>
          </div>
        </div>

        <fieldset className="member-access__group">
          <legend>{messages('roleEditor')}</legend>
          <div className="member-access__roles">
            {roleOrder.map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  disabled={busy}
                  onChange={() => toggleRole(role)}
                />
                <span>{common(`roles.${role}`)}</span>
              </label>
            ))}
          </div>
          {selectedRoles.length === 0 ? (
            <p className="member-access__validation" role="alert">
              {messages('atLeastOneRole')}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={busy || selectedRoles.length === 0 || !rolesChanged}
            onClick={() => void saveRoles()}
          >
            {busy ? (
              <LoaderCircle className="management-spin" aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {messages('saveRoles')}
          </Button>
        </fieldset>
      </div>
    </details>
  );
}

function LabelText({ children }: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return <span className="member-access__label">{children}</span>;
}
