'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuIcon from '@mui/icons-material/Menu';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import BusinessIcon from '@mui/icons-material/Business';
import ListAltIcon from '@mui/icons-material/ListAlt';
import HistoryIcon from '@mui/icons-material/History';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import LogoutIcon from '@mui/icons-material/Logout';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import Chip from '@mui/material/Chip';
import { useAuth } from '@/context/AuthContext';

const DRAWER_WIDTH = 290;

const SIDEBAR_BG = '#0f1b2d';
const SIDEBAR_FG = 'rgba(255,255,255,0.82)';
const SIDEBAR_ACTIVE_BG = 'rgba(88,136,241,0.18)';
const SIDEBAR_ACTIVE_FG = '#ffffff';

const ADMIN_CHILDREN = [
  { label: 'Empresas', href: '/empresas', icon: <ListAltIcon fontSize="small" /> },
  { label: 'Descarga manual', href: '/descarga', icon: <CloudDownloadIcon fontSize="small" /> },
];

const AUDITORIA_CHILDREN = [
  { label: 'Logs', href: '/auditoria/logs', icon: <AssignmentIcon fontSize="small" /> },
];

export default function AppShell({ children, title = 'Portal Comprobantes Recibidos' }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(
    ADMIN_CHILDREN.some((c) => pathname.startsWith(c.href))
  );
  const [auditoriaOpen, setAuditoriaOpen] = useState(
    AUDITORIA_CHILDREN.some((c) => pathname.startsWith(c.href))
  );

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Cerrar el drawer móvil al navegar.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const go = (href) => router.push(href);

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  const itemSx = (active) => ({
    borderRadius: 1.5,
    mx: 1,
    color: active ? SIDEBAR_ACTIVE_FG : SIDEBAR_FG,
    bgcolor: active ? SIDEBAR_ACTIVE_BG : 'transparent',
    '&:hover': { bgcolor: active ? SIDEBAR_ACTIVE_BG : 'rgba(255,255,255,0.06)' },
    '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 38 },
  });

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: SIDEBAR_BG, color: SIDEBAR_FG }}>
      {/* Toolbar superior con el título */}
      <Toolbar sx={{ px: 2, gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: 34, height: 34, bgcolor: 'primary.main', flexShrink: 0 }}>
          <DescriptionOutlinedIcon sx={{ color: 'white', fontSize: 20 }} />
        </Box>
        <Typography variant="subtitle1" fontWeight={800} color="#fff" sx={{ lineHeight: 1.15 }}>
          {title}
        </Typography>
      </Toolbar>

      {/* Navegación */}
      <List sx={{ flexGrow: 1, py: 1 }}>

        {/* Dashboard: todos los roles */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton sx={itemSx(isActive('/dashboard'))} onClick={() => go('/dashboard')}>
            <ListItemIcon><InboxIcon /></ListItemIcon>
            <ListItemText primary="Bandeja de trabajo" primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
          </ListItemButton>
        </ListItem>

        {/* Ejecuciones: user, admin y superadmin */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton sx={itemSx(isActive('/ejecuciones'))} onClick={() => go('/ejecuciones')}>
            <ListItemIcon><HistoryIcon /></ListItemIcon>
            <ListItemText primary="Ejecuciones del Job" primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
          </ListItemButton>
        </ListItem>

        {/* Administración: admin y superadmin */}
        {['admin', 'superadmin'].includes(user?.rol) && (
          <>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton sx={itemSx(false)} onClick={() => setAdminOpen((v) => !v)}>
                <ListItemIcon><BusinessIcon /></ListItemIcon>
                <ListItemText primary="Administración" primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                {adminOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </ListItem>
            <Collapse in={adminOpen} timeout="auto" unmountOnExit>
              <List disablePadding>
                {ADMIN_CHILDREN.map((c) => (
                  <ListItem key={c.href} disablePadding sx={{ mb: 0.25 }}>
                    <ListItemButton sx={{ ...itemSx(isActive(c.href)), pl: 4 }} onClick={() => go(c.href)}>
                      <ListItemIcon>{c.icon}</ListItemIcon>
                      <ListItemText primary={c.label} primaryTypographyProps={{ fontSize: 13.5 }} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </>
        )}

        {/* Auditoría: admin y superadmin */}
        {['admin', 'superadmin'].includes(user?.rol) && (
          <>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton sx={itemSx(false)} onClick={() => setAuditoriaOpen((v) => !v)}>
                <ListItemIcon><AssignmentIcon /></ListItemIcon>
                <ListItemText primary="Auditoría" primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                {auditoriaOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </ListItem>
            <Collapse in={auditoriaOpen} timeout="auto" unmountOnExit>
              <List disablePadding>
                {AUDITORIA_CHILDREN.map((c) => (
                  <ListItem key={c.href} disablePadding sx={{ mb: 0.25 }}>
                    <ListItemButton sx={{ ...itemSx(isActive(c.href)), pl: 4 }} onClick={() => go(c.href)}>
                      <ListItemIcon>{c.icon}</ListItemIcon>
                      <ListItemText primary={c.label} primaryTypographyProps={{ fontSize: 13.5 }} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </>
        )}

        {/* Usuarios: solo superadmin */}
        {user?.rol === 'superadmin' && (
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton sx={itemSx(isActive('/usuarios'))} onClick={() => go('/usuarios')}>
              <ListItemIcon><PeopleIcon /></ListItemIcon>
              <ListItemText primary="Usuarios" primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        )}
      </List>

      {/* Footer: usuario + salir */}
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ overflow: 'hidden' }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.username || '—'}
          </Typography>
          {user?.rol && (
            <Chip
              label={user.rol}
              size="small"
              sx={{
                mt: 0.5, height: 18, fontSize: '0.65rem', fontWeight: 700,
                bgcolor: user.rol === 'superadmin' ? 'primary.main' : user.rol === 'admin' ? 'rgba(88,136,241,0.35)' : 'rgba(255,255,255,0.12)',
                color: '#fff',
              }}
            />
          )}
        </Box>
        <Tooltip title="Cerrar sesión">
          <IconButton onClick={() => { logout(); router.push('/login'); }} sx={{ color: SIDEBAR_FG }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  if (loading || !user) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* AppBar solo en móvil para abrir el drawer */}
      <AppBar position="fixed" elevation={0}
        sx={{ display: { md: 'none' }, bgcolor: SIDEBAR_BG, zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} noWrap>{title}</Typography>
        </Toolbar>
      </AppBar>

      {/* Drawers */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent" open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              border: 'none',
              bgcolor: SIDEBAR_BG,
              // Solo esquinas derechas redondeadas; el lado izquierdo queda pegado al borde.
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              overflow: 'hidden',
            },
          }}>
          {drawer}
        </Drawer>
      </Box>

      {/* Contenido */}
      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
        <Toolbar sx={{ display: { md: 'none' } }} />
        {children}
      </Box>
    </Box>
  );
}
