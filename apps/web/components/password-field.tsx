'use client';

import { Button, Eye, EyeOff, Input, Label } from '@workspace/ui';
import * as React from 'react';

export interface PasswordFieldProps extends Omit<
  React.ComponentProps<typeof Input>,
  'id' | 'type'
> {
  readonly id: string;
  readonly label: string;
  readonly showLabel: string;
  readonly hideLabel: string;
}

export function PasswordField({
  id,
  label,
  showLabel,
  hideLabel,
  className,
  ...props
}: PasswordFieldProps): React.ReactElement {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="form-field">
      <Label htmlFor={id}>{label}</Label>
      <div className="password-control">
        <Input id={id} type={visible ? 'text' : 'password'} className={className} {...props} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="password-control__toggle"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
