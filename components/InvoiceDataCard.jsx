'use client';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { fmtMoney, estadoConfig } from '@/lib/mockData';

function DataItem({ label, value, valueProps = {} }) {
  return (
    <Box>
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.5 }}
      >
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600} {...valueProps}>
        {value}
      </Typography>
    </Box>
  );
}

export default function InvoiceDataCard({ invoice }) {
  if (!invoice) return null;
  const cfg = estadoConfig[invoice.estado] || {};

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.75rem', mb: 2 }}>
          Datos de la Factura
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Typography variant="h5" color="primary" fontWeight={800}>
            {invoice.numero}
          </Typography>
          <Chip label={invoice.estado} size="small" sx={{ bgcolor: cfg.bg, color: cfg.text, fontWeight: 700 }} />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
          <DataItem label="Fecha de Emisión" value={invoice.fecha} />
          <DataItem label="Empresa (Emisor)" value={invoice.empresa} />
          <DataItem label="Proveedor" value={invoice.proveedor} />
          <DataItem label="Importe Total" value={fmtMoney(invoice.importe)} valueProps={{ color: 'primary.main' }} />
          <DataItem label="Estado" value={invoice.estado} />
        </Box>
      </CardContent>
    </Card>
  );
}
