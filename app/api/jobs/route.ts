import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { JobCreateInput } from '@server/validation';
import { browserSessionStore } from '@server/sri/browserSessionStore';
import { forEachFactura } from '@server/sri/listingPuppeteer';
import { downloadComprobante } from '@server/sri/downloaderPuppeteer';
import { SRI_DOWNLOAD_DELAY_MS } from '@server/sri/config';
import { createJobState, emitJobEvent } from '@server/jobs/jobStore';
import { boot } from '@server/bootstrap';
import { pad2 } from '@lib/format';
import { childLogger } from '@server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const log = childLogger('api:jobs');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = JobCreateInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad_input', detail: parsed.error.format() }, { status: 400 });

  const entry = browserSessionStore.get(parsed.data.sessionId);
  if (!entry) return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 401 });

  // companyId real de la sesión (0 = conexión manual sin empresa guardada).
  const companyId = entry.companyId;

  // La FK company_id → companies requiere una empresa guardada válida.
  // Las descargas manuales sin empresa (companyId <= 0) son rechazadas.
  if (companyId <= 0) {
    return NextResponse.json(
      { error: 'COMPANY_REQUIRED', message: 'Las descargas requieren una empresa registrada. Configura una empresa en el panel de administración.' },
      { status: 409 }
    );
  }

  const jobId = uuid();
  const state = createJobState(jobId);

  boot.db.createJob({
    id: jobId,
    filtersJson: JSON.stringify(parsed.data.filters),
    status: 'running', total: 0, done: 0, failed: 0,
    startedAt: state.startedAt.toISOString(),
    companyId
  });

  // El historial de ejecuciones (job_runs) referencia una empresa (FK). Solo registramos
  // un run cuando la sesión está asociada a una empresa guardada (companyId > 0).
  let jobRunId: number | null = null;
  if (companyId > 0) {
    const f = parsed.data.filters;
    const rangoDesde = `${f.anio}-${pad2(f.mes)}-${f.dia > 0 ? pad2(f.dia) : '01'}`;
    const rangoHasta = `${f.anio}-${pad2(f.mes)}-31`;
    jobRunId = boot.jobRuns.create({ companyId, modo: 'MANUAL', rangoDesde, rangoHasta });
  }

  void (async () => {
    try {
      const stats = await forEachFactura(
        entry.session.page,
        {
          anio: parsed.data.filters.anio,
          mes: parsed.data.filters.mes,
          dia: parsed.data.filters.dia,
          tipoComprobante: parsed.data.filters.tipoComprobante
        },
        async (meta, rowIndex) => {
          if (state.abort.signal.aborted) return;
          // Dedupe contra BD por empresa.
          if (boot.db.findAlreadyDownloaded([meta.claveAcceso], companyId).length > 0) {
            state.skipped++;
            emitJobEvent(state, { type: 'item_skipped', claveAcceso: meta.claveAcceso, reason: 'already_downloaded' });
            emitJobEvent(state, {
              type: 'progress', done: state.done, failed: state.failed, skipped: state.skipped, total: state.total
            });
            return;
          }
          const { xmlContent } = await downloadComprobante(
            entry.session.page,
            rowIndex,
            meta.claveAcceso,
            entry.session.downloadPath
          );
          boot.db.upsertComprobante({
            claveAcceso: meta.claveAcceso,
            rucEmisor: meta.rucEmisor,
            razonSocialEmisor: meta.razonSocialEmisor,
            tipo: meta.tipo,
            numeroAutorizacion: meta.numeroAutorizacion,
            fechaEmision: meta.fechaEmision,
            fechaAutorizacion: meta.fechaAutorizacion,
            montoTotal: meta.montoTotal,
            xmlPath: null,
            ridePath: null,
            xmlContent,
            downloadedAt: new Date().toISOString(),
            status: 'ok',
            companyId
          });
          state.done++;
          emitJobEvent(state, { type: 'item_ok', claveAcceso: meta.claveAcceso });
          emitJobEvent(state, {
            type: 'progress', done: state.done, failed: state.failed, skipped: state.skipped, total: state.total
          });
          if (SRI_DOWNLOAD_DELAY_MS > 0) {
            await new Promise<void>((resolve) => {
              const t = setTimeout(resolve, SRI_DOWNLOAD_DELAY_MS);
              state.abort.signal.addEventListener('abort', () => {
                clearTimeout(t);
                resolve();
              }, { once: true });
            });
          }
        }
      );
      state.total = stats.total;
      state.failed = stats.failed;
      state.status = state.abort.signal.aborted ? 'cancelled' : 'completed';
      state.finishedAt = new Date();
      emitJobEvent(state, state.status === 'cancelled'
        ? { type: 'cancelled' }
        : { type: 'done', ok: state.done, failed: state.failed, skipped: state.skipped }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      log.error({ jobId, err: message }, 'job_run_failed');
      state.status = 'failed';
      state.error = message;
      state.finishedAt = new Date();
    } finally {
      boot.db.updateJob(jobId, {
        status: state.status, total: state.total, done: state.done, failed: state.failed,
        finishedAt: state.finishedAt?.toISOString() ?? null,
        error: state.error ?? null
      });
      if (jobRunId !== null) {
        boot.jobRuns.finish(
          jobRunId,
          state.status === 'completed' ? 'EXITO' : 'FALLO',
          {
            comprobantesDescargados: state.done,
            comprobantesFallidos: state.failed,
            errorMensaje: state.error ?? null
          }
        );
      }
    }
  })();

  return NextResponse.json({ jobId });
}
