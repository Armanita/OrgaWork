import type { Metadata } from 'next';

import { userFacingMessages } from '@/lib/messages.fa';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: userFacingMessages.application.name,
    template: `%s | ${userFacingMessages.application.name}`,
  },
  description: userFacingMessages.application.description,
};

type RootLayoutProperties = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProperties): React.ReactElement {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
