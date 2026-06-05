'use client';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { fmtMoney } from '@/lib/mockData';

const TIPO_LABEL = {
  factura: 'Factura',
  retencion: 'Comprobante de retención',
  nota_credito: 'Nota de crédito',
  nota_debito: 'Nota de débito',
  liquidacion: 'Liquidación de compra',
};

function Item({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>{value || '—'}</Typography>
    </Box>
  );
}

export default function ComprobanteDetailCard({ detail }) {
  if (!detail) return null;
  const { meta, emisor, receptor, totales, detalles } = detail;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.75rem' }}>
              {TIPO_LABEL[meta.tipo] || 'Comprobante'}
            </Typography>
            <Typography variant="h6" color="primary" fontWeight={800}>{meta.secuencial || `…${String(meta.claveAcceso).slice(-12)}`}</Typography>
          </Box>
          {meta.estado && <Chip label={meta.estado} size="small" color={meta.estado === 'AUTORIZADO' ? 'success' : 'default'} variant="outlined" />}
        </Box>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, mb: 3 }}>
          <Item label="Fecha emisión" value={meta.fechaEmision} />
          <Item label="Fecha autorización" value={meta.fechaAutorizacion} />
          <Item label="Ambiente" value={meta.ambiente === '2' ? 'Producción' : meta.ambiente === '1' ? 'Pruebas' : meta.ambiente} />
        </Box>

        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block', mb: 1 }}>Emisor</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, mb: 3 }}>
          <Item label="RUC" value={emisor.ruc} />
          <Item label="Razón social" value={emisor.razonSocial} />
          <Item label="Nombre comercial" value={emisor.nombreComercial} />
        </Box>

        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block', mb: 1 }}>Receptor</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, mb: 3 }}>
          <Item label="Identificación" value={receptor.identificacion} />
          <Item label="Razón social" value={receptor.razonSocial} />
          <Item label="Dirección" value={receptor.direccion} />
        </Box>

        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
          <Item label="Subtotal" value={totales.subtotalSinImpuestos != null ? fmtMoney(totales.subtotalSinImpuestos) : '—'} />
          <Item label="IVA" value={totales.iva != null ? fmtMoney(totales.iva) : '—'} />
          <Item label="Descuento" value={totales.descuento != null ? fmtMoney(totales.descuento) : '—'} />
          <Item label="Importe total" value={fmtMoney(totales.importeTotal)} />
        </Box>

        {detalles && detalles.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block', mb: 1 }}>Detalle</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Descripción', 'Cant.', 'P. unit.', 'Total'].map((h) => (
                    <TableCell key={h} sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {detalles.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.descripcion}</TableCell>
                    <TableCell>{d.cantidad}</TableCell>
                    <TableCell>{fmtMoney(d.precioUnitario)}</TableCell>
                    <TableCell>{fmtMoney(d.precioTotalSinImpuesto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
