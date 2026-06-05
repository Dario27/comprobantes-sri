'use client';
import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import SaveIcon from '@mui/icons-material/Save';
import {
  FORMAS_PAGO, CENTROS_NEGOCIO, CENTROS_COSTOS,
  CUENTAS_CONTABLES, TIPOS_NEGOCIO, RETENCIONES,
  SUSTENTOS_TRIBUTARIOS, RESPONSABLES, CAJAS_CHICAS, CONCEPTOS,
} from '@/lib/mockData';

function RedField({ label, options, value, onChange }) {
  return (
    <TextField
      select fullWidth size="small"
      label={label} value={value} onChange={onChange}
      slotProps={{
        inputLabel: { sx: { color: 'error.main', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' } },
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          '& fieldset':             { borderColor: '#e74c3c', borderWidth: 2 },
          '&:hover fieldset':       { borderColor: '#e74c3c' },
          '&.Mui-focused fieldset': { borderColor: '#e74c3c', boxShadow: '0 0 0 3px rgba(231,76,60,.12)' },
        },
      }}
    >
      <MenuItem value=""><em>— Seleccionar —</em></MenuItem>
      {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
    </TextField>
  );
}

function GreenField({ label, options, value, onChange }) {
  return (
    <TextField
      select fullWidth size="small"
      label={label} value={value} onChange={onChange}
      slotProps={{
        inputLabel: { sx: { color: 'success.main', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' } },
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          '& fieldset':             { borderColor: '#27ae60', borderWidth: 2 },
          '&:hover fieldset':       { borderColor: '#27ae60' },
          '&.Mui-focused fieldset': { borderColor: '#27ae60', boxShadow: '0 0 0 3px rgba(39,174,96,.12)' },
        },
      }}
    >
      <MenuItem value=""><em>— Seleccionar —</em></MenuItem>
      {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
    </TextField>
  );
}

const gridSx = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 };

export default function CatalogsCard({ invoiceType, invoiceId, onSaved }) {
  const isCajaChica = invoiceType === 'caja-chica';

  const [formaPago,          setFormaPago]          = useState('');
  const [centroNegocio,      setCentroNegocio]      = useState('');
  const [centroCosto,        setCentroCosto]        = useState('');
  const [cuentaContable,     setCuentaContable]     = useState('');
  const [tipoNegocio,        setTipoNegocio]        = useState('');
  const [retencion,          setRetencion]          = useState('');
  const [sustentoTributario, setSustentoTributario] = useState('');
  const [responsable,        setResponsable]        = useState('');
  const [cajaChica,          setCajaChica]          = useState('');
  const [concepto,           setConcepto]           = useState('');

  const handleSave = () => {
    if (!invoiceType) { alert('Por favor selecciona un tipo de factura antes de guardar.'); return; }
    const payload = {
      tipo: invoiceType,
      catalogs: {
        formaPago, centroNegocio, centroCosto,
        cuentaContable, tipoNegocio, retencion, sustentoTributario,
        ...(isCajaChica && { responsable, cajaChica, concepto }),
      },
    };
    console.log('Payload a enviar a la API:', payload);
    alert(`Clasificación guardada como: ${invoiceType.toUpperCase().replace('-', ' ')}`);
    if (onSaved) onSaved(payload);
  };

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.75rem', mb: 2 }}>
          Catálogos
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box sx={gridSx}>
          <RedField label="Forma de Pago"       options={FORMAS_PAGO}          value={formaPago}          onChange={(e) => setFormaPago(e.target.value)} />
          <RedField label="Centros de Negocio"  options={CENTROS_NEGOCIO}      value={centroNegocio}      onChange={(e) => setCentroNegocio(e.target.value)} />
          <RedField label="Centros de Costos"   options={CENTROS_COSTOS}       value={centroCosto}        onChange={(e) => setCentroCosto(e.target.value)} />
          <RedField label="Cuentas Contables"   options={CUENTAS_CONTABLES}    value={cuentaContable}     onChange={(e) => setCuentaContable(e.target.value)} />
          <RedField label="Tipo de Negocio"     options={TIPOS_NEGOCIO}        value={tipoNegocio}        onChange={(e) => setTipoNegocio(e.target.value)} />
          <RedField label="Retenciones"         options={RETENCIONES}          value={retencion}          onChange={(e) => setRetencion(e.target.value)} />
          <RedField label="Sustentos Tributarios" options={SUSTENTOS_TRIBUTARIOS} value={sustentoTributario} onChange={(e) => setSustentoTributario(e.target.value)} />
        </Box>

        <Collapse in={isCajaChica} timeout={300}>
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1, height: 1, bgcolor: 'success.main', opacity: 0.3 }} />
              <Typography variant="caption" fontWeight={700} color="success.main"
                sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                Campos de Caja Chica
              </Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: 'success.main', opacity: 0.3 }} />
            </Box>
            <Box sx={gridSx}>
              <GreenField label="Responsable"              options={RESPONSABLES} value={responsable} onChange={(e) => setResponsable(e.target.value)} />
              <GreenField label="Caja Chica"               options={CAJAS_CHICAS} value={cajaChica}   onChange={(e) => setCajaChica(e.target.value)} />
              <GreenField label="Concepto / Cuenta Asociada" options={CONCEPTOS} value={concepto}     onChange={(e) => setConcepto(e.target.value)} />
            </Box>
          </Box>
        </Collapse>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
          <Button variant="contained" size="large" startIcon={<SaveIcon />} onClick={handleSave} disabled={!invoiceType}>
            Guardar Clasificación
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
