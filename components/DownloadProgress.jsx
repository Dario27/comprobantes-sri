'use client';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import StopCircleIcon from '@mui/icons-material/StopCircle';

const STATUS_LABEL = {
  running: 'Descargando…',
  completed: 'Descarga completada',
  failed: 'Descarga fallida',
  cancelled: 'Descarga cancelada',
};

// Presentacional: recibe el estado del job y muestra progreso + acción de cancelar.
export default function DownloadProgress({ job, onCancel }) {
  if (!job) return null;
  const { status, total, done, failed, skipped } = job;
  const processed = done + failed + skipped;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const indeterminate = status === 'running' && total === 0;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" fontWeight={700}>{STATUS_LABEL[status] || status}</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip size="small" color="success" variant="outlined" label={`OK ${done}`} />
            {skipped > 0 && <Chip size="small" variant="outlined" label={`Omitidos ${skipped}`} />}
            {failed > 0 && <Chip size="small" color="error" variant="outlined" label={`Fallidos ${failed}`} />}
            {total > 0 && <Typography variant="caption" color="text.secondary">{processed}/{total}</Typography>}
            {status === 'running' && onCancel && (
              <Button size="small" color="error" variant="outlined" startIcon={<StopCircleIcon />} onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </Box>
        </Box>
        <LinearProgress
          variant={indeterminate ? 'indeterminate' : 'determinate'}
          value={pct}
          color={status === 'failed' ? 'error' : status === 'cancelled' ? 'warning' : 'primary'}
        />
      </CardContent>
    </Card>
  );
}
