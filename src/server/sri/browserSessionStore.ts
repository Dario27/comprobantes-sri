import type { BrowserSession } from './browserSession';
import { closeBrowserSession } from './browserSession';
import { childLogger } from '../logging';

const log = childLogger('sri:browserSessionStore');

const SESSION_TTL_MS = 25 * 60 * 1000;   // 25 minutos
const IDLE_REAP_INTERVAL_MS = 60 * 1000; // chequeo cada minuto

interface Entry {
  session: BrowserSession;
  companyId: number;
  companyNombre: string;
  expiresAt: number;
}

const globalAny = globalThis as unknown as {
  __sriBrowserSessions?: Map<string, Entry>;
  __sriBrowserSessionsReaper?: NodeJS.Timeout;
};

if (!globalAny.__sriBrowserSessions) globalAny.__sriBrowserSessions = new Map<string, Entry>();
const map: Map<string, Entry> = globalAny.__sriBrowserSessions;

function startReaperIfNeeded() {
  if (globalAny.__sriBrowserSessionsReaper) return;
  globalAny.__sriBrowserSessionsReaper = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of map.entries()) {
      if (entry.expiresAt < now) {
        log.info({ sessionId: id }, 'session_expired_reaping');
        map.delete(id);
        void closeBrowserSession(entry.session).catch((e) =>
          log.warn({ sessionId: id, err: (e as Error).message }, 'reaper_close_failed')
        );
      }
    }
  }, IDLE_REAP_INTERVAL_MS);
  // No bloquear el process exit por el timer.
  globalAny.__sriBrowserSessionsReaper.unref?.();
}

export interface RegisterOptions {
  companyId: number;
  companyNombre: string;
}

export const browserSessionStore = {
  register(session: BrowserSession, opts: RegisterOptions): { sessionId: string; expiresAt: Date } {
    startReaperIfNeeded();
    const expiresAt = Date.now() + SESSION_TTL_MS;
    map.set(session.sessionId, {
      session,
      companyId: opts.companyId,
      companyNombre: opts.companyNombre,
      expiresAt
    });
    log.info({ sessionId: session.sessionId, companyId: opts.companyId }, 'session_registered');
    return { sessionId: session.sessionId, expiresAt: new Date(expiresAt) };
  },

  get(sessionId: string): { session: BrowserSession; companyId: number; companyNombre: string } | null {
    const e = map.get(sessionId);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      map.delete(sessionId);
      void closeBrowserSession(e.session).catch(() => undefined);
      return null;
    }
    // Touch: extender TTL al usarse.
    e.expiresAt = Date.now() + SESSION_TTL_MS;
    return { session: e.session, companyId: e.companyId, companyNombre: e.companyNombre };
  },

  async destroy(sessionId: string): Promise<void> {
    const e = map.get(sessionId);
    if (!e) return;
    map.delete(sessionId);
    await closeBrowserSession(e.session).catch((err) =>
      log.warn({ sessionId, err: (err as Error).message }, 'destroy_close_failed')
    );
    log.info({ sessionId }, 'session_destroyed');
  }
};
