import { describe, expect, it } from 'vitest';

import { badgeVariants } from './components/badge';
import { buttonVariants } from './components/button';
import { cn } from './lib/cn';

describe('workspace UI design-system primitives', () => {
  it('merges conflicting Tailwind utility classes deterministically', () => {
    const optionalClass: string | undefined = undefined;

    expect(cn('px-2 text-sm', optionalClass, 'px-4')).toBe('text-sm px-4');
  });

  it('provides stable button variants and sizes', () => {
    expect(buttonVariants({ variant: 'outline', size: 'sm' })).toContain('border-input');
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-destructive');
  });

  it('provides semantic status badge variants', () => {
    expect(badgeVariants({ variant: 'success' })).toContain('text-success');
    expect(badgeVariants({ variant: 'warning' })).toContain('text-warning');
  });
});
