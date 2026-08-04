'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps, ReactElement } from 'react';

export type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider(props: ThemeProviderProps): ReactElement {
  return <NextThemesProvider {...props} />;
}
