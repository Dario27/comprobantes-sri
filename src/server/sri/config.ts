function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export const SRI_DOWNLOAD_DELAY_MS = parsePositiveInt(process.env.SRI_DOWNLOAD_DELAY_MS, 1000);

// Timeout por descarga individual (ms). Default 20 s: amplio para descargas lentas legítimas
// pero 3× más rápido que los 60 s anteriores al detectar un bloqueo.
export const SRI_DOWNLOAD_TIMEOUT_MS = parsePositiveInt(process.env.SRI_DOWNLOAD_TIMEOUT_MS, 20_000);

// Número de fallos consecutivos de descarga que activan el circuit breaker y abortan el job.
// Con umbral 3, un fallo aislado no interrumpe; el bloqueo real del portal (que antes causaba
// 22 fallos seguidos) se detecta en el tercero.
export const SRI_DOWNLOAD_FAIL_THRESHOLD = parsePositiveInt(process.env.SRI_DOWNLOAD_FAIL_THRESHOLD, 3);

// Jitter aleatorio añadido al delay entre descargas (ms). 0 = desactivado. Recomendado: 500-1500
// en producción para romper la cadencia mecánica que el reCAPTCHA Enterprise penaliza.
export const SRI_DOWNLOAD_JITTER_MS = parsePositiveInt(process.env.SRI_DOWNLOAD_JITTER_MS, 0);
