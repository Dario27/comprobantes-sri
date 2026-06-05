export type SriErrorCode =
  | 'AUTH_INVALID_CREDENTIALS' | 'AUTH_CAPTCHA_REQUIRED' | 'AUTH_MFA_REQUIRED'
  | 'AUTH_PORTAL_UNAVAILABLE' | 'AUTH_TIMEOUT' | 'AUTH_UNEXPECTED'
  | 'SESSION_EXPIRED' | 'SESSION_NOT_FOUND'
  | 'LISTING_INVALID_FILTERS' | 'LISTING_RATE_LIMITED'
  | 'DOWNLOAD_NOT_FOUND' | 'DOWNLOAD_CORRUPT' | 'DOWNLOAD_NETWORK' | 'DOWNLOAD_BLOCKED'
  | 'STORAGE_DISK_FULL' | 'STORAGE_PERMISSION' | 'STORAGE_DB_LOCKED'
  | 'COMPROBANTE_NOT_FOUND' | 'FORBIDDEN_COMPANY' | 'XML_PARSE_FAILED' | 'XML_MISSING'
  | 'USER_NOT_FOUND' | 'USER_DUPLICATE' | 'PORTAL_UNAUTHORIZED';

export class SriError extends Error {
  constructor(public code: SriErrorCode, message: string, public cause?: unknown) {
    super(message);
    this.name = 'SriError';
  }
}

const RETRIABLE = new Set<SriErrorCode>(['DOWNLOAD_NETWORK', 'DOWNLOAD_CORRUPT']);
export const isRetriable = (code: SriErrorCode) => RETRIABLE.has(code);

// Errores que deben abortar el job completo (no solo la descarga individual).
// DOWNLOAD_BLOCKED: el portal dejó de entregar archivos (reCAPTCHA/rate-limit).
// SESSION_EXPIRED:  la sesión SRI caducó a mitad del proceso.
const JOB_FATAL = new Set<SriErrorCode>(['DOWNLOAD_BLOCKED', 'SESSION_EXPIRED']);
export const isJobFatal = (code: SriErrorCode) => JOB_FATAL.has(code);

interface AxiosLikeError {
  isAxiosError?: boolean;
  response?: { status?: number };
  code?: string;
  message?: string;
}

export function mapAxiosErrorToSriError(err: unknown): SriError {
  const e = err as AxiosLikeError;
  const status = e?.response?.status;
  if (status === 401 || status === 403) return new SriError('SESSION_EXPIRED', 'Sesión SRI expirada o no válida', err);
  if (status === 404) return new SriError('DOWNLOAD_NOT_FOUND', 'Recurso no encontrado en SRI', err);
  if (status === 429) return new SriError('LISTING_RATE_LIMITED', 'SRI aplicó rate limit (429)', err);
  if (status && status >= 500) return new SriError('DOWNLOAD_NETWORK', `SRI respondió ${status}`, err);
  if (e?.code === 'ECONNRESET' || e?.code === 'ETIMEDOUT' || e?.code === 'ECONNABORTED')
    return new SriError('DOWNLOAD_NETWORK', `Error de red: ${e.code}`, err);
  return new SriError('DOWNLOAD_NETWORK', e?.message ?? 'Error desconocido', err);
}
