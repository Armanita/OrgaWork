'use client';

import { Button, Check, LoaderCircle, Pencil, X } from '@workspace/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export interface TeamRenameFormProps {
  readonly teamId: string;
  readonly currentName: string;
  readonly busy: boolean;
  readonly onRename: (teamId: string, name: string) => Promise<boolean>;
}

export function TeamRenameForm({
  teamId,
  currentName,
  busy,
  onRename,
}: TeamRenameFormProps): React.ReactElement {
  const messages = useTranslations('teams');
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(currentName);

  function cancel(): void {
    setName(currentName);
    setEditing(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedName = name.trim();

    if (normalizedName === '' || normalizedName === currentName) {
      cancel();
      return;
    }

    const updated = await onRename(teamId, normalizedName);

    if (updated) {
      setEditing(false);
    } else {
      setName(currentName);
    }
  }

  if (!editing) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden="true" />
        {messages('renameAction')}
      </Button>
    );
  }

  return (
    <form className="team-rename" onSubmit={(event) => void submit(event)}>
      <label>
        <span className="sr-only">{messages('renameTitle')}</span>
        <input
          value={name}
          maxLength={120}
          disabled={busy}
          aria-label={messages('renameTitle')}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </label>
      <div className="team-rename__actions">
        <Button type="submit" size="sm" disabled={busy || name.trim() === ''}>
          {busy ? (
            <LoaderCircle className="management-spin" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {messages('saveRename')}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={cancel}>
          <X aria-hidden="true" />
          {messages('cancel')}
        </Button>
      </div>
    </form>
  );
}
