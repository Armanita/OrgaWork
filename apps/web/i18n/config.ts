export const supportedLocales = ['en', 'fa'] as const;

export type AppLocale = (typeof supportedLocales)[number];
export type AppDirection = 'ltr' | 'rtl';

export const developmentDefaultLocale: AppLocale = 'en';
export const finalProductDefaultLocale: AppLocale = 'fa';
export const localeCookieName = 'orgawork-locale';

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && supportedLocales.includes(value as AppLocale);
}

export function getLocaleDirection(locale: AppLocale): AppDirection {
  return locale === 'fa' ? 'rtl' : 'ltr';
}
