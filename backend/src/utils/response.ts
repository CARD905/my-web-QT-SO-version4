import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function success<T>(
  res: Response,
  data?: T,
  message?: string,
  meta?: ApiResponse['meta'],
  statusCode = 200,
) {
  const body: ApiResponse<T> = { success: true };
  if (data !== undefined) body.data = data;
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T, message = 'Created successfully') {
  return success(res, data, message, undefined, 201);
}

export function fail(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiResponse = {
    success: false,
    message,
    error: { code, ...(details ? { details } : {}) },
  };
  return res.status(statusCode).json(body);
}
