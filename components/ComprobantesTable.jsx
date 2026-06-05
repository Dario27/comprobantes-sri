'use client';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DownloadIcon from '@mui/icons-material/Download';
import { fmtMoney } from '@/lib/mockData';
import { fileUrl } from '@/lib/sriClient';

const COLUMNS = ['Tipo', 'Clave de acceso', 'Emisor', 'Fecha emisión', 'Monto', 'XML'];

const TIPO_LABEL = {
  factura: 'Factura',
  retencion: 'Retención',
  nota_credito: 'Nota de crédito',
  nota_debito: 'Nota de débito',
  liquidacion: 'Liquidación',
};

const headSx = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'text.secondary',
  borderBottom: '1px solid',
  borderColor: 'divider',
};

export default function ComprobantesTable({ rows, downloaded, onRowClick }) {
  const downloadedSet = downloaded || new Set();

  return (
    <Card>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'background.default' }}>
              {COLUMNS.map((col) => (
                <TableCell key={col} sx={headSx}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 1, color: 'text.disabled' }}>
                    <ReceiptLongIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                    <Typography variant="body2">
                      Sin comprobantes. Conéctate al SRI y pulsa “Consultar”.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => {
                const isDownloaded = downloadedSet.has(c.claveAcceso);
                return (
                  <TableRow
                    key={c.claveAcceso}
                    onClick={() => onRowClick?.(c)}
                    sx={{ cursor: onRowClick ? 'pointer' : 'default', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <TableCell>
                      <Chip label={TIPO_LABEL[c.tipo] || c.tipo} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }} title={c.claveAcceso}>
                        …{String(c.claveAcceso).slice(-12)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary.main">{c.razonSocialEmisor || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.rucEmisor}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{c.fechaEmision}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700} variant="body2">{fmtMoney(c.montoTotal || 0)}</Typography>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isDownloaded ? (
                        <Tooltip title="Descargar XML">
                          <IconButton size="small" component="a" href={fileUrl(c.claveAcceso, 'xml')} download>
                            <DownloadIcon fontSize="small" color="primary" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
