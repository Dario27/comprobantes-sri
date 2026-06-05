/**
 * Integración best-effort con la API externa de empresas (sistema multi-tenant).
 * Si el envío falla por cualquier motivo, se loguea un warning pero nunca se lanza
 * excepción — la creación local de la empresa no depende de esta llamada.
 */
import axios from 'axios';
import https from 'node:https';
import { childLogger } from '../logging';

const log = childLogger('integrations:empresas');

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const BASE_URL = process.env.EXTERNAL_EMPRESAS_API_BASE_URL ?? 'https://localhost:9999';
const TIMEOUT_MS = parsePositiveInt(process.env.EXTERNAL_EMPRESAS_API_TIMEOUT_MS, 10_000);
const INSECURE_TLS = (process.env.EXTERNAL_EMPRESAS_API_INSECURE_TLS ?? '0') === '1';
const ENABLED = (process.env.EXTERNAL_EMPRESAS_API_ENABLED ?? '1') === '1';

const ENDPOINT = `${BASE_URL}/api/v1/admin/empresas`;

// Agente HTTPS que omite verificación de certificado en localhost/desarrollo.
// En producción desactivar con EXTERNAL_EMPRESAS_API_INSECURE_TLS=0.
const httpsAgent = INSECURE_TLS ? new https.Agent({ rejectUnauthorized: false }) : undefined;

const client = axios.create({
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  httpsAgent,
});

export interface SyncEmpresaPayload {
  id: number;
  nombre: string;
  connectionString: string;
  activo: boolean;
}

/**
 * Envía la empresa a la API externa de gestión multi-tenant.
 * El id local se transmite en el header X-Empresa-Id.
 * method: 'POST' al crear, 'PUT' al actualizar.
 * Best-effort: nunca lanza; loguea advertencia si falla.
 */
export async function syncEmpresaToExternalApi(
  payload: SyncEmpresaPayload,
  method: 'POST' | 'PUT' = 'POST'
): Promise<void> {
  if (!ENABLED) {
    log.debug({ empresaId: payload.id }, 'sync_empresa_disabled');
    return;
  }

  const { id, ...body } = payload;
  const config = { headers: { 'X-Empresa-Id': String(id) } };
  try {
    const res = method === 'PUT'
      ? await client.put(ENDPOINT, body, config)
      : await client.post(ENDPOINT, body, config);
    log.info({ empresaId: id, method, status: res.status }, 'sync_empresa_ok');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ empresaId: id, method, err: msg, endpoint: ENDPOINT }, 'sync_empresa_failed');
  }
}
