'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getLocaleDirection, type AppLocale } from '@/i18n/config';

export function LanguageSwitcher(): React.ReactElement {
  const locale = useLocale();
  const t = useTranslations('languageSwitcher');
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const nextLocale: AppLocale = locale === 'en' ? 'fa' : 'en';

  async function switchLocale(): Promise<void> {
    setSubmitting(true);

    try {
      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale: nextLocale }),
      });

      if (!response.ok) {
        return;
      }

      document.documentElement.lang = nextLocale;
      document.documentElement.dir = getLocaleDirection(nextLocale);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const label = locale === 'en' ? t('toPersian') : t('toEnglish');
  const ariaLabel = locale === 'en' ? t('switchToPersian') : t('switchToEnglish');

  return (
    <button
      type="button"
      className="language-switcher"
      onClick={() => void switchLocale()}
      disabled={submitting}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
