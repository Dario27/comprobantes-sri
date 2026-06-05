import { type Browser, type Page } from 'puppeteer';
import { puppeteer } from './puppeteerLauncher';
import { v4 as uuid } from 'uuid';
import { CookieJar } from 'tough-cookie';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SriError } from '../errors';
import { serializeJar } from './session';
import { childLogger } from '../logging';
import type { SriSession } from '../types';

const log = childLogger('sri:auth');
const DEBUG = process.env.SRI_DEBUG === '1';

async function dumpDebug(page: Page, label: string): Promise<void> {
  try {
    const dir = path.resolve(process.cwd(), 'logs');
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.join(dir, `auth-${label}-${stamp}`);
    await page.screenshot({ path: `${base}.png`, fullPage: true });
    const html = await page.content();
    await fs.writeFile(`${base}.html`, html, 'utf8');
    log.info({ label, screenshot: `${base}.png`, html: `${base}.html`, url: page.url() }, 'auth_debug_dump');
  } catch (err: unknown) {
    log.warn({ err: (err as Error).message }, 'auth_debug_dump_failed');
  }
}

// Configuración del flujo OAuth/OpenID Connect del SRI.
// El SRI usa Keycloak (realm "Internet") detrás de una SPA Angular. Para autenticarse,
// se navega al portal autenticado; Angular detecta la falta de sesión y dispara el
// authorize endpoint con state/nonce dinámicos. Puppeteer rellena el form que sirve
// Keycloak y deja que el flujo complete el round-trip.
export const SRI_CONFIG = {
  baseUrl: 'https://srienlinea.sri.gob.ec',
  // Entrada al portal autenticado. Angular se encarga del redirect a Keycloak.
  startPath: '/sri-en-linea/contribuyente/perfil',

  // Selectores del form Keycloak (theme custom SRI). El form tiene un `input#username` HIDDEN
  // (interno) y un `input#usuario` visible donde se escribe. Priorizamos los VISIBLES; Puppeteer
  // no puede `type` en hidden inputs.
  rucSelector: '#usuario, input[name="usuario"], #username',
  // Cédula adicional: presente en algunas cuentas SRI como tercer campo opcional/obligatorio.
  ciAdicionalSelector: '#ciAdicional, input[name="ciAdicional"]',
  claveSelector: '#password, input[name="password"]',
  submitSelector: '#kc-login, input[type="submit"], button[type="submit"]',

  // Mensaje de error de credenciales — selectores estándar de Keycloak + variantes.
  errorSelector: '#input-error, .alert-error, .kc-feedback-text, .pf-c-alert__title, .alert-danger',

  // Detección de captcha (poco común pero posible tras N intentos fallidos).
  captchaSelector: '.g-recaptcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"]',

  // Validación de éxito por URL: aterrizamos en el portal autenticado y dejamos /auth/realms/.
  successUrlContains: '/sri-en-linea/contribuyente',
  authPathContains: '/auth/realms/Internet'
};

export interface LoginInternalParams {
  baseUrl: string;
  ruc: string;
  clave: string;
  cedulaAdicional?: string;
  startPath?: string;
  rucSelector?: string;
  ciAdicionalSelector?: string;
  claveSelector?: string;
  submitSelector?: string;
  errorSelector?: string;
  captchaSelector?: string;
  successUrlContains?: string;
  authPathContains?: string;
}

