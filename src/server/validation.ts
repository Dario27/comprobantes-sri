import { z } from 'zod';

// Login del SRI: dos modos.
//  - Por empresa guardada (Fase 3): el servidor descifra la clave desde la BD.
//  - Manual (Fase 1, fallback): credenciales directas en el body.
export const LoginByCompanyInput = z.object({
  companyId: z.number().int().positive()
});
export const LoginByCredentialsInput = z.object({
  ruc: z.string().regex(/^\d{10,13}$/),
  clave: z.string().min(1),
  cedulaAdicional: z.string().min(1).optional()
});
export const ManualLoginInput = z.union([LoginByCompanyInput, LoginByCredentialsInput]);

export const SessionIdInput = z.object({ sessionId: z.string().min(1) });

export const FiltersInput = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  dia: z.number().int().min(0).max(31).default(0),
  tipoComprobante: z.enum(['factura', 'retencion', 'nota_credito', 'nota_debito', 'liquidacion']),
  rucEmisor: z.string().regex(/^\d{10,13}$/).optional(),
  estado: z.enum(['autorizado', 'todos']).optional()
});

export const ListingInput = SessionIdInput.extend({ filters: FiltersInput });

export const JobCreateInput = ListingInput;

export const HistoryQuery = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
  ruc: z.string().optional(),
  tipo: z.string().optional(),
  companyId: z.coerce.number().int().min(0).optional()
});

// --- Empresas (Fase 3) ---
// RUC de empresa en Ecuador: 13 dígitos terminados en "001".
export const RucEcuador = z.string().regex(/^\d{10}001$/, 'RUC debe tener 13 dígitos y terminar en 001');

export const CompanyEstadoEnum = z.enum(['ACTIVO', 'INACTIVO', 'BLOQUEADA_CAPTCHA']);

export const CompanyCreateBody = z.object({
  nombre: z.string().min(1).max(120),
  ruc: RucEcuador,
  clave: z.string().min(1).max(200),
  estado: CompanyEstadoEnum.default('ACTIVO'),
  rutaDescarga: z.string().min(1).max(500),
  frecuenciaDias: z.number().int().min(1).max(365),
  fechaInicioDescarga: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaInicioDescarga debe ser YYYY-MM-DD'),
  connectionString: z.string().min(1).max(500)
});

export const CompanyUpdateBody = z.object({
  nombre: z.string().min(1).max(120).optional(),
  ruc: RucEcuador.optional(),
  clave: z.string().min(1).max(200).optional(),
  estado: CompanyEstadoEnum.optional(),
  rutaDescarga: z.string().min(1).max(500).optional(),
  frecuenciaDias: z.number().int().min(1).max(365).optional(),
  fechaInicioDescarga: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  connectionString: z.string().min(1).max(500).optional()
});

// --- Ejecuciones / scheduler (Fase 3 B+C) ---
export const JobRunQuery = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['EN_CURSO', 'EXITO', 'FALLO', 'CAPTCHA']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional()
});

export const RunNowBody = z.object({
  companyId: z.number().int().positive()
});

// --- Autenticación del portal (Fase 4) ---
export const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const UserRolEnum = z.enum(['superadmin', 'admin', 'user']);

export const UserCreateBody = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(60, 'El nombre de usuario no puede superar los 60 caracteres'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200, 'La contraseña no puede superar los 200 caracteres'),
  rol: UserRolEnum.default('user'),
  activo: z.boolean().default(true)
});

export const UserUpdateBody = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(60, 'El nombre de usuario no puede superar los 60 caracteres').optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200, 'La contraseña no puede superar los 200 caracteres').optional(),
  rol: UserRolEnum.optional(),
  activo: z.boolean().optional()
});
