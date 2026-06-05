'use client';
import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
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
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AppShell from '@/components/AppShell';
import { listUsuarios, createUsuario, updateUsuario, deleteUsuario } from '@/lib/adminClient';
import { useAuth } from '@/context/AuthContext';

const ROLES = ['superadmin', 'admin', 'user'];
const rolColor = { superadmin: 'primary', admin: 'info', user: 'default' };

const EMPTY = { username: '', password: '', rol: 'user', activo: true };

const headSx = { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary' };

export default function UsuariosPage() {
  const { user: sesion } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await listUsuarios();
      setUsuarios(d.items || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los usuarios.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ username: u.username, password: '', rol: u.rol, activo: u.activo });
    setFormError('');
    setDialogOpen(true);
  };

  const handleField = (field) => (e) => {
    const v = field === 'activo' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: v }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const body = { username: form.username, rol: form.rol, activo: form.activo };
        if (form.password) body.password = form.password;
        await updateUsuario(editing.id, body);
      } else {
        await createUsuario(form);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`¿Eliminar el usuario "${u.username}"?`)) return;
    try {
      await deleteUsuario(u.id);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar.');
    }
  };

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString('es-EC') : '—');

  return (
    <AppShell>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, ml: '4.5%', width: '85%' }}>
        <Typography variant="h5" fontWeight={700}>Gestión de usuarios</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Nuevo usuario</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ml: '4.5%', width: '85%'}}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                {['Usuario', 'Rol', 'Activo', 'Creado', ''].map((h) => (
                  <TableCell key={h} sx={headSx}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: 'center' }}>
                      No hay usuarios registrados.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : usuarios.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{u.username}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={u.rol} color={rolColor[u.rol] || 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={u.activo ? 'Activo' : 'Inactivo'} color={u.activo ? 'success' : 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{fmt(u.createdAt)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(u)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <Tooltip title={sesion?.username === u.username ? 'No puedes eliminar tu propio usuario' : 'Eliminar'}>
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={sesion?.username === u.username}
                          onClick={() => handleDelete(u)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? `Editar ${editing.username}` : 'Nuevo usuario'}</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Nombre de usuario"
              value={form.username}
              onChange={handleField('username')}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label={editing ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña'}
              type="password"
              value={form.password}
              onChange={handleField('password')}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              select
              label="Rol"
              value={form.rol}
              onChange={handleField('rol')}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            >
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <FormControlLabel
              control={<Switch checked={form.activo} onChange={handleField('activo')} color="success" />}
              label="Activo"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
