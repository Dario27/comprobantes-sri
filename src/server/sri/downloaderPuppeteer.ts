import type { Page } from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SriError } from '../errors';
import { SRI_DOWNLOAD_TIMEOUT_MS } from './config';

// Magic bytes para validar contenido descargado.
function isXml(buf: Buffer): boolean {
  const head = buf.subarray(0, 200).toString('utf8').trimStart();
  return head.startsWith('<?xml') || (head.startsWith('<') && !head.startsWith('<!DOCTYPE html') && !head.startsWith('<html'));
}

async function listDir(dir: string): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(dir);
    return new Set(entries);
  } catch {
    return new Set();
  }
}

/**
 * Espera a que aparezca un archivo nuevo en `dir` que NO esté en `before` y que cumpla el predicado.
 * Si la descarga deja un `.crdownload` (Chromium temporal), espera a que termine.
 */
async function waitForNewFile(dir: string, before: Set<string>, opts: { timeoutMs: number; predicate?: (filename: string) => boolean }): Promise<string> {
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const now = await listDir(dir);
    for (const f of now) {
      if (before.has(f)) continue;
      if (f.endsWith('.crdownload')) continue; // descarga en progreso
      if (opts.predicate && !opts.predicate(f)) continue;
      return f;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new SriError('DOWNLOAD_NETWORK', `Timeout esperando descarga en ${dir} (>${opts.timeoutMs}ms)`);
}

async function clickRowLink(page: Page, rowIndex: number, kind: 'xml' | 'pdf'): Promise<void> {
  const suffix = kind === 'xml' ? 'lnkXml' : 'lnkPdf';
  // El id JSF lleva ':' literal — escapar con '\\:' para CSS selector.
  const selector = `#frmPrincipal\\:tablaCompRecibidos\\:${rowIndex}\\:${suffix}`;
  const exists = await page.$(selector);
  if (!exists) {
    throw new SriError('DOWNLOAD_NOT_FOUND', `Link de ${kind.toUpperCase()} no encontrado para la fila ${rowIndex} (${selector})`);
  }
  // Click programático para evitar problemas de visibilidad.
  await page.evaluate((sel: string) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el) el.click();
  }, selector);
}

export interface DownloadResult {
  xmlContent: Buffer;
}

/**
 * Hace click en el botón "Descargar reporte" del SRI (lnkTxtlistado) y retorna el
 * contenido del archivo TXT. La tabla debe estar cargada antes de llamar esta función
 * (haber aplicado filtros y pulsado Consultar).
 */
export async function downloadTxtReport(page: Page, downloadPath: string): Promise<Buffer> {
  await fs.mkdir(downloadPath, { recursive: true });

  const before = await listDir(downloadPath);

  const selector = '#frmPrincipal\\:lnkTxtlistado';
  const exists = await page.$(selector);
  if (!exists) {
    throw new SriError(
      'DOWNLOAD_NOT_FOUND',
      `Botón de reporte TXT no encontrado (${selector}). Verifique que la consulta devolvió resultados.`
    );
  }

  await page.evaluate((sel: string) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el) el.click();
  }, selector);

  const filename = await waitForNewFile(downloadPath, before, {
    timeoutMs: 30_000,
    predicate: (f) => f.toLowerCase().endsWith('.txt')
  });

  const filePath = path.join(downloadPath, filename);
  const buf = await fs.readFile(filePath);
  await fs.unlink(filePath).catch(() => undefined);

  return buf;
}

/**
 * Descarga el XML de un comprobante haciendo click en el link de la fila `rowIndex`.
 * Lee el contenido a memoria y borra el archivo temporal; no se mueve a destino final
 * porque ahora el XML se persiste en BD (columna `xml_content`).
 *
 * Requisito: la página debe estar en la pestaña de "Comprobantes Recibidos" con la tabla
 * cargada y la fila `rowIndex` visible (paginación correcta).
 */
export async function downloadComprobante(
  page: Page,
  rowIndex: number,
  claveAcceso: string,
  downloadPath: string
): Promise<DownloadResult> {
  await fs.mkdir(downloadPath, { recursive: true });

  const beforeXml = await listDir(downloadPath);
  await clickRowLink(page, rowIndex, 'xml');
  const xmlFilename = await waitForNewFile(downloadPath, beforeXml, {
    timeoutMs: SRI_DOWNLOAD_TIMEOUT_MS,
    predicate: (f) => f.toLowerCase().endsWith('.xml')
  });
  const xmlSrc = path.join(downloadPath, xmlFilename);
  const xmlBuf = await fs.readFile(xmlSrc);
  if (!isXml(xmlBuf)) {
    await fs.unlink(xmlSrc).catch(() => undefined);
    throw new SriError('DOWNLOAD_CORRUPT', `XML inválido para ${claveAcceso} (head=${xmlBuf.subarray(0, 16).toString('hex')})`);
  }
  await fs.unlink(xmlSrc).catch(() => undefined);

  return { xmlContent: xmlBuf };
}
