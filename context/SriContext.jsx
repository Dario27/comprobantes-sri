'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sriLogin, sriLogout } from '@/lib/sriClient';

const SriContext = createContext(null);

const STORAGE_KEY = 'gt_sri_session';

// Sesión del SRI (separada del login del portal). Se persiste en sessionStorage para
// sobrevivir a la navegación entre páginas, pero expira con la pestaña y con el TTL del
// servidor (25 min). No guardamos las credenciales, solo el sessionId.
export function SriProvider({ children }) {
  const [session, setSession] = useState(null); // { sessionId, ruc, expiresAt }
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const s = JSON.parse(stored);
        // Descartar si ya expiró según el servidor.
        if (!s.expiresAt || new Date(s.expiresAt).getTime() > Date.now()) {
          setSession(s);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch { sessionStorage.removeItem(STORAGE_KEY); }
    }
  }, []);

  // payload: { companyId } (empresa guardada) o { ruc, clave, cedulaAdicional? } (manual).
  const connect = useCallback(async (payload) => {
    setConnecting(true);
    try {
      const data = await sriLogin(payload);
      const s = {
        sessionId: data.sessionId,
        ruc: data.ruc,
        companyId: data.companyId,
        companyNombre: data.companyNombre,
        expiresAt: data.expiresAt,
      };
      setSession(s);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return { ok: true };
    } catch (err) {
      return { ok: false, code: err.code, message: err.message };
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const id = session?.sessionId;
    setSession(null);
    sessionStorage.removeItem(STORAGE_KEY);
    if (id) { try { await sriLogout(id); } catch { /* best-effort */ } }
  }, [session]);

  // Marca la sesión como perdida cuando el servidor responde 401 (SESSION_NOT_FOUND/EXPIRED).
  const clearSession = useCallback(() => {
    setSession(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <SriContext.Provider value={{ session, connecting, connect, disconnect, clearSession }}>
      {children}
    </SriContext.Provider>
  );
}

export const useSri = () => {
  const ctx = useContext(SriContext);
  if (!ctx) throw new Error('useSri must be used inside SriProvider');
  return ctx;
};
