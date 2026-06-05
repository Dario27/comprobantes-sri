# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm run dev      # Servidor de desarrollo en http://localhost:3000
npm run build    # Build de producción
npm run start    # Servir el build de producción
npm run lint     # ESLint (eslint-config-next)
```

No hay framework de tests configurado.

Credenciales demo: usuario `admin` / contraseña `1234` (cualquier usuario sirve; solo se valida la contraseña).

## Arquitectura

Portal de gestión de facturas del **Grupo Torres**. Next.js 14 (App Router) + React 18 + Material UI v6 + Tailwind CSS. JavaScript, no TypeScript. Alias de import `@/*` → raíz del proyecto (definido en `jsconfig.json`).

**Estado actual: prototipo front-end sin backend.** Todos los datos provienen de `lib/mockData.js`. Los puntos de integración con API real están marcados con comentarios `// API:` y `// TODO:` por todo el código — buscar esos marcadores antes de conectar endpoints. La tabla de endpoints esperados está en `README.md`.

### Flujos que cruzan varios archivos

- **Autenticación** (`context/AuthContext.jsx`): contexto global con `login`/`logout`/`user`/`loading`. La sesión se persiste en `localStorage` bajo la clave `gt_user` y se restaura al montar. Cada página protegida (`dashboard`, `invoice/[id]`) implementa su propio guard con `useEffect` que redirige a `/login` cuando `!loading && !user`, y renderiza `null` mientras carga. `app/page.jsx` solo redirige a `/login`.

- **Handoff dashboard → detalle**: al hacer click en una fila, `dashboard/page.jsx` guarda la factura seleccionada en `sessionStorage` (`gt_selected_invoice`) y navega a `/invoice/[id]`. La página de detalle lee primero de `sessionStorage` y, si no existe, hace fallback a buscar por `id` en el array `INVOICES`. Al reemplazar por API real, esto pasa a `GET /api/invoices/:id`.

- **Filtrado**: el dashboard filtra del lado del cliente con `useMemo` sobre `INVOICES`. El TODO indica moverlo a query params del servidor.

- **Clasificación de factura** (`invoice/[id]`): tres cards en secuencia — `InvoiceDataCard` (datos), `ClassificationCard` (selector de tipo: `caja-chica` | `inventario` | `gastos`), y `CatalogsCard`. El tipo seleccionado vive en el estado de la página y se pasa a `CatalogsCard`. Los campos verdes de Caja Chica (`Responsable`, `Caja Chica`, `Concepto`) solo aparecen — vía `<Collapse>` — cuando `invoiceType === 'caja-chica'`; los campos rojos siempre están visibles. El guardado hoy solo hace `console.log` + `alert`.

### Convención de UI: MUI + Tailwind coexistiendo

MUI es el sistema de componentes principal; Tailwind se usa solo para utilidades de layout. Esta coexistencia está configurada deliberadamente en `tailwind.config.js`:
- `corePlugins.preflight: false` — desactiva el reset de Tailwind para no pisar los estilos de MUI.
- `important: '#__next'` — fuerza que las utilidades de Tailwind ganen especificidad sobre MUI cuando se usan.

El tema de MUI (`lib/theme.js`) es la fuente de verdad del diseño: paleta, tipografía (`Segoe UI`), bordes redondeados de cards (12px) y overrides globales de `MuiButton`/`MuiCard`/`MuiTable`. Los providers (`AppRouterCacheProvider` de Emotion + `ThemeProvider` + `AuthProvider`) se montan en `app/providers.jsx`, consumido por `app/layout.jsx`.

Convención de colores en `CatalogsCard.jsx`: campos **rojos** (`#e74c3c`, comunes a todos los tipos) vs **verdes** (`#27ae60`, exclusivos de Caja Chica), implementados como los sub-componentes `RedField`/`GreenField`.

Todos los componentes interactivos llevan `'use client'` (App Router con componentes cliente).
