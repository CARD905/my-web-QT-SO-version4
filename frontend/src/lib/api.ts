'use client';

import axios, { AxiosError, AxiosInstance } from 'axios';
import { getSession, signOut } from 'next-auth/react';
import type { ApiResponse } from '@/types/api';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * 🔥 Error payload ที่ backend ส่งมา
 * ปรับได้ตาม backend จริงของนาย
 */
type ApiErrorData = {
  message?: string;
  error?: {
    code?: string;
    details?: unknown;
  };
};



export type ApiError = AxiosError<ApiResponse<ApiErrorData>>;

/**
 * Axios instance
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * ✅ REQUEST INTERCEPTOR
 */
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

/**
 * ✅ RESPONSE INTERCEPTOR
 */
api.interceptors.response.use(
  (response) => response,
  async (error: ApiError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // 🔥 token พัง → logout
      await signOut({ callbackUrl: '/login' });
    }
    return Promise.reject(error);
  }
);

/**
 * ✅ Extract error message (ใช้ได้ทั้งระบบ)
 */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiResponse<ApiErrorData>>(error)) {
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