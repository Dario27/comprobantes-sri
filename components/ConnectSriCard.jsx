'use client';
import { useState, useEffect } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useSri } from '@/context/SriContext';
import { listCompanies } from '@/lib/sriClient';

const ERROR_MESSAGES = {
  AUTH_INVALID_CREDENTIALS: 'RUC o clave incorrectos.',
  AUTH_CAPTCHA_REQUIRED: 'El SRI está pidiendo captcha; no es posible conectar automáticamente ahora.',
  AUTH_TIMEOUT: 'El portal del SRI tardó demasiado en responder. Inténtalo de nuevo.',
  COMPANY_NOT_FOUND: 'La empresa seleccionada ya no existe.',
  COMPANY_INACTIVE: 'La empresa está inactiva.',
  DECRYPT_FAILED: 'No se pudo descifrar la clave guardada (¿cambió MASTER_KEY?).',
  // AUTH_UNEXPECTED y AUTH_PORTAL_UNAVAILABLE no se mapean: se muestra el mensaje real del
  // servidor (trae el detalle, p. ej. el fallo al conectar a Chrome en el puerto de depuración).
};

export default function ConnectSriCard() {
  const { session, connecting, connect, disconnect } = useSri();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [manual, setManual] = useState(false);
  const [ruc, setRuc] = useState('');
  const [clave, setClave] = useState('');
  const [cedulaAdicional, setCedulaAdicional] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) return;
    listCompanies()
      .then((d) => {
        const items = d.items || [];
        setCompanies(items);
        if (items.length === 0) setManual(true); // sin empresas guardadas → modo manual
      })
      .catch(() => setManual(true));
  }, [session]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setError('');
    const payload = manual
      ? { ruc, clave, ...(cedulaAdicional ? { cedulaAdicional } : {}) }
      : { companyId: Number(companyId) };
    const result = await connect(payload);
    if (!result.ok) {
      setError(ERROR_MESSAGES[result.code] || result.message || 'No se pudo conectar.');
    } else {
      setClave('');
    }
  };

  if (session) {
    const expira = session.expiresAt ? new Date(session.expiresAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : null;
    const label = session.companyNombre && session.companyId ? session.companyNombre : `RUC ${session.ruc}`;
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CheckCircleIcon sx={{ color: 'success.main' }} />
            <Box>
              <Typography variant="body2" fontWeight={700}>Conectado al SRI</Typography>
              <Typography variant="caption" color="text.secondary">
                {label}{expira ? ` · sesión válida hasta ${expira}` : ''}
              </Typography>
            </Box>
            <Chip size="small" color="success" variant="outlined" label="Activo" sx={{ ml: 1 }} />
          </Box>
          <Button variant="outlined" color="inherit" startIcon={<LinkOffIcon />} onClick={disconnect}>
            Desconectar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canSubmit = manual ? (ruc && clave) : !!companyId;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.75rem', mb: 2 }}>
          Conectar al SRI
        </Typography>
        <Box component="form" onSubmit={handleConnect} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {!manual ? (
            <TextField
              select size="small" label="Empresa" value={companyId}
              onChange={(e) => setCompanyId(e.target.value)} required
              slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 280px' }}
              helperText={companies.length === 0 ? 'No hay empresas guardadas' : ' '}
            >
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id} disabled={c.estado === 'INACTIVO'}>
                  {c.nombre} — {c.ruc}{c.estado !== 'ACTIVO' ? ` (${c.estado})` : ''}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <>
              <TextField size="small" label="RUC" value={ruc} onChange={(e) => setRuc(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 160px' }} />
              <TextField size="small" label="Clave SRI" type="password" value={clave} onChange={(e) => setClave(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 160px' }} />
              <TextField size="small" label="Cédula adicional (opcional)" value={cedulaAdicional} onChange={(e) => setCedulaAdicional(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 160px' }} />
            </>
          )}
          <Button type="submit" variant="contained" disabled={connecting || !canSubmit} startIcon={connecting ? <CircularProgress size={18} color="inherit" /> : <LinkIcon />} sx={{ height: 40 }}>
            {connecting ? 'Conectando…' : 'Conectar'}
          </Button>
        </Box>

        <Box sx={{ mt: 1.5 }}>
          <Link component="button" type="button" variant="caption" onClick={() => { setManual((v) => !v); setError(''); }}>
            {manual ? 'Usar empresa guardada' : 'Conectar manualmente (RUC + clave)'}
          </Link>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </CardContent>
    </Card>
  );
}
