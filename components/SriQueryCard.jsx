'use client';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import SearchIcon from '@mui/icons-material/Search';
import CircularProgress from '@mui/material/CircularProgress';

export const TIPO_COMPROBANTE_OPTIONS = [
  { value: 'factura', label: 'Factura' },
  { value: 'retencion', label: 'Comprobante de retención' },
  { value: 'nota_credito', label: 'Nota de crédito' },
  { value: 'nota_debito', label: 'Nota de débito' },
  { value: 'liquidacion', label: 'Liquidación de compra' },
];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const rowSx = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 };

// Filtros nativos del SRI: año, mes, día (0 = todos) y tipo de comprobante.
export default function SriQueryCard({ filters, onChange, onConsultar, loading, disabled }) {
  const handle = (field) => (e) => {
    const raw = e.target.value;
    const value = field === 'tipoComprobante' ? raw : Number(raw);
    onChange({ ...filters, [field]: value });
  };

  const currentYear = filters.anio;
  const years = [];
  for (let y = currentYear + 1; y >= currentYear - 6; y--) years.push(y);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.75rem' }}>
          Consultar comprobantes recibidos
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Box sx={rowSx}>
          <TextField select size="small" label="Año" value={filters.anio} onChange={handle('anio')} slotProps={{ inputLabel: { shrink: true } }}>
            {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Mes" value={filters.mes} onChange={handle('mes')} slotProps={{ inputLabel: { shrink: true } }}>
            {MESES.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Día" value={filters.dia} onChange={handle('dia')} slotProps={{ inputLabel: { shrink: true } }}>
            <MenuItem value={0}>Todos</MenuItem>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </TextField>
        </Box>
        <Box sx={{ ...rowSx, mt: 2, alignItems: 'center' }}>
          <TextField select size="small" label="Tipo de comprobante" value={filters.tipoComprobante} onChange={handle('tipoComprobante')} slotProps={{ inputLabel: { shrink: true } }} sx={{ gridColumn: 'span 2' }}>
            {TIPO_COMPROBANTE_OPTIONS.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>
          <Button
            variant="contained"
            onClick={onConsultar}
            disabled={disabled || loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
            sx={{ height: 40 }}
          >
            {loading ? 'Consultando…' : 'Consultar'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
