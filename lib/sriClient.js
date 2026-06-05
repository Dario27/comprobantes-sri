// Cliente del módulo SRI: envoltorio fino sobre los endpoints de /api.
// Las credenciales del SRI solo viajan en el body de /api/session/login; el resto
// de llamadas usan el sessionId devuelto.

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* 204 u otra respuesta sin cuerpo */ }
  if (!res.ok) {
    const message = data?.message || data?.error || `HTTP ${res.status}`;
    const err = new Error(message);
    err.code = data?.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

// Acepta { companyId } (empresa guardada) o { ruc, clave, cedulaAdicional? } (manual).
export function sriLogin(payload) {
  return postJson('/api/session/login', payload);
}

export function listCompanies() {
  return fetch('/api/companies').then((r) => r.json());
}

export function sriLogout(sessionId) {
  return postJson('/api/session/logout', { sessionId });
}

export function sriListing(sessionId, filters) {
  return postJson('/api/listing', { sessionId, filters });
}

export function sriCreateJob(sessionId, filters) {
  return postJson('/api/jobs', { sessionId, filters });
}

// Abre un EventSource al stream SSE del job. Devuelve la instancia para poder cerrarla.
// `onEvent` recibe cada evento parseado; `onDone` se llama al cerrar (done/cancelled).
export function streamJob(jobId, onEvent, onDone) {
  const es = new EventSource(`/api/jobs/${jobId}/stream`);
  es.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data);
      onEvent?.(ev);
      if (ev.type === 'done' || ev.type === 'cancelled') {
        es.close();
        onDone?.(ev);
      }
    } catch { /* ignorar líneas no-JSON */ }
  };
  es.onerror = () => {
    // El servidor cierra el stream al terminar; EventSource intentaría reconectar,
    // así que lo cerramos explícitamente.
    es.close();
    onDone?.(null);
  };
  return es;
}

export function cancelJob(jobId) {
  return postJson(`/api/jobs/${jobId}/cancel`, {});
}

export function fileUrl(claveAcceso, kind = 'xml') {
  return `/api/files/${encodeURIComponent(claveAcceso)}/${kind}`;
}

export async function getComprobanteDetail(claveAcceso, sessionId) {
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  const res = await fetch(`/api/comprobantes/${encodeURIComponent(claveAcceso)}/detail${qs}`);
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function sriDownloadTxtReport(sessionId, filters) {
  const res = await fetch('/api/listing/txt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, filters })
  });
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.error;
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

export function listHistory(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  ).toString();
  return fetch(`/api/history${qs ? `?${qs}` : ''}`).then((r) => r.json());
}
