'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import AppShell from '@/components/AppShell';
import { listJobRuns } from '@/lib/adminClient';

const estadoColor = { EN_CURSO: 'info', EXITO: 'success', FALLO: 'error', CAPTCHA: 'warning' };
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('es-EC') : '—');

const INIT_FILTERS = {
  companyId: '', modo: '', estado: '',
  from: '', to: '', conDescargas: false, conFallidos: false,
};

const headSx = {
  fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
  color: 'text.secondary', letterSpacing: '0.05em',
};

export default function EjecucionesPage() {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INIT_FILTERS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = await listJobRuns({ limit: 1000 });
      setRuns(d.items || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las ejecuciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => { setPage(0); }, [filters]);

  const setFilter = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(INIT_FILTERS);
  }, []);

  const hasActiveFilters = useMemo(() =>
    filters.companyId !== '' || filters.modo !== '' || filters.estado !== '' ||
    filters.from !== '' || filters.to !== '' || filters.conDescargas || filters.conFallidos,
    [filters]
  );

  // Opciones de empresa derivadas de los propios runs (sin fetch extra)
  const companyOptions = useMemo(() => {
    const map = new Map();
    for (const r of runs) {
      if (!map.has(r.companyId)) map.set(r.companyId, r.companyNombre);
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [runs]);

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (filters.companyId && r.companyId !== Number(filters.companyId)) return false;
      if (filters.modo && r.modo !== filters.modo) return false;
      if (filters.estado && r.estado !== filters.estado) return false;
      if (filters.from && r.startedAt < filters.from) return false;
      // "to" inclusivo: tomamos hasta fin del día agregando T23:59:59
      if (filters.to && r.startedAt > filters.to + 'T23:59:59') return false;
      if (filters.conDescargas && r.comprobantesDescargados <= 0) return false;
      if (filters.conFallidos && r.comprobantesFallidos <= 0) return false;
      return true;
    });
  }, [runs, filters]);

  const paged = useMemo(() =>
    filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filtered, page, rowsPerPage]
  );

  const emptyText = hasActiveFilters
    ? 'Sin ejecuciones que coincidan con los filtros.'
    : 'Sin ejecuciones registradas.';

  return (
    <AppShell>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Ejecuciones del Job</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Refrescar
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Barra de filtros */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: 2,
          alignItems: 'flex-end',
        }}>
          {/* Empresa */}
          <TextField
            select label="Empresa" size="small" value={filters.companyId}
            onChange={(e) => setFilter('companyId', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          >
            <MenuItem value=""><em>Todas</em></MenuItem>
            {companyOptions.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
            ))}
          </TextField>

          {/* Modo */}
          <TextField
            select label="Modo" size="small" value={filters.modo}
            onChange={(e) => setFilter('modo', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          >
            <MenuItem value=""><em>Todos</em></MenuItem>
            <MenuItem value="AUTOMATICO">Automático</MenuItem>
            <MenuItem value="MANUAL">Manual</MenuItem>
          </TextField>

          {/* Estado */}
          <TextField
            select label="Estado" size="small" value={filters.estado}
            onChange={(e) => setFilter('estado', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          >
            <MenuItem value=""><em>Todos</em></MenuItem>
            <MenuItem value="EN_CURSO">En curso</MenuItem>
            <MenuItem value="EXITO">Éxito</MenuItem>
            <MenuItem value="FALLO">Fallo</MenuItem>
            <MenuItem value="CAPTCHA">Captcha</MenuItem>
          </TextField>

          {/* Desde */}
          <TextField
            type="date" label="Desde" size="small" value={filters.from}
            onChange={(e) => setFilter('from', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {/* Hasta */}
          <TextField
            type="date" label="Hasta" size="small" value={filters.to}
            onChange={(e) => setFilter('to', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        {/* Toggles y acciones */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
          <Chip
            label="Solo con descargas"
            size="small"
            color={filters.conDescargas ? 'success' : 'default'}
            variant={filters.conDescargas ? 'filled' : 'outlined'}
            onClick={() => setFilter('conDescargas', !filters.conDescargas)}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          />
          <Chip
            label="Solo con fallidos"
            size="small"
            color={filters.conFallidos ? 'error' : 'default'}
            variant={filters.conFallidos ? 'filled' : 'outlined'}
            onClick={() => setFilter('conFallidos', !filters.conFallidos)}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          />

          {hasActiveFilters && (
            <Button
              size="small" variant="outlined" color="inherit"
              startIcon={<FilterAltOffIcon />}
              onClick={resetFilters}
              sx={{ ml: 'auto', color: 'text.secondary', borderColor: 'divider' }}
            >
              Limpiar
            </Button>
          )}

          <Typography
            variant="caption" color="text.secondary"
            sx={{ ml: hasActiveFilters ? 0 : 'auto' }}
          >
            {loading ? 'Cargando…' : `Mostrando ${filtered.length} de ${runs.length} ejecución${runs.length !== 1 ? 'es' : ''}`}
          </Typography>
        </Box>
      </Card>

      {/* Tabla */}
      <Card>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {!loading && (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.default' }}>
                    {['Empresa', 'Modo', 'Estado', 'Rango', 'Inicio', 'Fin', 'Descargados', 'Fallidos', 'Mensaje'].map((h) => (
                      <TableCell key={h} sx={headSx}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: 'center' }}>
                          {emptyText}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : paged.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{r.companyNombre}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{r.modo}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={estadoColor[r.estado] || 'default'} label={r.estado} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{r.rangoDesde} → {r.rangoHasta}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{fmt(r.startedAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{fmt(r.endedAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="success.main">
                          {r.comprobantesDescargados}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={r.comprobantesFallidos > 0 ? 'error.main' : 'text.secondary'}>
                          {r.comprobantesFallidos}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                          {r.errorMensaje || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider />

            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="Filas por página"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </>
        )}
      </Card>
    </AppShell>
  );
}
