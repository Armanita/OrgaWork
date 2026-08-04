import * as React from 'react';

import { cn } from '../lib/cn';

export function Card({ className, ...props }: React.ComponentProps<'section'>): React.ReactElement {
  return (
    <section
      data-slot="card"
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.ComponentProps<'header'>): React.ReactElement {
  return (
    <header
      data-slot="card-header"
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>): React.ReactElement {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-base font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.ComponentProps<'p'>): React.ReactElement {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm leading-6 text-muted-foreground', className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return <div data-slot="card-content" className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.ComponentProps<'footer'>): React.ReactElement {
  return (
    <footer
      data-slot="card-footer"
      className={cn('flex items-center gap-3 p-6 pt-0', className)}
      {...props}
    />
  );
}
