import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { developmentDefaultLocale, isSupportedLocale, localeCookieName } from './config';
import { getMessagesForLocale } from './messages';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestedLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isSupportedLocale(requestedLocale) ? requestedLocale : developmentDefaultLocale;

  return {
    locale,
    messages: getMessagesForLocale(locale),
  };
});
