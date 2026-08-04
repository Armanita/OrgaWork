import enMessages from '@/messages/en.json';
import faMessages from '@/messages/fa.json';

import type { AppLocale } from './config';

const messageCatalog = {
  en: enMessages,
  fa: faMessages,
} as const;

export function getMessagesForLocale(locale: AppLocale): (typeof messageCatalog)[AppLocale] {
  return messageCatalog[locale];
}
