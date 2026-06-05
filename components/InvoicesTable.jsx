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
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { fmtMoney, estadoConfig } from '@/lib/mockData';

const COLUMNS = ['N° Factura', 'Fecha', 'Empresa', 'Proveedor', 'Importe', 'Estado'];

const headSx = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'text.secondary',
  borderBottom: '1px solid',
  borderColor: 'divider',
};

export default function InvoicesTable({ rows, onRowClick }) {
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
                <TableCell colSpan={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 1, color: 'text.disabled' }}>
                    <ReceiptLongIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                    <Typography variant="body2">
                      No se encontraron facturas con los filtros aplicados.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((inv) => {
                const cfg = estadoConfig[inv.estado] || {};
                return (
                  <TableRow
                    key={inv.id}
                    onClick={() => onRowClick(inv)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <TableCell>
                      <Typography fontWeight={700} variant="body2">{inv.numero}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{inv.fecha}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary.main">{inv.empresa}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary.main">{inv.proveedor}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700} variant="body2">
                        {fmtMoney(inv.importe)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={inv.estado}
                        size="small"
                        sx={{
                          bgcolor: cfg.bg,
                          color:   cfg.text,
                          fontWeight: 600,
                          fontSize: '0.72rem',
                        }}
                      />
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
