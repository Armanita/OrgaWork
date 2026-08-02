import { createWebConnectivityResponse } from '@/lib/connectivity-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export function GET(): Promise<Response> {
  return createWebConnectivityResponse();
}
