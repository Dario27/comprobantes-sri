'use client';
import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Box from '@mui/material/Box';
import TuneIcon from '@mui/icons-material/Tune';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { COMPANIES } from '@/lib/mockData';
import DateRangePicker from '@/components/DateRangePicker';

const rowSx = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 };
const fieldSx = {};

export default function FiltersCard({ filters, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (field) => (e) => {
    onChange({ ...filters, [field]: e.target.value });
  };

  const handleDateChange = (field, value) => {
    onChange({ ...filters, [field]: value });
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.75rem' }}>
            Filtros
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={showAdvanced ? <KeyboardArrowUpIcon /> : <TuneIcon />}
            onClick={() => setShowAdvanced((v) => !v)}
            sx={{ fontSize: '0.75rem', minWidth: 160 }}
          >
            Filtros avanzados
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={rowSx}>
          <Box sx={fieldSx}>
            <TextField
              select
              fullWidth
              size="small"
              label="Empresa"
              value={filters.empresa}
              onChange={handleChange('empresa')}
              slotProps={{ inputLabel: { shrink: true } }}
            >
              <MenuItem value="">Todas las empresas</MenuItem>
              {COMPANIES.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={fieldSx}>
            <TextField
              fullWidth
              size="small"
              label="Número de Factura"
              placeholder="Ej. FAC-0001"
              value={filters.numero}
              onChange={handleChange('numero')}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </Box>

        <Collapse in={showAdvanced}>
          <Box sx={{ ...rowSx, mt: 2 }}>
            <Box sx={{ ...fieldSx, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'primary.main', letterSpacing: '0.05em' }}>
                Proveedor
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Nombre del proveedor"
                value={filters.proveedor}
                onChange={handleChange('proveedor')}
              />
            </Box>

            <Box sx={fieldSx}>
              <DateRangePicker
                desde={filters.fechaDesde}
                hasta={filters.fechaHasta}
                onChange={handleDateChange}
              />
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
