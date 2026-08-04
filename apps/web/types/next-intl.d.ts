import enMessages from '@/messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: 'en' | 'fa';
    Messages: typeof enMessages;
  }
}
