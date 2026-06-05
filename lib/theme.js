'use client';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main:  '#1a56db',
      dark:  '#1341b0',
      light: '#e8f0fe',
      contrastText: '#ffffff',
    },
    error: {
      main: '#e74c3c',
    },
    success: {
      main: '#27ae60',
    },
    warning: {
      main: '#f39c12',
    },
    background: {
      default: '#f1f5f9',
      paper:   '#ffffff',
    },
    text: {
      primary:   '#1e293b',
      secondary: '#64748b',
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 700, letterSpacing: '0.04em' },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.72rem',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#f1f5f9',
            color: '#64748b',
            fontWeight: 700,
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#e8f0fe',
            cursor: 'pointer',
          },
          '&:last-child td': {
            borderBottom: 0,
          },
        },
      },
    },
  },
});

export default theme;
