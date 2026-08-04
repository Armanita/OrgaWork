import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-background text-foreground',
        success: 'border-transparent bg-success/15 text-success dark:bg-success/20',
        warning: 'border-transparent bg-warning/15 text-warning dark:bg-warning/20',
        destructive: 'border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ className, variant }))} {...props} />
  );
}
