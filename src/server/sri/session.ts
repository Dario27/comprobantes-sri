import axios, { type AxiosInstance, type AxiosHeaders } from 'axios';
import axiosRetry from 'axios-retry';
import { CookieJar } from 'tough-cookie';
import { SriError, mapAxiosErrorToSriError } from '../errors';
import type { SriSession } from '../types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function serializeJar(jar: CookieJar): Promise<string> {
  return JSON.stringify(await jar.serialize());
}

export async function deserializeJar(s: string): Promise<CookieJar> {
  return await CookieJar.deserialize(JSON.parse(s));
}

async function applyCookies(jar: CookieJar, url: string, headers: AxiosHeaders) {
  const cookieStr = await jar.getCookieString(url);
  if (cookieStr) headers.set('Cookie', cookieStr);
}

async function captureCookies(jar: CookieJar, url: string, setCookie: string | string[] | undefined) {
  if (!setCookie) return;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of arr) {
    try { await jar.setCookie(c, url); } catch { /* ignore bad cookie strings */ }
  }
}

export async function createSriClient(session: SriSession): Promise<AxiosInstance> {
  const jar = await deserializeJar(session.cookieJarSerialized);

  const client = axios.create({
    timeout: 30_000,
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'es-EC,es;q=0.9',
      'Accept': 'application/json, text/javascript, */*; q=0.01'
    },
    maxRedirects: 0,
    validateStatus: (s) => s < 400 || s === 401 || s === 404 || s === 429
  });

  client.interceptors.request.use(async (config) => {
    if (config.url) await applyCookies(jar, config.url, config.headers as AxiosHeaders);
    return config;
  });

  client.interceptors.response.use(
    async (resp) => {
      if (resp.config.url) await captureCookies(jar, resp.config.url, resp.headers['set-cookie']);
      if (resp.status === 401) throw new SriError('SESSION_EXPIRED', 'SRI requirió re-login (401)');
      if (resp.status === 404) throw new SriError('DOWNLOAD_NOT_FOUND', 'Recurso no encontrado');
      if (resp.status === 429) throw new SriError('LISTING_RATE_LIMITED', 'Rate limit del SRI');
      return resp;
    },
    (err) => Promise.reject(err instanceof SriError ? err : mapAxiosErrorToSriError(err))
  );

  axiosRetry(client, {
    retries: 3,
    retryDelay: (n: number) => [1000, 3000, 9000][n - 1] ?? 9000,
    retryCondition: (err: unknown) => {
      const e = err as { code?: string };
      return e?.code === 'DOWNLOAD_NETWORK';
    }
  });

  return client;
}
