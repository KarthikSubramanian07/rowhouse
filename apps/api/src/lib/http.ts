import { HTTPException } from 'hono/http-exception';
import type { ZodError } from 'zod';

/** Typed application error → JSON with a stable `error` code. */
export class AppError extends HTTPException {
  readonly code: string;
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
    code: string,
    message?: string,
  ) {
    super(status, { message: message ?? code });
    this.code = code;
  }
}

export const badRequest = (code: string, msg?: string) => new AppError(400, code, msg);
export const unauthorized = (msg?: string) => new AppError(401, 'unauthorized', msg);
export const forbidden = (msg?: string) => new AppError(403, 'forbidden', msg);
export const notFound = (what = 'not_found') => new AppError(404, what);
export const conflict = (code: string, msg?: string) => new AppError(409, code, msg);

export function zodError(err: ZodError): AppError {
  const first = err.issues[0];
  const path = first?.path.join('.') ?? '';
  return new AppError(
    422,
    'validation_error',
    `${path ? `${path}: ` : ''}${first?.message ?? 'invalid input'}`,
  );
}
