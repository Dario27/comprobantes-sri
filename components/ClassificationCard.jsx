'use client';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';

const TYPES = [
  { key: 'caja-chica', icon: '💰', name: 'Caja Chica',  desc: 'Gastos menores de operación diaria' },
  { key: 'inventario', icon: '📦', name: 'Inventario',  desc: 'Compra de mercancía o materias primas' },
  { key: 'gastos',     icon: '📋', name: 'Gastos',      desc: 'Servicios, renta u otros egresos' },
];

export default function ClassificationCard({ selected, onSelect }) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.75rem', mb: 2 }}>
          Clasificación de Factura
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {TYPES.map(({ key, icon, name, desc }) => {
            const isSelected = selected === key;
            return (
              <Box
                key={key}
                onClick={() => onSelect(key)}
                sx={{
                  textAlign: 'center',
                  p: 3,
                  borderRadius: 2,
                  cursor: 'pointer',
                  userSelect: 'none',
                  border: '2px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor:     isSelected ? 'primary.light' : 'background.paper',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.light' },
                }}
              >
                <Typography sx={{ fontSize: 28, mb: 0.5 }}>{icon}</Typography>
                <Typography variant="body2" fontWeight={700} color="text.primary">{name}</Typography>
                <Typography variant="caption" color="text.secondary">{desc}</Typography>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
