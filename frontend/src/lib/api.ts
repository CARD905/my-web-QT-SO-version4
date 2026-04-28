'use client';

import axios, { AxiosError, AxiosInstance } from 'axios';
import { getSession, signOut } from 'next-auth/react';
import type { ApiResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * Client-side axios instance.
 * - Attaches access token from NextAuth session
 * - On 401, signs the user out (NextAuth handles refresh on next session check)
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const session = await getSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    if (session?.error === 'RefreshAccessTokenError') {
      await signOut({ callbackUrl: '/login' });
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Session expired and refresh failed → force logout
      await signOut({ callbackUrl: '/login' });
    }
    return Promise.reject(error);
  },
);

/** Extract a clean error message from an axios error */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiResponse>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error?.code ||
      error.message ||
      'Unknown error'
    );
  }
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}
