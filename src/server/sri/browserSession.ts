import { type Browser, type Page, type Protocol } from 'puppeteer';
import { puppeteer } from './puppeteerLauncher';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SriError } from '../errors';
import { childLogger } from '../logging';
import { SRI_CONFIG } from './auth';

const log = childLogger('sri:browser');
const DEBUG = process.env.SRI_DEBUG === '1';
// SRI_HEADFUL=1 → Chromium visible (para diagnóstico). Por default el browser cierra al
// terminar de todos modos; usar SRI_DEBUG_KEEP_OPEN=1 para mantenerlo abierto post-mortem.
const HEADFUL = process.env.SRI_HEADFUL === '1' || DEBUG;
const KEEP_OPEN_AFTER_USE = process.env.SRI_DEBUG_KEEP_OPEN === '1';

export interface BrowserSessionParams {
  ruc: string;
  clave: string;
  cedulaAdicional?: string;
  // Directorio donde Chromium guarda los archivos descargados durante esta sesión.
  // El downloader luego los mueve a la ruta final por empresa.
  downloadPath: string;
  // Identificador único de la sesión SRI (para el flujo manual). Si no se provee, se generará uno.
  sessionId?: string;
}

export interface BrowserSession {
  sessionId: string;
  browser: Browser;
  page: Page;
  ruc: string;
  downloadPath: string;
  /**
   * URL final donde quedó la página tras login + click en menú (debería ser comprobantesRecibidos.jsf).
   */
  appUrl: string;
  /**
   * true si nos conectamos a un Chrome existente (SRI_BROWSER_URL). En ese caso, al cerrar
   * la sesión sólo nos desconectamos (no matamos el navegador del usuario).
   */
  connected?: boolean;
}

// Chrome real ya en ejecución con --remote-debugging-port. Conectarse a él (perfil/historial
// reales) suele dar un score de reCAPTCHA mucho mayor que lanzar un Chromium nuevo.
const BROWSER_URL = process.env.SRI_BROWSER_URL || '';

const COMPROBANTES_HREF_FRAGMENT = 'accederAplicacion.jspa?redireccion=57&idGrupo=55';
const COMPROBANTES_URL_FRAGMENT = '/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf';

async function dumpDebug(page: Page, label: string): Promise<void> {
  if (!DEBUG) return;
  try {
    const dir = path.resolve(process.cwd(), 'logs');
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.join(dir, `browser-${label}-${stamp}`);
    await page.screenshot({ path: `${base}.png`, fullPage: true });
    const html = await page.content();
    await fs.writeFile(`${base}.html`, html, 'utf8');
    log.info({ label, screenshot: `${base}.png`, html: `${base}.html`, url: page.url() }, 'browser_debug_dump');
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'browser_debug_dump_failed');
  }
}

