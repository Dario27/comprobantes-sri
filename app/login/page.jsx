'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, loading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    // API: POST /api/auth/login  { username, password }
    const result = await login(username, password);

    setBusy(false);
    if (result.ok) {
      router.push('/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440, borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <CardContent sx={{ p: 5 }}>

          {/* Logo */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px', mb: 2, width: 70, height: 70, bgcolor: 'primary.main' }}
            >
              <DescriptionOutlinedIcon sx={{ color: 'white', fontSize: 34 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
              Grupo Torres
            </Typography>
            <Typography variant="body2" color="primary.main">
              Portal de Gestión de Facturas
            </Typography>
          </Box>

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Usuario"
              placeholder="usuario@grupotorres.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              fullWidth
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={busy}
              sx={{ py: 1.5, mt: 0.5 }}
            >
              {busy ? <CircularProgress size={22} color="inherit" /> : 'Iniciar Sesión'}
            </Button>
          </Box>

        </CardContent>
      </Card>
    </Box>
  );
}
