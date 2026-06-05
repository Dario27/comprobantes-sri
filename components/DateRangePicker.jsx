'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

export default function DateRangePicker({ desde, hasta, onChange }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography
        component="label"
        variant="caption"
        sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'primary.main', letterSpacing: '0.05em' }}
      >
        Rango de Fechas
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          px: 1.5,
          height: 40,
          gap: 1,
          bgcolor: 'background.paper',
          '&:focus-within': { borderColor: 'primary.main' },
        }}
      >
        <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
        <InputBase
          type="date"
          value={desde}
          onChange={(e) => onChange('fechaDesde', e.target.value)}
          sx={{ fontSize: '0.875rem', flex: 1, minWidth: 0 }}
          inputProps={{ 'aria-label': 'Fecha desde' }}
        />
        <Typography variant="body2" color="text.disabled" sx={{ flexShrink: 0 }}>—</Typography>
        <InputBase
          type="date"
          value={hasta}
          onChange={(e) => onChange('fechaHasta', e.target.value)}
          sx={{ fontSize: '0.875rem', flex: 1, minWidth: 0 }}
          inputProps={{ 'aria-label': 'Fecha hasta' }}
        />
      </Box>
    </Box>
  );
}
