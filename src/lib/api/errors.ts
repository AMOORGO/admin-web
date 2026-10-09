/** Error thrown for every failed API call. `code` is the backend's machine-readable error code (or a client-side one). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId?: string;

  constructor(init: { status: number; code: string; message: string; details?: unknown; requestId?: string }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNetwork(): boolean {
    return this.code === "NETWORK_ERROR";
  }
  get isAborted(): boolean {
    return this.code === "ABORTED";
  }

  /** Message plus validation details (backend sends string[] details for failed validation). */
  get displayMessage(): string {
    if (Array.isArray(this.details) && this.details.length > 0 && this.details.every((d) => typeof d === "string")) {
      return `${this.message}: ${(this.details as string[]).join("; ")}`;
    }
    return this.message;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Human-readable message for any thrown value. */
export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (isApiError(e)) return e.displayMessage;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
