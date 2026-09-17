/** Thin typed client for the ilovedoc REST API (see docs/SPEC.md §4). */

export interface TransferFileMeta {
  id: number;
  name: string;
  size: number;
  mimeType: string;
}

export interface CreateTransferInput {
  files: { name: string; size: number; mimeType?: string }[];
  password?: string;
  expiresInHours?: number;
  senderName?: string;
  maxDownloads?: number;
}

export interface CreateTransferResponse {
  token: string;
  code: string;
  senderToken: string;
  expiresAt: string;
  files: TransferFileMeta[];
}

export interface TransferFileInfo {
  status: 'waiting' | 'active';
  expiresAt: string;
  senderName: string | null;
  passwordProtected: boolean;
  fileCount: number;
  totalBytes: number;
  maxDownloads: number;
  downloads: number;
  files: { name: string; size: number; mimeType: string }[] | null;
  receiverToken?: string;
}

export interface UnlockResponse {
  receiverToken: string;
  status: 'waiting' | 'active';
  expiresAt: string;
  senderName: string | null;
  fileCount: number;
  totalBytes: number;
  files: { name: string; size: number; mimeType: string }[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message || code);
    this.name = 'ApiError';
  }

  get notFound(): boolean {
    return this.status === 404;
  }

  get gone(): boolean {
    return this.status === 410;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Network error — check your connection and try again.');
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const code = (body as { error?: string } | null)?.error ?? `http_${res.status}`;
    throw new ApiError(res.status, code);
  }
  return body as T;
}

export function createTransfer(input: CreateTransferInput): Promise<CreateTransferResponse> {
  return request<CreateTransferResponse>('/api/transfers', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchTransfer(token: string): Promise<TransferFileInfo> {
  return request<TransferFileInfo>(`/api/transfers/${encodeURIComponent(token)}`);
}

export function lookupCode(code: string): Promise<{ token: string }> {
  return request<{ token: string }>('/api/transfers/lookup', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function unlockTransfer(token: string, password: string): Promise<UnlockResponse> {
  return request<UnlockResponse>(`/api/transfers/${encodeURIComponent(token)}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function fetchIceServers(): Promise<{ iceServers: RTCIceServer[]; ttl: number }> {
  return request<{ iceServers: RTCIceServer[]; ttl: number }>('/api/ice');
}

/** Human-friendly message for API failures shown in the UI. */
export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'not_found':
        return 'This transfer is no longer available.';
      case 'expired':
        return 'This transfer has expired.';
      case 'cancelled':
        return 'This transfer was cancelled by the sender.';
      case 'completed':
        return 'This transfer has already been fully downloaded.';
      case 'locked':
        return 'Too many wrong password attempts — this transfer is locked.';
      case 'invalid_password':
        return 'Incorrect password. Please try again.';
      case 'rate_limited':
        return 'Too many requests — please wait a moment and try again.';
      case 'network_error':
        return err.message;
      default:
        return `Transfer error (${err.code}).`;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
