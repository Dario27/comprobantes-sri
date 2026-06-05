import type { Page } from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SriError, isJobFatal } from '../errors';
import { childLogger } from '../logging';
import type { ComprobanteMeta, TipoComprobante } from '../types';

const log = childLogger('sri:listing:pptr');

export interface ListingFiltersPptr {
  anio: number;
  mes: number;          // 1-12
  dia: number;          // 0 = todos los días
  tipoComprobante: 'factura' | 'retencion' | 'nota_credito' | 'nota_debito' | 'liquidacion';
}

// Mapeo a los `value` reales del select del SRI.
const TIPO_TO_VALUE: Record<ListingFiltersPptr['tipoComprobante'], string> = {
  factura: '1',
  liquidacion: '2',
  nota_credito: '3',
  nota_debito: '4',
  retencion: '5'
};

// Selectores del form principal (capturados del HTML real del portal).
const SEL = {
  ano: '#frmPrincipal\\:ano',
  mes: '#frmPrincipal\\:mes',
  dia: '#frmPrincipal\\:dia',
  tipoComprobante: '#frmPrincipal\\:cmbTipoComprobante',
  // El portal renombró el botón a `btnBuscar`; dejamos el anterior como fallback.
  btnConsultar: '#frmPrincipal\\:btnBuscar, #frmPrincipal\\:btnConsultarSinRe',
  tablaBody: '#frmPrincipal\\:tablaCompRecibidos_data',
  paginatorCurrent: '#frmPrincipal\\:tablaCompRecibidos_paginator_bottom .ui-paginator-current',
  paginatorNext: '#frmPrincipal\\:tablaCompRecibidos_paginator_bottom .ui-paginator-next:not(.ui-state-disabled)',
  paginatorRpp: '#frmPrincipal\\:tablaCompRecibidos_paginator_bottom .ui-paginator-rpp-options'
} as const;

// Algunos datos vienen con `dd/mm/yyyy` en la tabla; los normalizamos a ISO.
function normalizeDateFromDdMmYyyy(s: string): string {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.trim();
}

function parseTipoFromText(text: string): Exclude<TipoComprobante, 'todos'> {
  const t = text.toLowerCase();
  if (t.includes('factura')) return 'factura';
  if (t.includes('nota de cr')) return 'nota_credito';
  if (t.includes('nota de d')) return 'nota_debito';
  if (t.includes('retenci')) return 'retencion';
  if (t.includes('liquidaci')) return 'liquidacion';
  return 'factura';
}

async function fillFilters(page: Page, f: ListingFiltersPptr): Promise<void> {
  // Año: input text → limpiar + escribir.
  // Si el selector no aparece (sesión expirada o DOM colapsado tras bloqueo), lanzamos
  // SESSION_EXPIRED con un mensaje claro en vez del error crudo de Puppeteer.
  try {
    await page.waitForSelector(SEL.ano, { timeout: 30_000 });
  } catch (e) {
    throw new SriError(
      'SESSION_EXPIRED',
      'El formulario de comprobantes no está disponible (#frmPrincipal:ano ausente); ' +
      'la sesión SRI probablemente expiró o el DOM colapsó tras un bloqueo de descargas.',
      e
    );
  }
  await page.$eval(SEL.ano, (el) => { (el as HTMLInputElement).value = ''; });
  await page.type(SEL.ano, String(f.anio));

  // Mes / día / tipo: selects.
  await page.select(SEL.mes, String(f.mes));
  await page.select(SEL.dia, String(f.dia));
  await page.select(SEL.tipoComprobante, TIPO_TO_VALUE[f.tipoComprobante]);

  // Subir el page-size al máximo permitido (75) para reducir paginación. Si falla, ignorar.
  try {
    await page.select(SEL.paginatorRpp, '75');
  } catch { /* ignore */ }
}

/**
 * El botón "Consultar" dispara reCAPTCHA Enterprise invisible (executeRecaptcha). Si Google
 * asigna un score bajo a la sesión automatizada, el SRI responde "captcha inválida/no válida"
 * y NO devuelve datos. Detectamos ese mensaje para dar un error claro en vez de una tabla vacía.
 */
async function detectCaptchaRejection(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const text = (document.body?.innerText ?? '').toLowerCase();
      if (!text.includes('captcha') && !text.includes('recaptcha')) return false;
      return /(inv[aá]lid|no\s+v[aá]lid|fallid|incorrect|rechaz)/.test(text);
    });
  } catch {
    return false;
  }
}

async function assertNoCaptchaRejection(page: Page): Promise<void> {
  if (await detectCaptchaRejection(page)) {
    throw new SriError(
      'LISTING_RATE_LIMITED',
      'El SRI rechazó la consulta por reCAPTCHA (puntuación de riesgo baja en la sesión automatizada). ' +
      'Usa Chrome real con un perfil persistente y modo visible (ver SRI_EXECUTABLE_PATH / SRI_USER_DATA_DIR / SRI_HEADFUL).'
    );
  }
}

