// ============================================================
// MOCK DATA — replace with real API calls:
//   GET /api/invoices
//   GET /api/companies
//   GET /api/catalogs/:type
// ============================================================

export const INVOICES = [
  {
    id: 1,
    numero:    'FAC-0001',
    fecha:     '2026-03-10',
    empresa:   'Zapin',
    proveedor: 'Distribuidora Alfa S.A.',
    importe:   12450.00,
    estado:    'Pendiente',
  },
  {
    id: 2,
    numero:    'FAC-0002',
    fecha:     '2026-03-15',
    empresa:   'Torres',
    proveedor: 'Servicios Beta Ltda.',
    importe:   8900.50,
    estado:    'Aprobada',
  },
  {
    id: 3,
    numero:    'FAC-0003',
    fecha:     '2026-04-02',
    empresa:   "D'Pisar",
    proveedor: 'Construcciones Gamma',
    importe:   54300.00,
    estado:    'Pagada',
  },
  {
    id: 4,
    numero:    'FAC-0004',
    fecha:     '2026-04-18',
    empresa:   'Zapin',
    proveedor: 'Suministros Delta',
    importe:   3200.75,
    estado:    'Rechazada',
  },
  {
    id: 5,
    numero:    'FAC-0005',
    fecha:     '2026-05-01',
    empresa:   'Torres',
    proveedor: 'TechSoluciones MX',
    importe:   22750.00,
    estado:    'Pendiente',
  },
  {
    id: 6,
    numero:    'FAC-0006',
    fecha:     '2026-05-12',
    empresa:   "D'Pisar",
    proveedor: 'Ferretería Épsilon',
    importe:   6100.00,
    estado:    'Aprobada',
  },
];

// API: GET /api/companies
export const COMPANIES = ['Zapin', 'Torres', "D'Pisar"];

// API: GET /api/catalogs/formas-pago
export const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta'];

// API: GET /api/catalogs/centros-negocio
export const CENTROS_NEGOCIO = [
  'PPD - Pago en parcialidades',
  'PUE - Pago en una sola exhibición',
];

// API: GET /api/catalogs/centros-costos
export const CENTROS_COSTOS = [
  'CC-001 Administración',
  'CC-002 Ventas',
  'CC-003 Operaciones',
  'CC-004 Logística',
];

// API: GET /api/catalogs/cuentas-contables
export const CUENTAS_CONTABLES = [
  '1110 – Caja',
  '1120 – Bancos',
  '2110 – Proveedores',
  '5010 – Compras',
  '6010 – Gastos Generales',
];

// API: GET /api/catalogs/tipos-negocio
export const TIPOS_NEGOCIO = ['Comercial', 'Industrial', 'Servicios', 'Mixto'];

// API: GET /api/catalogs/retenciones
export const RETENCIONES = [
  'Sin retención',
  'ISR 10%',
  'IVA 6%',
  'ISR + IVA',
];

// API: GET /api/catalogs/sustentos-tributarios
export const SUSTENTOS_TRIBUTARIOS = [
  '01 – Crédito tributario',
  '02 – Sustento de costos/gastos',
  '03 – Activos fijos',
  '04 – No aplica',
];

// API: GET /api/catalogs/responsables  (Caja Chica only)
export const RESPONSABLES = [
  'Ana García',
  'Luis Martínez',
  'María López',
  'Carlos Rodríguez',
];

// API: GET /api/catalogs/cajas-chicas  (Caja Chica only)
export const CAJAS_CHICAS = [
  'CC-ZAPIN-001',
  'CC-TORRES-001',
  'CC-DPISAR-001',
];

// API: GET /api/catalogs/conceptos  (Caja Chica only)
export const CONCEPTOS = [
  'Papelería y útiles',
  'Viáticos',
  'Combustible',
  'Mantenimiento menor',
  'Cafetería / Alimentos',
];

// Helper: badge color by status
export const estadoConfig = {
  Pendiente:  { color: 'warning',  bg: '#fef9c3', text: '#854d0e' },
  Aprobada:   { color: 'success',  bg: '#dcfce7', text: '#166534' },
  Rechazada:  { color: 'error',    bg: '#fee2e2', text: '#991b1b' },
  Pagada:     { color: 'primary',  bg: '#dbeafe', text: '#1e40af' },
};

export function fmtMoney(n) {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
