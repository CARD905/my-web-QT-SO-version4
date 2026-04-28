import { auth } from './auth';
import type { ApiResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * Server-side fetch with NextAuth session token attached.
 * Use in Server Components.
 */
export async function serverFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const session = await auth();
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers,
    cache: init?.cache ?? 'no-store',
  });

  const data = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  return data;
}
