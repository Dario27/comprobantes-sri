'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import DownloadIcon from '@mui/icons-material/Download';
import AppShell from '@/components/AppShell';
import { useSri } from '@/context/SriContext';
import ConnectSriCard from '@/components/ConnectSriCard';
import SriQueryCard from '@/components/SriQueryCard';
import ComprobantesTable from '@/components/ComprobantesTable';
import DownloadProgress from '@/components/DownloadProgress';
import DescriptionIcon from '@mui/icons-material/Description';
import { sriListing, sriCreateJob, streamJob, cancelJob, sriDownloadTxtReport } from '@/lib/sriClient';

const now = new Date();
const DEFAULT_FILTERS = { anio: now.getFullYear(), mes: now.getMonth() + 1, dia: 0, tipoComprobante: 'factura' };

// Descarga manual en vivo: conectar al SRI, consultar un periodo y forzar la descarga.
// El flujo normal es el job automático; esto es para descargas puntuales.
export default function DescargaPage() {
  const { session, clearSession } = useSri();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [comprobantes, setComprobantes] = useState([]);
  const [listingLoading, setListingLoading] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [downloaded, setDownloaded] = useState(new Set());
  const [txtLoading, setTxtLoading] = useState(false);
  const esRef = useRef(null);

  useEffect(() => () => { esRef.current?.close(); }, []);

  const handleSessionError = useCallback((err) => {
    if (err.status === 401 || err.code === 'SESSION_NOT_FOUND' || err.code === 'SESSION_EXPIRED') {
      clearSession();
      setError('La sesión del SRI expiró o no es válida. Vuelve a conectarte.');
      return true;
    }
    return false;
  }, [clearSession]);

  const handleConsultar = useCallback(async () => {
    if (!session) return;
    setError(''); setListingLoading(true); setComprobantes([]);
    try {
      const data = await sriListing(session.sessionId, filters);
      setComprobantes(data.items || []);
    } catch (err) {
      if (!handleSessionError(err)) setError(err.message || 'No se pudo consultar el listado.');
    } finally {
      setListingLoading(false);
    }
  }, [session, filters, handleSessionError]);

  const handleDescargar = useCallback(async () => {
    if (!session) return;
    setError('');
    try {
      const { jobId: id } = await sriCreateJob(session.sessionId, filters);
      setJobId(id);
      setJob({ status: 'running', total: comprobantes.length, done: 0, failed: 0, skipped: 0 });
      esRef.current?.close();
      esRef.current = streamJob(id, (ev) => {
        if (ev.type === 'started') setJob((j) => ({ ...j, status: 'running', total: ev.total }));
        else if (ev.type === 'progress') setJob((j) => ({ ...j, done: ev.done, failed: ev.failed, skipped: ev.skipped, total: ev.total }));
        else if (ev.type === 'item_ok' || ev.type === 'item_skipped') setDownloaded((prev) => new Set(prev).add(ev.claveAcceso));
        else if (ev.type === 'done') setJob((j) => ({ ...j, status: 'completed', done: ev.ok, failed: ev.failed, skipped: ev.skipped }));
        else if (ev.type === 'cancelled') setJob((j) => ({ ...j, status: 'cancelled' }));
      });
    } catch (err) {
      if (!handleSessionError(err)) setError(err.message || 'No se pudo iniciar la descarga.');
    }
  }, [session, filters, comprobantes.length, handleSessionError]);

  const handleCancel = useCallback(async () => {
    if (jobId) { try { await cancelJob(jobId); } catch { /* best-effort */ } }
  }, [jobId]);

  const handleDescargarTxt = useCallback(async () => {
    if (!session) return;
    setError('');
    setTxtLoading(true);
    try {
      const blob = await sriDownloadTxtReport(session.sessionId, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${filters.anio}-${String(filters.mes).padStart(2, '0')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (!handleSessionError(err)) setError(err.message || 'No se pudo descargar el reporte TXT.');
    } finally {
      setTxtLoading(false);
    }
  }, [session, filters, handleSessionError]);

  const jobRunning = job?.status === 'running';

  return (
    <AppShell>
      <Box sx={{ ml: '4.5%', width: '85%' }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Descarga manual (SRI)</Typography>

      <ConnectSriCard />

      {session && (
        <>
          <SriQueryCard filters={filters} onChange={setFilters} onConsultar={handleConsultar} loading={listingLoading} disabled={jobRunning} />
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          <DownloadProgress job={job} onCancel={handleCancel} />
          {comprobantes.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">{comprobantes.length} comprobante(s) encontrados</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={handleDescargarTxt} disabled={jobRunning || txtLoading}>
                  {txtLoading ? 'Descargando…' : 'Descargar TXT'}
                </Button>
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDescargar} disabled={jobRunning}>Descargar todos</Button>
              </Box>
            </Box>
          )}
          <ComprobantesTable rows={comprobantes} downloaded={downloaded} />
        </>
      )}

      {!session && (
        <Alert severity="info">Conéctate al SRI (elige una empresa guardada o usa credenciales) para consultar y descargar manualmente.</Alert>
      )}
      </Box>
    </AppShell>
  );
}
