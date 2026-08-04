'use client';

import { ThemeToggle } from '@workspace/ui';
import { useTranslations } from 'next-intl';

export function ThemeToggleControl(): React.ReactElement {
  const t = useTranslations('themeSwitcher');

  return <ThemeToggle lightLabel={t('toLight')} darkLabel={t('toDark')} />;
}
