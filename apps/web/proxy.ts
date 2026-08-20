import { NextResponse, type NextRequest } from 'next/server';

function apiBaseUrl(): string {
  const value = process.env['ORGAWORK_API_INTERNAL_URL']?.trim() ?? 'http://127.0.0.1:3001';
  return value.replace(/\/+$/u, '');
}

function isPublicPage(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/invitations/')
  );
}

async function hasActiveSession(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get('cookie');
  if (cookie === null || cookie.trim() === '') {
    return false;
  }

  try {
    const response = await fetch(`${apiBaseUrl()}/v1/auth/session`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        cookie,
      },
      cache: 'no-store',
      redirect: 'manual',
    });

    return response.ok;
  } catch {
    return false;
  }
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  if (isPublicPage(pathname)) {
    return NextResponse.next();
  }

  if (await hasActiveSession(request)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
