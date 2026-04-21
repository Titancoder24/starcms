export type ErrorCode =
  | "not-found"
  | "forbidden"
  | "validation-failed"
  | "conflict"
  | "rate-limited"
  | "guardrail-failed"
  | "provider-error"
  | "internal";

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
