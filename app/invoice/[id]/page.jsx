'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AppShell from '@/components/AppShell';
import ComprobanteDetailCard from '@/components/ComprobanteDetailCard';
import ClassificationCard from '@/components/ClassificationCard';
import CatalogsCard from '@/components/CatalogsCard';
import { getComprobanteDetail } from '@/lib/sriClient';

const isClave = (s) => /^\d{49}$/.test(String(s));

export default function InvoiceDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | not-downloaded | error
  const [errorMsg, setErrorMsg] = useState('');
  const [invoiceType, setInvoiceType] = useState(null); // 'caja-chica' | 'inventario' | 'gastos'

  useEffect(() => {
    if (!isClave(id)) { setStatus('error'); setErrorMsg('Identificador de comprobante inválido.'); return; }

    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const d = await getComprobanteDetail(id);
        if (!cancelled) { setDetail(d); setStatus('ok'); }
      } catch (err) {
        if (cancelled) return;
        if (err.code === 'COMPROBANTE_NOT_FOUND') setStatus('not-downloaded');
        else { setStatus('error'); setErrorMsg(err.message || 'No se pudo cargar el detalle.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <AppShell>
      <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard')} sx={{ mb: 3, fontWeight: 600, pl: 0 }}>
        Volver a la bandeja
      </Button>

      {status === 'loading' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      )}

      {status === 'not-downloaded' && (
        <Alert severity="info">
          Este comprobante aún no está en la bandeja. Se incorporará cuando el job automático lo descargue
          (o se descargue manualmente).
        </Alert>
      )}

      {status === 'error' && <Alert severity="error">{errorMsg}</Alert>}

      {status === 'ok' && detail && (
        <>
          <ComprobanteDetailCard detail={detail} />
          <ClassificationCard selected={invoiceType} onSelect={setInvoiceType} />
          <CatalogsCard
            invoiceType={invoiceType}
            invoiceId={detail.meta.claveAcceso}
            onSaved={() => router.push('/dashboard')}
          />
        </>
      )}
    </AppShell>
  );
}
