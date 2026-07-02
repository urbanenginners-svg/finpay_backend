export type SuccessEnvelope<T> = {
  success: boolean;
  code?: number;
  message?: string;
  data: T;
};

export type PostFormUrlEncodedParams = {
  url: string;
  body: URLSearchParams;
  headers?: Record<string, string>;
  /** Used in log messages (e.g. API path). Defaults to `url`. */
  context?: string;
  /** User-facing error when the request fails. */
  errorMessage?: string;
};
