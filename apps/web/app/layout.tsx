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
export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
