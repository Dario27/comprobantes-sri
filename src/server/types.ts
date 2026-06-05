export type TipoComprobante = 'factura' | 'retencion' | 'nota_credito' | 'nota_debito' | 'liquidacion' | 'todos';

export interface Filters {
  anio: number;
  mes: number;
  tipoComprobante?: TipoComprobante;
  rucEmisor?: string;
  estado?: 'autorizado' | 'todos';
}

export interface ComprobanteMeta {
  claveAcceso: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  tipo: Exclude<TipoComprobante, 'todos'>;
  numeroAutorizacion: string;
  fechaEmision: string;
  fechaAutorizacion: string;
  montoTotal: number;
}

export interface SriSession {
  sessionId: string;
  cookieJarSerialized: string;
  ruc: string;
  expiresAt: Date;
}

export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobRow {
  id: string;
  filters: Filters;
  status: JobStatus;
  total: number;
  done: number;
  failed: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export type JobEvent =
  | { type: 'started'; total: number }
  | { type: 'progress'; done: number; failed: number; skipped: number; total: number }
  | { type: 'item_ok'; claveAcceso: string }
  | { type: 'item_skipped'; claveAcceso: string; reason: 'already_downloaded' }
  | { type: 'item_failed'; claveAcceso: string; code: string; message: string }
  | { type: 'done'; ok: number; failed: number; skipped: number }
  | { type: 'cancelled' };
