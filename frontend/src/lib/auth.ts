import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { NextAuthConfig } from 'next-auth';
import type { UserRole } from '@/types/api';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: 'SALES' | 'APPROVER' | 'ADMIN';
  avatarUrl?: string | null;
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
 * Uses atob() for Edge runtime compatibility (middleware runs on Edge).
 */
function decodeJwtExpiry(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return Date.now() + 15 * 60 * 1000;
    // base64url → base64
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

/**
 * Refresh access token using refresh token
 */
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

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
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
            accessToken,
            refreshToken,
            accessTokenExpires: decodeJwtExpiry(accessToken),
          };
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
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = user.accessTokenExpires ?? 0;
        return token;
      }

      // Token still valid (with 30s buffer)
      const expires = token.accessTokenExpires as number | undefined;
      if (typeof expires === 'number' && Date.now() < expires - 30000) {
        return token;
      }

      // Try refresh
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
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      session.accessToken = token.accessToken as string;
      if (token.error) session.error = token.error as 'RefreshAccessTokenError';
      return session;
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === '/login';
      const isOnRoot = nextUrl.pathname === '/';
      const isPublic = isOnLogin || isOnRoot;

      // Logged in users on login page → redirect to their dashboard
      if (isLoggedIn && isOnLogin) {
        const role = auth?.user?.role;
        const dest = role === 'APPROVER' ? '/approver/dashboard' : '/dashboard';
        return Response.redirect(new URL(dest, nextUrl));
      }

      // Root → redirect based on role
      if (isLoggedIn && isOnRoot) {
        const role = auth?.user?.role;
        const dest = role === 'APPROVER' ? '/approver/dashboard' : '/dashboard';
        return Response.redirect(new URL(dest, nextUrl));
      }

      // Not logged in: only allow public pages
      if (!isLoggedIn && !isPublic) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      return true;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
