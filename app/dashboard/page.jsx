'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  DataGrid, GridToolbar, GridActionsCellItem,
} from '@mui/x-data-grid';
import AppShell from '@/components/AppShell';
import { fmtMoney } from '@/lib/mockData';
import { listHistory, fileUrl } from '@/lib/sriClient';

const TIPO_LABEL = {
  factura: 'Factura', retencion: 'Retención', nota_credito: 'Nota de crédito',
  nota_debito: 'Nota de débito', liquidacion: 'Liquidación',
};

function triggerDownload(href) {
  const a = document.createElement('a');
  a.href = href;
  a.setAttribute('download', '');
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function DashboardPage() {
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState([]);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const d = await listHistory({ limit: 1000 });
      setItems(d.items || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la bandeja.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    {
      field: 'tipo', headerName: 'Tipo', width: 100,
      renderCell: (p) => <Chip size="small" variant="outlined" label={TIPO_LABEL[p.value] || p.value} sx={{ fontWeight: 600 }} />,
    },
    {
      field: 'claveAcceso', headerName: 'Clave de acceso', flex: 1, minWidth: 230,
      renderCell: (p) => <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{p.value}</Typography>,
    },
    { field: 'rucEmisor', headerName: 'RUC emisor', width: 140 },
    { field: 'razonSocialEmisor', headerName: 'Emisor', flex: 1, minWidth: 180 },
    { field: 'fechaEmision', headerName: 'Emisión', width: 120 },
    {
      field: 'montoTotal', headerName: 'Monto', width: 120, type: 'number',
      valueFormatter: (value) => (value != null ? fmtMoney(value) : ''),
    },
    {
      field: 'downloadedAt', headerName: 'Descargado', width: 160,
      valueFormatter: (value) => (value ? new Date(value).toLocaleString('es-EC') : ''),
    },
    {
      field: 'actions', type: 'actions', headerName: 'Acciones', width: 110,
      getActions: (params) => [
        <GridActionsCellItem key="ver" icon={<VisibilityIcon />} label="Ver detalle"
          onClick={() => router.push(`/invoice/${encodeURIComponent(params.id)}`)} />,
        <GridActionsCellItem key="xml" icon={<DownloadIcon />} label="Descargar XML"
          onClick={() => triggerDownload(fileUrl(params.id, 'xml'))} />,
      ],
    },
  ], [router]);

  const handleDownloadSelected = () => {
    selection.forEach((clave) => triggerDownload(fileUrl(clave, 'xml')));
  };

  return (
    <AppShell>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Bandeja de trabajo</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} disabled={selection.length === 0} onClick={handleDownloadSelected}>
            Descargar XML ({selection.length})
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={busy}>Refrescar</Button>
        </Box>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Comprobantes recibidos descargados. Ordena, filtra o busca, y abre uno para revisarlo y clasificarlo.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ height: 'calc(100vh - 240px)', minHeight: 420 }}>
        <DataGrid
          rows={items}
          columns={columns}
          getRowId={(row) => row.claveAcceso}
          loading={busy}
          checkboxSelection
          disableRowSelectionOnClick
          onRowSelectionModelChange={setSelection}
          rowSelectionModel={selection}
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: true, csvOptions: { fileName: 'comprobantes' } } }}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: 'downloadedAt', sort: 'desc' }] },
          }}
          pageSizeOptions={[25, 50, 100]}
          density="compact"
          sx={{ border: 'none' }}
        />
      </Card>
    </AppShell>
  );
}
