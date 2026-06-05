'use client';
import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AppShell from '@/components/AppShell';
import {
  listCompaniesAdmin, createCompany, updateCompany, deleteCompany, runNow,
} from '@/lib/adminClient';

const ESTADOS = ['ACTIVO', 'INACTIVO', 'BLOQUEADA_CAPTCHA'];
const estadoColor = { ACTIVO: 'success', INACTIVO: 'default', BLOQUEADA_CAPTCHA: 'warning' };

const today = new Date().toISOString().slice(0, 10);
const EMPTY = { nombre: '', ruc: '', clave: '', estado: 'ACTIVO', rutaDescarga: './downloads', frecuenciaDias: 30, fechaInicioDescarga: today, connectionString: '' };

export default function EmpresasPage() {
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [runningId, setRunningId] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await listCompaniesAdmin();
      setCompanies(d.items || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las empresas.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError(''); setDialogOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      nombre: c.nombre, ruc: c.ruc, clave: '', estado: c.estado,
      rutaDescarga: c.rutaDescarga, frecuenciaDias: c.frecuenciaDias,
      fechaInicioDescarga: c.fechaInicioDescarga,
      connectionString: c.connectionString || '',
    });
    setFormError(''); setDialogOpen(true);
  };

  const handleField = (field) => (e) => {
    const v = field === 'frecuenciaDias' ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [field]: v }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const body = { ...form };
        if (!body.clave) delete body.clave;
        await updateCompany(editing.id, body);
      } else {
        await createCompany(form);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`¿Eliminar la empresa "${c.nombre}"? Se eliminarán también sus comprobantes y ejecuciones asociadas.`)) return;
    try {
      await deleteCompany(c.id);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar.');
    }
  };

  const handleRunNow = async (c) => {
    if (!window.confirm(`¿Ejecutar la descarga ahora para "${c.nombre}"? Puede tardar varios minutos.`)) return;
    setRunningId(c.id);
    setNotice(''); setError('');
    try {
      const r = await runNow(c.id);
      setNotice(`Ejecución de "${c.nombre}": ${r.estado} — ${r.descargados} descargado(s), ${r.fallidos} fallido(s).${r.mensaje ? ` ${r.mensaje}` : ''}`);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo ejecutar la descarga.');
    } finally {
      setRunningId(null);
    }
  };

  return (
    <AppShell>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Listado de empresas</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Crear empresa</Button>
      </Box>

      {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                {['Nombre', 'RUC', 'Estado', 'Frecuencia', 'Última ejecución', ''].map((h) => (
                  <TableCell key={h} sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: 'center' }}>No hay empresas. Crea la primera con “Crear empresa”.</Typography></TableCell></TableRow>
              ) : companies.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography variant="body2" fontWeight={700}>{c.nombre}</Typography></TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{c.ruc}</Typography></TableCell>
                  <TableCell><Chip size="small" color={estadoColor[c.estado]} label={c.estado} variant="outlined" /></TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">cada {c.frecuenciaDias} día(s)</Typography></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{c.ultimaEjecucionExitosa ? new Date(c.ultimaEjecucionExitosa).toLocaleString('es-EC') : '—'}</Typography></TableCell>
                  <TableCell align="right">
                    <Tooltip title="Ejecutar descarga ahora">
                      <span>
                        <IconButton size="small" color="primary" disabled={runningId !== null} onClick={() => handleRunNow(c)}>
                          {runningId === c.id ? <CircularProgress size={18} /> : <PlayArrowIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <IconButton size="small" onClick={() => openEdit(c)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(c)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? `Editar ${editing.nombre}` : 'Nueva empresa'}</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField label="Nombre" value={form.nombre} onChange={handleField('nombre')} size="small" sx={{ gridColumn: 'span 2' }} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="RUC (13 dígitos, termina en 001)" value={form.ruc} onChange={handleField('ruc')} size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label={editing ? 'Clave SRI (vacío = no cambiar)' : 'Clave SRI'} type="password" value={form.clave} onChange={handleField('clave')} size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField select label="Estado" value={form.estado} onChange={handleField('estado')} size="small" slotProps={{ inputLabel: { shrink: true } }}>
              {ESTADOS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <TextField label="Frecuencia (días)" type="number" value={form.frecuenciaDias} onChange={handleField('frecuenciaDias')} size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 1, max: 365 } }} />
            <TextField label="Ruta de descarga" value={form.rutaDescarga} onChange={handleField('rutaDescarga')} size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Fecha inicio descarga" type="date" value={form.fechaInicioDescarga} onChange={handleField('fechaInicioDescarga')} size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField
              label="Connection String"
              value={form.connectionString}
              onChange={handleField('connectionString')}
              size="small"
              sx={{ gridColumn: 'span 2' }}
              slotProps={{ inputLabel: { shrink: true } }}
              placeholder="Server=...;Database=...;User Id=...;Password=...;"
              helperText="Cadena de conexión del sistema multi-tenant."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
