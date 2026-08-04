'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export interface ThemeToggleProps {
  readonly lightLabel: string;
  readonly darkLabel: string;
  readonly className?: string;
}

export function ThemeToggle({
  className,
  darkLabel,
  lightLabel,
}: ThemeToggleProps): React.ReactElement {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const actionLabel = isDark ? lightLabel : darkLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn('shrink-0', className)}
          aria-label={actionLabel}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{actionLabel}</TooltipContent>
    </Tooltip>
  );
}
