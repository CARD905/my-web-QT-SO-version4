import 'next-auth';
import { UserRole } from './api';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    accessToken: string;
    refreshToken: string;
    accessTokenExpires?: number;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      avatarUrl?: string | null;
    };
    accessToken: string;
    error?: 'RefreshAccessTokenError';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    error?: 'RefreshAccessTokenError';
  }
}
