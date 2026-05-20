export interface ApiResponseError {
  code: string;
  message: string;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiResponseError };

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function err(code: string, message: string): { ok: false; error: ApiResponseError } {
  return { ok: false, error: { code, message } };
}