// Interacción "humana" antes de disparar reCAPTCHA: movimiento de ratón + scroll + pausa.
// Suma señales de comportamiento que el score de reCAPTCHA v3 valora.
async function humanWarmup(page: Page): Promise<void> {
  try {
    await page.mouse.move(360, 220, { steps: 10 });
    await new Promise((r) => setTimeout(r, 350));
    await page.mouse.move(720, 460, { steps: 14 });
    await page.evaluate(() => window.scrollBy(0, 180));
    await new Promise((r) => setTimeout(r, 550));
  } catch { /* no crítico */ }
}

async function clickConsultarAndWait(page: Page): Promise<void> {
  await humanWarmup(page);
  // Esperar a que el POST PrimeFaces termine — la JSF responde con XML PrimeFaces que actualiza la tabla.
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('comprobantesRecibidos.jsf') && r.request().method() === 'POST',
    { timeout: 90_000 }
  ).catch((e) => {
    log.warn({ err: (e as Error).message }, 'consultar_waitForResponse_warn');
    return null;
  });

  // 1) Intento principal: id configurado.
  try {
    await page.waitForSelector(SEL.btnConsultar, { timeout: 10_000 });
    await page.click(SEL.btnConsultar);
    await responsePromise;
    await new Promise((r) => setTimeout(r, 800));
    await assertNoCaptchaRejection(page);
    return;
  } catch (primaryErr) {
    if (primaryErr instanceof SriError) throw primaryErr; // captcha → no reintentar
    log.warn({ selector: SEL.btnConsultar, err: (primaryErr as Error).message }, 'consultar_primary_selector_failed');
  }

  // 2) Fallback: busca un botón dentro del form cuyo texto/value contenga "Consultar" o "Buscar"
  // y haz click via DOM (esquiva problemas de visibilidad PrimeFaces).
  const fallback = await page.evaluate(() => {
    const form = document.querySelector('#frmPrincipal') ?? document.querySelector('form');
    if (!form) return null;
    const candidates = Array.from(form.querySelectorAll<HTMLElement>('button, input[type=submit], input[type=button], a.ui-button, a[role=button]'));
    for (const el of candidates) {
      const txt = ((el.textContent ?? '') + ' ' + ((el as HTMLInputElement).value ?? '')).trim().toLowerCase();
      if (/consultar|buscar/.test(txt)) {
        el.click();
        return { id: el.id || null, tag: el.tagName.toLowerCase(), text: txt.slice(0, 80) };
      }
    }
    return null;
  });
  if (fallback) {
    log.warn({ matched: fallback }, 'consultar_used_text_fallback');
    await responsePromise;
    await new Promise((r) => setTimeout(r, 800));
    await assertNoCaptchaRejection(page);
    return;
  }

  // 3) Diagnóstico: volcar ids/textos de botones detectados + screenshot.
  const diag = await page.evaluate(() => {
    const form = document.querySelector('#frmPrincipal') ?? document.querySelector('form');
    if (!form) return { reason: 'no_form', buttons: [] as Array<{ id: string; tag: string; text: string }> };
    const buttons = Array.from(form.querySelectorAll<HTMLElement>('button, input[type=submit], input[type=button], a.ui-button, a[role=button]')).map((el) => ({
      id: el.id ?? '',
      tag: el.tagName.toLowerCase(),
      text: (((el.textContent ?? '') + ' ' + ((el as HTMLInputElement).value ?? '')).trim()).slice(0, 80)
    }));
    return { reason: 'no_match', buttons };
  });

  let screenshotPath: string | null = null;
  try {
    const dir = path.resolve(process.cwd(), 'logs');
    await fs.mkdir(dir, { recursive: true });
    screenshotPath = path.join(dir, `consultar-error-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (sErr) {
    log.warn({ err: (sErr as Error).message }, 'consultar_screenshot_failed');
  }

  log.error({ diag, screenshotPath }, 'consultar_no_button_found');
  throw new SriError(
    'LISTING_INVALID_FILTERS',
    `No se encontró el botón Consultar (selector ${SEL.btnConsultar} no presente y ningún botón con texto "Consultar"/"Buscar"). Botones detectados: ${JSON.stringify(diag.buttons)}. Screenshot: ${screenshotPath ?? 'no_disponible'}`
  );
}

interface RawRow {
  claveAcceso: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  tipoSerie: string;
  fechaAutorizacion: string;
  fechaEmision: string;
  importeTotal: number;
  // ID del link XML/PDF para descargar después (se usa en downloaderPuppeteer).
  rowIndex: number;
}

async function scrapeCurrentPage(page: Page): Promise<RawRow[]> {
  return page.evaluate((tablaBodySel: string) => {
    const tbody = document.querySelector(tablaBodySel);
    if (!tbody) return [];
    const rows: RawRow[] = [];
    tbody.querySelectorAll('tr[data-ri]').forEach((tr) => {
      const ri = Number((tr as HTMLElement).getAttribute('data-ri'));
      const cells = Array.from(tr.querySelectorAll('td')) as HTMLTableCellElement[];
      if (cells.length < 11) return;

      // Cell 1 (idx 1): "RUC<br>RAZON SOCIAL"
      const rucBlock = (cells[1].textContent ?? '').trim();
      const rucLines = rucBlock.split('\n').map(s => s.trim()).filter(Boolean);
      const rucEmisor = rucLines[0] ?? '';
      const razonSocialEmisor = rucLines.slice(1).join(' ').trim();

      // Cell 2: "Factura  244-119-000188381" (puede ser otro tipo)
      const tipoSerie = (cells[2].textContent ?? '').trim();

      // Cell 3: clave de acceso (texto del <a> interno, 49 dígitos)
      const claveLink = cells[3].querySelector('a');
      const claveAcceso = (claveLink?.textContent ?? '').trim();

      // Cell 4: fecha autorización "dd/mm/yyyy hh:mm:ss"
      const fechaAutorizacion = (cells[4].textContent ?? '').trim();

      // Cell 5: fecha emisión "dd/mm/yyyy"
      const fechaEmision = (cells[5].textContent ?? '').trim();

      // Cell 8: importe total
      const importeTotalStr = (cells[8].textContent ?? '').trim();
      const importeTotal = Number(importeTotalStr.replace(/,/g, '.'));

      rows.push({
        claveAcceso,
        rucEmisor,
        razonSocialEmisor,
        tipoSerie,
        fechaAutorizacion,
        fechaEmision,
        importeTotal: Number.isFinite(importeTotal) ? importeTotal : 0,
        rowIndex: ri
      });
    });
    return rows;
    // El tipo RawRow es local al callback (TS-only), no afecta el runtime.
    interface RawRow {
      claveAcceso: string;
      rucEmisor: string;
      razonSocialEmisor: string;
      tipoSerie: string;
      fechaAutorizacion: string;
      fechaEmision: string;
      importeTotal: number;
      rowIndex: number;
    }
  }, SEL.tablaBody);
}

interface PageInfo {
  current: number;
  total: number;
}

async function readPaginatorInfo(page: Page): Promise<PageInfo> {
  return page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    const txt = (el?.textContent ?? '').trim(); // ej. "(1 of 4)"
    const m = txt.match(/\((\d+)\s+of\s+(\d+)\)/i);
    if (!m) return { current: 1, total: 1 };
    return { current: Number(m[1]), total: Number(m[2]) };
  }, SEL.paginatorCurrent);
}

async function goToNextPage(page: Page): Promise<boolean> {
  const hasNext = await page.$(SEL.paginatorNext);
  if (!hasNext) return false;
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('comprobantesRecibidos.jsf') && r.request().method() === 'POST',
    { timeout: 90_000 }
  ).catch(() => null);
  await page.click(SEL.paginatorNext);
  await responsePromise;
  await new Promise((r) => setTimeout(r, 600));
  return true;
}

/**
 * Aplica los filtros en el formulario del SRI y espera la respuesta de la tabla.
 * Útil cuando solo se necesita que la tabla esté cargada sin scraping completo
 * (ej. antes de descargar el reporte TXT).
 */
export async function applyFilters(page: Page, f: ListingFiltersPptr): Promise<void> {
  await fillFilters(page, f);
  await clickConsultarAndWait(page);
}

export async function listFacturasViaBrowser(page: Page, f: ListingFiltersPptr): Promise<ComprobanteMeta[]> {
  log.info({ filters: f }, 'listing_start');

  await fillFilters(page, f);
  await clickConsultarAndWait(page);

  const all: ComprobanteMeta[] = [];
  let pageNum = 1;
  while (pageNum <= 100) {
    const info = await readPaginatorInfo(page);
    log.info({ pageNum, info }, 'listing_page_info');
    const raw = await scrapeCurrentPage(page);

    for (const r of raw) {
      // Validación mínima: clave de acceso 49 dígitos. Si no matchea, saltamos esa fila.
      if (!/^\d{49}$/.test(r.claveAcceso)) {
        log.warn({ row: r }, 'row_invalid_claveAcceso');
        continue;
      }
      all.push({
        claveAcceso: r.claveAcceso,
        rucEmisor: r.rucEmisor,
        razonSocialEmisor: r.razonSocialEmisor,
        tipo: parseTipoFromText(r.tipoSerie),
        numeroAutorizacion: r.claveAcceso, // SRI moderno: el número de autorización coincide con la clave de acceso.
        fechaEmision: normalizeDateFromDdMmYyyy(r.fechaEmision),
        fechaAutorizacion: normalizeDateFromDdMmYyyy(r.fechaAutorizacion),
        montoTotal: r.importeTotal
      });
    }

    if (info.current >= info.total) break;
    const advanced = await goToNextPage(page);
    if (!advanced) break;
    pageNum++;
  }

  log.info({ total: all.length }, 'listing_done');
  return all;
}

/**
 * Itera la tabla página por página y llama `cb` con cada comprobante mientras su fila está
 * visible en la página actual. Permite que el caller descargue archivos haciendo click en los
 * links de la fila ANTES de avanzar a la siguiente página. Retorna estadísticas agregadas.
 */
export interface ForEachStats {
  total: number;       // filas válidas iteradas
  processed: number;   // callbacks que terminaron sin throw
  failed: number;      // callbacks que threw
}

export async function forEachFactura(
  page: Page,
  f: ListingFiltersPptr,
  cb: (meta: ComprobanteMeta, rowIndex: number) => Promise<void>
): Promise<ForEachStats> {
  log.info({ filters: f }, 'foreach_start');
  await fillFilters(page, f);
  await clickConsultarAndWait(page);

  let total = 0;
  let processed = 0;
  let failed = 0;
  let pageNum = 1;

  while (pageNum <= 100) {
    const info = await readPaginatorInfo(page);
    log.info({ pageNum, info }, 'foreach_page_info');
    const raw = await scrapeCurrentPage(page);

    for (const r of raw) {
      if (!/^\d{49}$/.test(r.claveAcceso)) {
        log.warn({ row: r }, 'row_invalid_claveAcceso');
        continue;
      }
      total++;
      const meta: ComprobanteMeta = {
        claveAcceso: r.claveAcceso,
        rucEmisor: r.rucEmisor,
        razonSocialEmisor: r.razonSocialEmisor,
        tipo: parseTipoFromText(r.tipoSerie),
        numeroAutorizacion: r.claveAcceso,
        fechaEmision: normalizeDateFromDdMmYyyy(r.fechaEmision),
        fechaAutorizacion: normalizeDateFromDdMmYyyy(r.fechaAutorizacion),
        montoTotal: r.importeTotal
      };
      try {
        await cb(meta, r.rowIndex);
        processed++;
      } catch (err) {
        // Los errores job-fatal (DOWNLOAD_BLOCKED, SESSION_EXPIRED) deben abortar
        // el job completo — propagarlos en vez de contarlos como fallo individual.
        if (err instanceof SriError && isJobFatal(err.code)) throw err;
        failed++;
        log.warn({ claveAcceso: r.claveAcceso, err: (err as Error).message }, 'foreach_cb_failed');
      }
    }

    if (info.current >= info.total) break;
    const advanced = await goToNextPage(page);
    if (!advanced) break;
    pageNum++;
  }

  log.info({ total, processed, failed }, 'foreach_done');
  return { total, processed, failed };
}

/**
 * Mapea ComprobanteMeta.claveAcceso → rowIndex (data-ri) en la página actual. Útil para que el
 * downloader sepa a qué fila apuntar. Asume que estamos en la página correcta del paginador.
 */
export async function getRowIndexByClaveAcceso(page: Page, claveAcceso: string): Promise<number | null> {
  return page.evaluate((tablaBodySel: string, clave: string) => {
    const tbody = document.querySelector(tablaBodySel);
    if (!tbody) return null;
    const trs = Array.from(tbody.querySelectorAll('tr[data-ri]')) as HTMLElement[];
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll('td'));
      if (cells.length < 4) continue;
      const a = cells[3].querySelector('a');
      const text = (a?.textContent ?? '').trim();
      if (text === clave) return Number(tr.getAttribute('data-ri'));
    }
    return null;
  }, SEL.tablaBody, claveAcceso);
}

/**
 * Verifica que el formulario principal del app de comprobantes sigue disponible.
 * Usa waitForSelector sobre el campo "año" (presente desde la carga inicial) en lugar
 * de la tabla de resultados (que no existe hasta el primer POST de "Consultar").
 * Detecta sesiones expiradas o redirecciones inesperadas al login.
 */
export async function assertOnComprobantesApp(page: Page): Promise<void> {
  try {
    await page.waitForSelector(SEL.ano, { timeout: 15_000 });
  } catch {
    throw new SriError(
      'SESSION_EXPIRED',
      `El formulario de comprobantes no está disponible (${SEL.ano} ausente en 15s). ` +
      `URL actual: ${page.url()} — probablemente la sesión SRI expiró o hubo una redirección al login.`
    );
  }
}
