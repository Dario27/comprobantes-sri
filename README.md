# Portal Comprobantes Recibidos (SRI)

Portal de gestión de facturas construido con **Next.js 14** (App Router), **React 18**, **Tailwind CSS** y **Material UI v6**.

## Requisitos

- Node.js 18+
- npm 9+

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

**Credenciales demo:** usuario `admin` / contraseña `admin`

## Estructura del proyecto

```
grupo-torres-portal/
├── app/
│   ├── layout.jsx              # Root layout con providers
│   ├── providers.jsx           # MUI ThemeProvider + AuthProvider
│   ├── page.jsx                # Redirect → /login
│   ├── login/page.jsx          # Página de login
│   ├── dashboard/page.jsx      # Listado de facturas con filtros
│   └── invoice/[id]/page.jsx   # Detalle y clasificación de factura
├── components/
│   ├── Topbar.jsx              # Barra de navegación superior
│   ├── FiltersCard.jsx         # Card con filtros del dashboard
│   ├── InvoicesTable.jsx       # Tabla de facturas
│   ├── InvoiceDataCard.jsx     # Datos principales de la factura
│   ├── ClassificationCard.jsx  # Selector de tipo (Caja Chica / Inventario / Gastos)
│   └── CatalogsCard.jsx        # Dropdowns rojos + verdes condicionales
├── context/
│   └── AuthContext.jsx         # Contexto de autenticación
├── lib/
│   ├── mockData.js             # Datos de ejemplo y catálogos
│   └── theme.js                # Tema personalizado de MUI
└── styles/
    └── globals.css             # Tailwind + estilos globales
```

## Integración con APIs reales

Busca los comentarios `// API:` en el código para encontrar todos los puntos de integración:

| Archivo | Endpoint a conectar |
|---------|---------------------|
| `context/AuthContext.jsx` | `POST /api/auth/login` |
| `app/dashboard/page.jsx` | `GET /api/invoices` (con query params para filtros) |
| `app/invoice/[id]/page.jsx` | `GET /api/invoices/:id` |
| `components/CatalogsCard.jsx` | `POST /api/invoices/:id/classify` |
| `components/FiltersCard.jsx` | `GET /api/companies`, `GET /api/catalogs/*` |

## Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 14 | Framework + App Router + SSR |
| React | 18 | UI Library |
| Material UI | 6 | Componentes de interfaz |
| Tailwind CSS | 3 | Utilidades de layout y espaciado |
| Emotion | 11 | CSS-in-JS (requerido por MUI) |
