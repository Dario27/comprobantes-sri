// Cliente para la gestión de empresas, ejecuciones y descarga manual.
// Con login único del portal, estos endpoints ya no requieren una sesión admin aparte.

async function req(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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

export function listCompaniesAdmin() {
  return req('/api/admin/companies');
}

export function createCompany(body) {
  return req('/api/admin/companies', { method: 'POST', body: JSON.stringify(body) });
}

export function updateCompany(id, body) {
  return req(`/api/admin/companies/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteCompany(id) {
  return req(`/api/admin/companies/${id}`, { method: 'DELETE' });
}

export function listJobRuns(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  ).toString();
  return req(`/api/admin/job-runs${qs ? `?${qs}` : ''}`);
}

export function runNow(companyId) {
  return req('/api/admin/scheduler/run-now', { method: 'POST', body: JSON.stringify({ companyId }) });
}

export function listUsuarios() {
  return req('/api/admin/usuarios');
}

export function createUsuario(body) {
  return req('/api/admin/usuarios', { method: 'POST', body: JSON.stringify(body) });
}

export function updateUsuario(id, body) {
  return req(`/api/admin/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteUsuario(id) {
  return req(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
}
