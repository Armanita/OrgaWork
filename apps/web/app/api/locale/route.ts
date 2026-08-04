import { NextResponse, type NextRequest } from 'next/server';

import { isSupportedLocale, localeCookieName } from '@/i18n/config';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload: unknown = await request.json().catch(() => undefined);
  const locale =
    typeof payload === 'object' && payload !== null && 'locale' in payload
      ? (payload as { readonly locale?: unknown }).locale
      : undefined;

  if (!isSupportedLocale(locale)) {
    return NextResponse.json({ error: 'UNSUPPORTED_LOCALE' }, { status: 400 });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set({
    name: localeCookieName,
    value: locale,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
