import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { boot } from '../bootstrap';
import { openBrowserSession, closeBrowserSession } from '../sri/browserSession';
import { forEachFactura, assertOnComprobantesApp } from '../sri/listingPuppeteer';
import { downloadComprobante } from '../sri/downloaderPuppeteer';
import { SRI_DOWNLOAD_DELAY_MS, SRI_DOWNLOAD_FAIL_THRESHOLD, SRI_DOWNLOAD_JITTER_MS } from '../sri/config';
import { childLogger } from '../logging';
import { SriError } from '../errors';
import type { ComprobanteMeta } from '../types';
import type { Company } from '../storage/companies';
import type { JobRunModo } from '../storage/jobRuns';

const log = childLogger('scheduler:engine');

export interface RunJobResult {
  jobRunId: number;
  estado: 'EXITO' | 'FALLO' | 'CAPTCHA';
  descargados: number;
  fallidos: number;
  mensaje?: string;
}

function monthsBetween(desde: string, hasta: string): { anio: number; mes: number }[] {
  const start = new Date(`${desde.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${hasta.slice(0, 10)}T00:00:00Z`);
  const out: { anio: number; mes: number }[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor.getTime() <= stop.getTime()) {
    out.push({ anio: cursor.getUTCFullYear(), mes: cursor.getUTCMonth() + 1 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

function withinRange(meta: ComprobanteMeta, desde: string, hasta: string): boolean {
  const f = meta.fechaEmision.slice(0, 10);
  return f >= desde && f <= hasta;
}

export async function runJobForCompany(companyId: number, modo: JobRunModo): Promise<RunJobResult> {
  const company = boot.companies.findById(companyId);
  if (!company) throw new SriError('SESSION_NOT_FOUND', `Empresa ${companyId} no existe`);
  if (company.estado === 'INACTIVO') {
    throw new SriError('AUTH_INVALID_CREDENTIALS', `Empresa ${company.nombre} está INACTIVA`);
  }

  const rangoDesde = (company.ultimaEjecucionExitosa ?? company.fechaInicioDescarga).slice(0, 10);
  const rangoHasta = new Date().toISOString().slice(0, 10);

  const jobRunId = boot.jobRuns.create({
    companyId: company.id,
    modo,
    rangoDesde,
    rangoHasta
  });

  log.info({ jobRunId, companyId, modo, rangoDesde, rangoHasta }, 'job_run_started');

  let clave: string;
  try {
    clave = boot.companies.getClave(company.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo descifrar la clave';
    boot.jobRuns.finish(jobRunId, 'FALLO', { errorMensaje: msg });
    return { jobRunId, estado: 'FALLO', descargados: 0, fallidos: 0, mensaje: msg };
  }

  // Asegurar que la ruta base de la empresa existe.
  try {
    await fs.mkdir(company.rutaDescarga, { recursive: true });
  } catch (err) {
    const msg = `No se pudo crear ruta de descarga "${company.rutaDescarga}": ${(err as Error).message}`;
    boot.jobRuns.finish(jobRunId, 'FALLO', { errorMensaje: msg });
    return { jobRunId, estado: 'FALLO', descargados: 0, fallidos: 0, mensaje: msg };
  }

  // Directorio efímero donde Chromium deposita los archivos antes de moverlos al destino final.
  const tmpDownloadDir = path.join(os.tmpdir(), `sri-job-${company.id}-${jobRunId}-${Date.now()}`);
  await fs.mkdir(tmpDownloadDir, { recursive: true });

  // 1. Abrir sesión browser (login + navegación al app de comprobantes).
  let session;
  try {
    session = await openBrowserSession({
      ruc: company.ruc,
      clave,
      downloadPath: tmpDownloadDir
    });
  } catch (err) {
    const sriErr = err as SriError;
    if (sriErr.code === 'AUTH_CAPTCHA_REQUIRED') {
      boot.companies.markCaptcha(company.id);
      boot.jobRuns.finish(jobRunId, 'CAPTCHA', { errorMensaje: sriErr.message });
      log.warn({ jobRunId, companyId }, 'job_run_captcha');
      await fs.rm(tmpDownloadDir, { recursive: true, force: true }).catch(() => undefined);
      return { jobRunId, estado: 'CAPTCHA', descargados: 0, fallidos: 0, mensaje: sriErr.message };
    }
    const msg = sriErr.message ?? 'Error de autenticación';
    boot.jobRuns.finish(jobRunId, 'FALLO', { errorMensaje: msg });
    log.warn({ jobRunId, companyId, code: sriErr.code }, 'job_run_login_failed');
    await fs.rm(tmpDownloadDir, { recursive: true, force: true }).catch(() => undefined);
    return { jobRunId, estado: 'FALLO', descargados: 0, fallidos: 0, mensaje: msg };
  }

  let descargados = 0;
  let fallidos = 0;
  let lastError: string | null = null;
  let bloqueoDetectado = false;

  // Contador de fallos de descarga consecutivos para el circuit breaker.
  // Se reinicia a 0 con cualquier descarga exitosa.
  let fallosConsecutivos = 0;

  // 2. Iterar por mes en el rango. Para cada mes, listar + descargar fila por fila.
  try {
    const meses = monthsBetween(rangoDesde, rangoHasta);
    for (const { anio, mes } of meses) {
      log.info({ jobRunId, anio, mes }, 'job_month_start');

      // Verificar que el formulario sigue disponible antes de cada mes.
      // Si la sesión expiró o el DOM colapsó (p.ej. tras un bloqueo de descargas),
      // esto lanza SESSION_EXPIRED con un mensaje claro antes de entrar al listado.
      await assertOnComprobantesApp(session.page);

      const stats = await forEachFactura(
        session.page,
        { anio, mes, dia: 0, tipoComprobante: 'factura' },
        async (meta, rowIndex) => {
          // Filtros adicionales por rango exacto (mes parcial al inicio/fin).
          if (!withinRange(meta, rangoDesde, rangoHasta)) return;
          // Dedupe contra BD por empresa.
          if (boot.db.findAlreadyDownloaded([meta.claveAcceso], company.id).length > 0) return;

          try {
            const { xmlContent } = await downloadComprobante(
              session!.page,
              rowIndex,
              meta.claveAcceso,
              session!.downloadPath
            );

            boot.db.upsertComprobante({
              claveAcceso: meta.claveAcceso,
              rucEmisor: meta.rucEmisor,
              razonSocialEmisor: meta.razonSocialEmisor,
              tipo: meta.tipo,
              numeroAutorizacion: meta.numeroAutorizacion,
              fechaEmision: meta.fechaEmision,
              fechaAutorizacion: meta.fechaAutorizacion,
              montoTotal: meta.montoTotal,
              xmlPath: null,
              ridePath: null,
              xmlContent,
              downloadedAt: new Date().toISOString(),
              status: 'ok',
              companyId: company.id
            });
            descargados++;
            fallosConsecutivos = 0; // resetear contador tras éxito
          } catch (dlErr) {
            const sriErr = dlErr as SriError;
            const esCodBloqueo = sriErr.code === 'DOWNLOAD_NETWORK' || sriErr.code === 'DOWNLOAD_NOT_FOUND';
            if (esCodBloqueo) {
              fallosConsecutivos++;
              if (fallosConsecutivos >= SRI_DOWNLOAD_FAIL_THRESHOLD) {
                // Circuit breaker: el portal dejó de entregar archivos.
                // Abortamos el job completo con un mensaje que nombra la causa real.
                throw new SriError(
                  'DOWNLOAD_BLOCKED',
                  `El portal dejó de entregar descargas tras ${descargados} archivo(s) ` +
                  `(${fallosConsecutivos} fallos consecutivos: ${sriErr.message}). ` +
                  `Posible reCAPTCHA/rate-limit por score bajo de la sesión automatizada. ` +
                  `Para mejorar el score usa Chrome real + perfil persistente ` +
                  `(SRI_EXECUTABLE_PATH, SRI_USER_DATA_DIR, SRI_HEADFUL=1).`
                );
              }
            }
            // Si no llega al umbral, re-lanzamos para que forEachFactura lo cuente como
            // fallo individual y continúe con la siguiente fila.
            throw dlErr;
          }

          // Delay + jitter entre descargas para reducir la cadencia mecánica.
          const totalDelay = SRI_DOWNLOAD_DELAY_MS + (SRI_DOWNLOAD_JITTER_MS > 0
            ? Math.floor(Math.random() * SRI_DOWNLOAD_JITTER_MS)
            : 0);
          if (totalDelay > 0) {
            await new Promise((r) => setTimeout(r, totalDelay));
          }
        }
      );
      fallidos += stats.failed;
      log.info({ jobRunId, anio, mes, stats }, 'job_month_done');
    }
  } catch (err) {
    const sriErr = err as SriError;
    bloqueoDetectado = sriErr.code === 'DOWNLOAD_BLOCKED' || sriErr.code === 'SESSION_EXPIRED';
    lastError = sriErr.message ?? 'Error inesperado durante descarga';
    if (bloqueoDetectado) {
      log.warn({ jobRunId, code: sriErr.code, descargados, fallidos }, 'job_run_blocked');
    } else {
      log.error({ jobRunId, err: lastError }, 'job_run_unexpected');
    }
  } finally {
    await closeBrowserSession(session).catch(() => undefined);
    await fs.rm(tmpDownloadDir, { recursive: true, force: true }).catch(() => undefined);
  }

  // 3. Cerrar con el estado correcto.
  if (lastError && descargados === 0) {
    boot.jobRuns.finish(jobRunId, 'FALLO', {
      comprobantesDescargados: descargados,
      comprobantesFallidos: fallidos,
      errorMensaje: lastError
    });
    return { jobRunId, estado: 'FALLO', descargados, fallidos, mensaje: lastError };
  }
  if (fallidos > 0 && descargados === 0) {
    const msg = `Todas las descargas fallaron (${fallidos})`;
    boot.jobRuns.finish(jobRunId, 'FALLO', {
      comprobantesDescargados: 0,
      comprobantesFallidos: fallidos,
      errorMensaje: msg
    });
    return { jobRunId, estado: 'FALLO', descargados: 0, fallidos, mensaje: msg };
  }

  // Construir el aviso final con la causa real (bloqueo > error genérico).
  const aviso = [
    fallidos > 0 ? `${fallidos} descarga(s) fallaron` : null,
    lastError
      ? bloqueoDetectado
        ? lastError                         // mensaje de DOWNLOAD_BLOCKED o SESSION_EXPIRED ya es descriptivo
        : `Error tardío: ${lastError}`      // otros errores inesperados mantienen el prefijo
      : null
  ].filter(Boolean).join(' | ');

  boot.jobRuns.finish(jobRunId, 'EXITO', {
    comprobantesDescargados: descargados,
    comprobantesFallidos: fallidos,
    errorMensaje: aviso || null
  });
  boot.companies.setLastSuccess(company.id, new Date().toISOString());
  if (company.estado === 'BLOQUEADA_CAPTCHA') boot.companies.markActive(company.id);

  log.info({ jobRunId, companyId, descargados, fallidos }, 'job_run_success');
  return { jobRunId, estado: 'EXITO', descargados, fallidos, mensaje: aviso || undefined };
}

export function listEligibleCompanies(): Company[] {
  const todas = boot.companies.list();
  const hoy = Date.now();
  const MS_DAY = 24 * 60 * 60 * 1000; //equivale a 24horas (1 dia)
  return todas.filter(c => {
    if (c.estado !== 'ACTIVO') return false;
    if (!c.ultimaEjecucionExitosa) return true;
    const last = Date.parse(c.ultimaEjecucionExitosa);
    if (Number.isNaN(last)) return true;
    return (hoy - last) >= c.frecuenciaDias * MS_DAY;
  });
}

export async function runTick(): Promise<void> {
  const candidatas = listEligibleCompanies();
  log.info({ candidatas: candidatas.length }, 'tick_start');
  for (const c of candidatas) {
    try {
      await runJobForCompany(c.id, 'AUTOMATICO');
    } catch (err) {
      log.error({ companyId: c.id, err: (err as Error).message }, 'tick_company_error');
    }
  }
  log.info('tick_end');
}