async function loginKeycloak(page: Page, p: BrowserSessionParams): Promise<void> {
  log.info({ ruc: p.ruc }, 'login_start');
  await page.goto(`${SRI_CONFIG.baseUrl}${SRI_CONFIG.startPath}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000
  });

  // Esperamos a que Angular dispare el redirect a Keycloak y aparezca el form de login.
  // NO evaluamos la URL inmediatamente: justo tras domcontentloaded todavía apunta a /perfil
  // (contiene successUrlContains) antes de que Angular redirija — chequearla da falso positivo
  // "ya autenticado" con navegador fresco y provoca el salto del login.
  let formFound = false;
  try {
    await page.waitForSelector(SRI_CONFIG.rucSelector, { timeout: 20_000 });
    formFound = true;
  } catch {
    // No apareció el form en 20 s — evaluamos qué ocurrió.
  }

  if (!formFound) {
    // Captcha → no podemos seguir.
    if (await page.$(SRI_CONFIG.captchaSelector)) {
      await dumpDebug(page, 'captcha');
      throw new SriError('AUTH_CAPTCHA_REQUIRED', 'El portal está pidiendo captcha; login no automatizable');
    }
    // Sesión real activa (solo posible en modo conectar SRI_BROWSER_URL con perfil persistente).
    if (page.url().includes(SRI_CONFIG.successUrlContains) && !page.url().includes(SRI_CONFIG.authPathContains)) {
      log.info({ url: page.url() }, 'login_already_authenticated');
      return;
    }
    await dumpDebug(page, 'no-form');
    throw new SriError('AUTH_TIMEOUT', `No apareció el campo de usuario (${SRI_CONFIG.rucSelector}) en 20s. URL: ${page.url()}`);
  }

  await page.type(SRI_CONFIG.rucSelector, p.ruc);
  const ciAd = await page.$(SRI_CONFIG.ciAdicionalSelector);
  if (ciAd && p.cedulaAdicional) {
    await page.type(SRI_CONFIG.ciAdicionalSelector, p.cedulaAdicional);
  }
  await page.type(SRI_CONFIG.claveSelector, p.clave);
  await page.click(SRI_CONFIG.submitSelector);

  // Esperar éxito o error visible.
  try {
    await page.waitForFunction(
      (success: string, authPath: string, errorSel: string) => {
        if (location.href.includes(success)) return true;
        const errEl = document.querySelector(errorSel);
        if (errEl && location.href.includes(authPath)) return true;
        return false;
      },
      { timeout: 45_000 },
      SRI_CONFIG.successUrlContains,
      SRI_CONFIG.authPathContains,
      SRI_CONFIG.errorSelector
    );
  } catch (waitErr) {
    await dumpDebug(page, 'post-submit-timeout');
    throw new SriError('AUTH_TIMEOUT', `Timeout esperando confirmación post-submit. URL: ${page.url()}`, waitErr);
  }

  // Si seguimos en /auth/realms/... el form aún está visible → credenciales rechazadas.
  if (page.url().includes(SRI_CONFIG.authPathContains)) {
    const errorEl = await page.$(SRI_CONFIG.errorSelector);
    const msg = errorEl
      ? (await page.evaluate((el) => el.textContent ?? '', errorEl)).trim()
      : 'Credenciales rechazadas';
    await dumpDebug(page, 'credentials-rejected');
    throw new SriError('AUTH_INVALID_CREDENTIALS', `SRI rechazó el login: ${msg}`);
  }

  if (!page.url().includes(SRI_CONFIG.successUrlContains)) {
    await dumpDebug(page, 'unexpected-url');
    throw new SriError('AUTH_UNEXPECTED', `Login terminó en URL inesperada: ${page.url()}`);
  }
  log.info({ url: page.url() }, 'login_ok');
}

/**
 * Tras el login Angular, expande el panel "FACTURACIÓN ELECTRÓNICA" y hace click en el
 * subitem "Comprobantes electrónicos recibidos". Esto dispara el flow OAuth/SSO correcto
 * (`accederAplicacion.jspa` → `verificaEmail.jspa` → `GeneraToken.jsp` → `comprobantesRecibidos.jsf`).
 * Sin este paso, `GeneraToken.jsp` cierra la sesión por seguridad.
 */
async function navigateToComprobantesApp(page: Page): Promise<string> {
  log.info('nav_app_start');

  // Angular tarda en hidratar el menú lateral tras el login. Esperamos primero a que el
  // primer header del PanelMenu exista, y damos un margen extra para que TODOS los headers
  // (incluyendo "FACTURACIÓN ELECTRÓNICA", que es el quinto) terminen de renderizarse.
  try {
    await page.waitForSelector('a.ui-panelmenu-header-link', { timeout: 30_000 });
  } catch (e) {
    await dumpDebug(page, 'menu-not-rendered');
    throw new SriError('AUTH_UNEXPECTED', 'El menú lateral del portal Angular no se renderizó tras login (timeout 30s)', e);
  }

  // 1. Buscar el panel header con reintentos cortos (Angular puede renderizar headers
  // adicionales de forma asíncrona después del primero).
  let expanded: { found: boolean; headerCount?: number; texts?: string[] } = { found: false };
  for (let attempt = 1; attempt <= 8; attempt++) {
    expanded = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('a.ui-panelmenu-header-link')) as HTMLElement[];
      const target = headers.find(h => (h.textContent ?? '').trim().toUpperCase().includes('FACTURACIÓN ELECTRÓNICA'));
      if (!target) {
        return {
          found: false,
          headerCount: headers.length,
          texts: headers.map(h => (h.textContent ?? '').trim().slice(0, 60))
        };
      }
      target.click();
      return { found: true };
    });
    if (expanded.found) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!expanded.found) {
    await dumpDebug(page, 'menu-header-missing');
    log.error({ headerCount: expanded.headerCount, texts: expanded.texts }, 'menu_header_facturacion_missing');
    throw new SriError(
      'AUTH_UNEXPECTED',
      `No se encontró el panel "FACTURACIÓN ELECTRÓNICA" en el menú del portal tras 4s de reintentos. Headers detectados (${expanded.headerCount ?? 0}): ${(expanded.texts ?? []).join(' | ')}`
    );
  }

  // 2. Esperar a que los subitems sean clickeables (Angular tarda en renderizar el contenido
  // del panel expandido). Match por href O por texto visible (fallback si el portal cambia IDs).
  const COMPROBANTES_TEXT_FRAGMENT = 'comprobantes electrónicos recibidos';
  let clickResult: { found: boolean; total?: number; hrefs?: string[]; texts?: string[] } = { found: false };
  for (let attempt = 1; attempt <= 10; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    clickResult = await page.evaluate((hrefPart: string, textPart: string) => {
      const links = Array.from(document.querySelectorAll('a.ui-menuitem-link')) as HTMLAnchorElement[];
      const target = links.find(a =>
        (a.getAttribute('href') ?? '').includes(hrefPart) ||
        (a.textContent ?? '').trim().toLowerCase().includes(textPart)
      );
      if (!target) return {
        found: false,
        total: links.length,
        hrefs: links.slice(0, 15).map(a => a.getAttribute('href') ?? ''),
        texts: links.slice(0, 15).map(a => (a.textContent ?? '').trim().slice(0, 60))
      };
      target.click();
      return { found: true };
    }, COMPROBANTES_HREF_FRAGMENT, COMPROBANTES_TEXT_FRAGMENT);
    if (clickResult.found) break;
  }
  if (!clickResult.found) {
    await dumpDebug(page, 'submenu-link-missing');
    log.error({ total: clickResult.total, hrefs: clickResult.hrefs, texts: clickResult.texts }, 'submenu_link_missing');
    throw new SriError('AUTH_UNEXPECTED', `No se encontró el subitem "Comprobantes electrónicos recibidos" (href ~ ${COMPROBANTES_HREF_FRAGMENT} o texto) tras 5s. Links detectados (${clickResult.total ?? 0}): ${(clickResult.texts ?? []).join(' | ')}`);
  }

  // 4. Esperar la navegación.
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90_000 }).catch((e) => {
    log.warn({ err: (e as Error).message }, 'nav_app_waitNavigation_warn');
  });

  const appUrl = page.url();
  if (!appUrl.includes(COMPROBANTES_URL_FRAGMENT)) {
    await dumpDebug(page, 'app-url-unexpected');
    throw new SriError('AUTH_UNEXPECTED', `Tras navegar al app de comprobantes, URL inesperada: ${appUrl}`);
  }

  // Esperar a que el form principal esté presente.
  try {
    await page.waitForSelector('#frmPrincipal\\:ano', { timeout: 30_000 });
  } catch (e) {
    await dumpDebug(page, 'form-missing');
    throw new SriError('AUTH_UNEXPECTED', `Form principal (#frmPrincipal:ano) no apareció en el app de comprobantes`, e);
  }

  log.info({ appUrl }, 'nav_app_ok');
  return appUrl;
}

export async function openBrowserSession(p: BrowserSessionParams): Promise<BrowserSession> {
  await fs.mkdir(p.downloadPath, { recursive: true });

  // reCAPTCHA Enterprise invisible (acción 'consulta_cel_recibidos') puntúa la sesión.
  // Para subir el score conviene: Chrome real (no Chromium headless) + perfil persistente
  // (cookies/historial dan confianza) + modo visible. Configurable por entorno.
  const executablePath = process.env.SRI_EXECUTABLE_PATH || undefined;
  const channel = (!executablePath && process.env.SRI_CHROME_CHANNEL) || undefined; // p.ej. 'chrome'
  const userDataDir = process.env.SRI_USER_DATA_DIR || undefined;
  if (userDataDir) await fs.mkdir(userDataDir, { recursive: true });

  const launchOpts: Record<string, unknown> = {
    headless: !HEADFUL,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      // Permitir cookies de terceros — reCAPTCHA Enterprise las usa para conservar
      // contexto de riesgo entre /reload y /execute. Si Privacy Sandbox las bloquea,
      // Google pierde señales y devuelve un score más bajo.
      '--disable-features=TrackingProtection3pcd,PrivacySandboxAdsAPIs,IsolateOrigins,site-per-process'
    ],
    defaultViewport: HEADFUL ? null : { width: 1366, height: 900 },
    protocolTimeout: 180_000
  };
  if (executablePath) launchOpts.executablePath = executablePath;
  else if (channel) launchOpts.channel = channel;
  if (userDataDir) launchOpts.userDataDir = userDataDir;

  // Modo "conectar": nos enganchamos a un Chrome real ya abierto con --remote-debugging-port.
  const connected = !!BROWSER_URL;
  let browser: Browser;
  if (connected) {
    log.info({ browserURL: BROWSER_URL }, 'browser_connect');
    try {
      browser = await puppeteer.connect({ browserURL: BROWSER_URL, defaultViewport: null });
    } catch (err) {
      throw new SriError(
        'AUTH_PORTAL_UNAVAILABLE',
        `No se pudo conectar a Chrome en ${BROWSER_URL}. Verifica que abriste Chrome con ` +
        `--remote-debugging-port (mismo puerto), que no haya otra instancia usando ese perfil, ` +
        `y que el puerto coincida con SRI_BROWSER_URL. Detalle: ${(err as Error).message}`,
        err
      );
    }
  } else {
    log.info({ usandoChromeReal: !!(executablePath || channel), perfilPersistente: !!userDataDir, headful: HEADFUL }, 'browser_launch_opts');
    browser = await puppeteer.launch(launchOpts as Parameters<typeof puppeteer.launch>[0]);
  }

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45_000);
    // En modo "conectar" usamos el navegador real tal cual (su UA y huella son legítimas);
    // sólo parcheamos cuando lanzamos un Chromium propio.
    if (!connected) {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
    }

    // Configurar descarga al directorio especificado (eventsEnabled habilita listeners de progreso).
    const client = await page.target().createCDPSession();
    const downloadParams: Protocol.Browser.SetDownloadBehaviorRequest = {
      behavior: 'allow',
      downloadPath: p.downloadPath,
      eventsEnabled: true
    };
    await client.send('Browser.setDownloadBehavior', downloadParams);

    await loginKeycloak(page, p);
    const appUrl = await navigateToComprobantesApp(page);

    return {
      sessionId: p.sessionId ?? `sri-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      browser,
      page,
      ruc: p.ruc,
      downloadPath: p.downloadPath,
      appUrl,
      connected
    };
  } catch (err) {
    // En modo conectar no matamos el navegador del usuario; sólo nos desconectamos.
    if (connected) browser.disconnect();
    else if (!KEEP_OPEN_AFTER_USE) await browser.close().catch(() => undefined);
    if (err instanceof SriError) throw err;
    const e = err as { name?: string; message?: string };
    if (e.name === 'TimeoutError') throw new SriError('AUTH_TIMEOUT', 'Timeout durante apertura de sesión browser', err);
    throw new SriError('AUTH_UNEXPECTED', e.message ?? 'Error abriendo sesión browser', err);
  }
}

export async function closeBrowserSession(s: BrowserSession): Promise<void> {
  // Conectados a un Chrome existente → sólo desconectar, sin cerrarlo.
  if (s.connected) {
    try { s.browser.disconnect(); } catch { /* noop */ }
    log.info({ sessionId: s.sessionId }, 'browser_session_disconnected');
    return;
  }
  if (KEEP_OPEN_AFTER_USE) {
    log.info({ sessionId: s.sessionId }, 'browser_session_kept_open_debug');
    return;
  }
  try {
    await s.browser.close();
    log.info({ sessionId: s.sessionId }, 'browser_session_closed');
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'browser_session_close_failed');
  }
}
