import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { NextAuthConfig } from 'next-auth';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: string;        // soft-coded role code: 'OFFICER', 'MANAGER', 'ADMIN', 'CEO', etc.
  roleId: string;      // FK to Role
  avatarUrl?: string | null;
  teamId?: string | null;
}

interface BackendLoginResponse {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    user: BackendUser;
  };
  message?: string;
  error?: { code: string };
}

interface BackendRefreshResponse {
  success: boolean;
  data?: { accessToken: string; refreshToken: string };
}

/**
 * Decode JWT payload (no verification) to get expiry time.
 */
function decodeJwtExpiry(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return Date.now() + 15 * 60 * 1000;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = typeof atob === 'function' ? atob(padded) : '';
    if (!decoded) return Date.now() + 15 * 60 * 1000;
    const payload = JSON.parse(decoded) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : Date.now() + 15 * 60 * 1000;
  } catch {
    return Date.now() + 15 * 60 * 1000;
  }
}

async function refreshAccessToken(refreshToken: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = (await res.json()) as BackendRefreshResponse;
    if (!res.ok || !data.success || !data.data) {
      throw new Error('Refresh failed');
    }
    return {
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken,
      accessTokenExpires: decodeJwtExpiry(data.data.accessToken),
    };
  } catch (err) {
    console.error('refreshAccessToken error:', err);
    return null;
  }
}

/**
 * Map role code to landing dashboard.
 * Role code is now a string (Phase 1 soft-coded).
 */
function roleDest(role: string | undefined): string {
  if (!role) return '/dashboard';
  const upper = role.toUpperCase();
  if (upper === 'MANAGER' || upper === 'ADMIN' || upper === 'CEO') return '/manager/dashboard';
  if (upper === 'APPROVER') return '/approver/dashboard'; // legacy support
  return '/dashboard';
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          const data = (await res.json()) as BackendLoginResponse;

          if (!res.ok || !data.success || !data.data) return null;

          const { accessToken, refreshToken, user } = data.data;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            roleId: user.roleId,
            teamId: user.teamId ?? null,
            accessToken,
            refreshToken,
            accessTokenExpires: decodeJwtExpiry(accessToken),
          } as never;
        } catch (err) {
          console.error('authorize error:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in
      if (user) {
        const u = user as unknown as BackendUser & {
          accessToken: string;
          refreshToken: string;
          accessTokenExpires: number;
        };
        token.id = u.id;
        token.role = u.role;
        token.roleId = u.roleId;
        token.teamId = u.teamId ?? null;
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.accessTokenExpires = u.accessTokenExpires ?? 0;
        return token;
      }

      // Token still valid (with 30s buffer)
      const expires = token.accessTokenExpires as number | undefined;
      if (typeof expires === 'number' && Date.now() < expires - 30000) {
        return token;
      }

      // Refresh
      const refreshTokenStr = token.refreshToken as string | undefined;
      if (refreshTokenStr) {
        const refreshed = await refreshAccessToken(refreshTokenStr);
        if (refreshed) {
          return {
            ...token,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            accessTokenExpires: refreshed.accessTokenExpires,
            error: undefined,
          };
        }
      }

      return { ...token, error: 'RefreshAccessTokenError' as const };
    },

    async session({ session, token }) {
      // Cast to attach extra fields
      const u = session.user as unknown as Record<string, unknown>;
      u.id = token.id as string;
      u.role = (token.role as string) || 'OFFICER';
      u.roleId = (token.roleId as string) || '';
      u.teamId = (token.teamId as string | null) ?? null;
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken as string;
      if (token.error) {
        (session as unknown as Record<string, unknown>).error = token.error as 'RefreshAccessTokenError';
      }
      return session;
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === '/login';
      const isOnRoot = nextUrl.pathname === '/';
      const isPublic = isOnLogin || isOnRoot;

      const userRole = (auth?.user as unknown as { role?: string })?.role;

      if (isLoggedIn && isOnLogin) {
        return Response.redirect(new URL(roleDest(userRole), nextUrl));
      }
      if (isLoggedIn && isOnRoot) {
        return Response.redirect(new URL(roleDest(userRole), nextUrl));
      }

      if (!isLoggedIn && !isPublic) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      return true;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);