export async function loginInternal(p: LoginInternalParams): Promise<SriSession> {
  const cfg = { ...SRI_CONFIG, ...p };
  let browser: Browser | undefined;
  let page: Page | undefined;
  try {
    browser = await puppeteer.launch({
      headless: !DEBUG,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: DEBUG ? null : { width: 1280, height: 800 },
      protocolTimeout: 120_000
    });
    page = await browser.newPage();
    page.setDefaultTimeout(20_000);

    // Anti-detección: usar UA real (no HeadlessChrome) y ocultar webdriver flag.
    // El portal SRI bloquea con "Validación de navegadores" si detecta automation.
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    log.info({ debug: DEBUG }, 'auth_start');

    // 1. Entrar al portal autenticado. Angular redirige a Keycloak con state/nonce dinámicos.
    log.info({ url: `${cfg.baseUrl}${cfg.startPath ?? '/'}` }, 'auth_step_goto');
    await page.goto(`${cfg.baseUrl}${cfg.startPath ?? '/'}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    });
    log.info({ landed: page.url() }, 'auth_step_after_goto');

    // 2. Captcha visible antes de poder rellenar el form → abortar.
    if (await page.$(cfg.captchaSelector)) {
      await dumpDebug(page, 'captcha');
      throw new SriError('AUTH_CAPTCHA_REQUIRED', 'El portal está pidiendo captcha; login no automatizable');
    }

    // 3. Esperar a que el form de Keycloak aparezca (puede tardar por la cadena de redirects).
    log.info({ selector: cfg.rucSelector }, 'auth_step_wait_form');
    try {
      await page.waitForSelector(cfg.rucSelector, { timeout: 20_000 });
    } catch (selErr) {
      await dumpDebug(page, 'no-form');
      throw new SriError('AUTH_TIMEOUT', `No apareció el campo de usuario (${cfg.rucSelector}) en 20s. URL actual: ${page.url()}`, selErr);
    }

    log.info('auth_step_type_credentials');
    await page.type(cfg.rucSelector, p.ruc);
    // Rellenar `ciAdicional` solo si el form lo muestra Y la empresa lo configuró.
    const ciAdicional = await page.$(cfg.ciAdicionalSelector);
    if (ciAdicional && p.cedulaAdicional) {
      log.info('auth_step_type_ci_adicional');
      await page.type(cfg.ciAdicionalSelector, p.cedulaAdicional);
    } else if (ciAdicional && !p.cedulaAdicional) {
      log.warn('auth_form_requires_ci_adicional_but_company_has_none');
    }
    await page.type(cfg.claveSelector, p.clave);

    // 4. Submit.
    log.info({ selector: cfg.submitSelector }, 'auth_step_submit');
    await page.click(cfg.submitSelector);

    // 5. Esperar a una de dos condiciones: (a) la URL contiene successUrlContains, o
    // (b) aparece un mensaje de error visible mientras seguimos en /auth/realms/.
    try {
      await page.waitForFunction(
        (success: string, authPath: string, errorSel: string) => {
          if (location.href.includes(success)) return true;
          const errEl = document.querySelector(errorSel);
          if (errEl && location.href.includes(authPath)) return true;
          return false;
        },
        { timeout: 45_000 },
        cfg.successUrlContains,
        cfg.authPathContains,
        cfg.errorSelector
      );
    } catch (waitErr) {
      await dumpDebug(page, 'post-submit-timeout');
      throw new SriError(
        'AUTH_TIMEOUT',
        `Timeout esperando confirmación post-submit. URL actual: ${page.url()}. Revisa el screenshot y HTML en logs/.`,
        waitErr
      );
    }
    log.info({ url: page.url() }, 'auth_step_post_submit');

    // 6. Si seguimos en /auth/realms/, el form aún está visible → credenciales inválidas.
    if (page.url().includes(cfg.authPathContains)) {
      const errorEl = await page.$(cfg.errorSelector);
      const msg = errorEl
        ? (await page.evaluate((el) => el.textContent ?? '', errorEl)).trim()
        : 'Credenciales rechazadas';
      await dumpDebug(page, 'credentials-rejected');
      throw new SriError('AUTH_INVALID_CREDENTIALS', `SRI rechazó el login: ${msg}`);
    }

    if (!page.url().includes(cfg.successUrlContains)) {
      await dumpDebug(page, 'unexpected-url');
      throw new SriError('AUTH_UNEXPECTED', `Login terminó en URL inesperada: ${page.url()}`);
    }

    // 7. Warmup del app de comprobantes electrónicos: el SRI usa /tuportal-internet/GeneraToken.jsp
    // como puente desde la sesión SSO Keycloak a las cookies específicas del app (JSESSIONID,
    // BIGipServerCEL-internet, TS01...). Navegamos a la URL JSF y dejamos que Puppeteer siga la
    // cadena de redirects para armar todas las cookies necesarias antes de capturarlas.
    const warmupUrl = 'https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf';
    log.info({ warmupUrl }, 'auth_step_warmup');
    try {
      await page.goto(warmupUrl, { waitUntil: 'networkidle2', timeout: 45_000 });
      log.info({ landed: page.url() }, 'auth_step_warmup_done');
    } catch (warmErr) {
      log.warn({ err: (warmErr as Error).message, url: page.url() }, 'auth_step_warmup_failed');
    }

    // 8. Extraer TODAS las cookies del dominio (Keycloak en /auth, app SRI en /sri-en-linea,
    // y app comprobantes en /comprobantes-electronicos-internet — todas armadas tras el warmup).
    const cookies = await page.cookies();
    const jar = new CookieJar();
    for (const c of cookies) {
      const parts = [
        `${c.name}=${c.value}`,
        `Path=${c.path || '/'}`,
        c.domain ? `Domain=${c.domain.replace(/^\./, '')}` : '',
        c.secure ? 'Secure' : '',
        c.httpOnly ? 'HttpOnly' : ''
      ].filter(Boolean);
      try {
        await jar.setCookie(parts.join('; '), cfg.baseUrl);
      } catch { /* tough-cookie rechaza algunas combinaciones; ignoramos */ }
    }

    return {
      sessionId: uuid(),
      cookieJarSerialized: await serializeJar(jar),
      ruc: p.ruc,
      expiresAt: new Date(Date.now() + 25 * 60 * 1000)
    };
  } catch (err: unknown) {
    if (page) await dumpDebug(page, 'caught-error').catch(() => undefined);
    if (err instanceof SriError) throw err;
    const e = err as { name?: string; message?: string };
    if (e.name === 'TimeoutError') throw new SriError('AUTH_TIMEOUT', 'Timeout esperando elementos de login', err);
    throw new SriError('AUTH_UNEXPECTED', e.message ?? 'Error de login desconocido', err);
  } finally {
    if (browser && !DEBUG) await browser.close();
  }
}

export async function login(ruc: string, clave: string): Promise<SriSession> {
  log.info({ ruc }, 'login_attempt');
  try {
    const s = await loginInternal({ ...SRI_CONFIG, ruc, clave });
    log.info({ ruc, sessionId: s.sessionId }, 'login_ok');
    return s;
  } catch (err: unknown) {
    const e = err as { code?: string };
    log.warn({ ruc, code: e?.code }, 'login_failed');
    throw err;
  }
}
