# Design: Wind Blade Inspection

## 1. Visión General de la Arquitectura

La aplicación sigue una arquitectura **SPA (Single Page Application)** con separación clara entre frontend y backend-as-a-service:

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                       │
│  Vite + React 19 + TypeScript + React Router 7            │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │   Pages    │  │  Components  │  │   State Layer    │ │
│  │ (lazy)     │  │ (atoms/mol/  │  │ Zustand (auth)   │ │
│  │            │  │  organisms)  │  │ React Query (srv)│ │
│  └─────┬──────┘  └──────┬───────┘  └────────┬─────────┘ │
│        │                 │                    │           │
│  ┌─────▼─────────────────▼────────────────────▼─────────┐│
│  │              Services Layer (src/services/)           ││
│  │  auth · assets · inspections · evidence · defects    ││
│  │  inspection-transitions · dashboard · reports · hist ││
│  └─────────────────────────┬────────────────────────────┘│
└────────────────────────────┼─────────────────────────────┘
                             │ HTTPS (supabase-js SDK)
┌────────────────────────────▼─────────────────────────────┐
│                  Supabase (Backend)                        │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │  Postgres  │  │  Auth    │  │  Edge Functions      │ │
│  │  + RLS     │  │  (JWT)   │  │  complete-inspection │ │
│  │            │  │          │  │  approve-inspection  │ │
│  │            │  │          │  │  dashboard-aggregate │ │
│  │            │  │          │  │  generate-report     │ │
│  │            │  │          │  │  generate-consol..   │ │
│  └────────────┘  └──────────┘  └──────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Storage: buckets "evidence" + "reports" (private) │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Build | Vite 8 | Bundler, HMR, path aliases |
| UI | React 19 + TypeScript 6 | Librería de UI |
| Routing | React Router 7 | SPA routing con lazy loading |
| Server State | TanStack React Query 5 | Cache, fetching, optimistic updates |
| Client State | Zustand 5 | Estado de autenticación y sesión |
| Validación | Zod 3 | Schemas de validación client-side |
| Gráficos | Recharts 2 | Visualización de datos del dashboard |
| Iconos | Lucide React | Iconografía consistente |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) | BaaS completo |
| Testing | Vitest + fast-check + Testing Library | Unit, property, integration |
| Deploy | Vercel (frontend) + Supabase Cloud (backend) | Hosting |

---

## 3. Modelo de Datos

### 3.1 Diagrama Entidad-Relación

```
profiles (1) ──── (N) inspection
    │                      │
    │                      ├──── (N) evidence
    │                      │           │
    │                      │           │ (M:N via defect_image)
    │                      │           │
    │                      └──── (N) defect
    │
wind_farm (1) ──── (N) turbine (1) ──── (3) blade (1) ──── (N) inspection
                                                                    │
report ◄──── reference_id (inspection.id o wind_farm.id)            │
```

### 3.2 Tablas Principales

| Tabla | PK | Relaciones | Constraints Clave |
|-------|-----|------------|-------------------|
| `profiles` | `id` (UUID, FK → auth.users) | — | `role` ∈ {inspector, supervisor, admin}; email UNIQUE |
| `wind_farm` | `id` (UUID) | — | `name` UNIQUE |
| `turbine` | `id` (UUID) | FK → wind_farm (RESTRICT) | — |
| `blade` | `id` (UUID) | FK → turbine (RESTRICT) | `position` ∈ [1,3]; UNIQUE(turbine_id, position) |
| `inspection` | `id` (UUID) | FK → blade (RESTRICT), FK → profiles (inspector, approved_by) | `status` ∈ {in_progress, completed, approved}; `stage` ∈ {to_plan, planned, uploaded, annotated, analyzed, finalized} |
| `evidence` | `id` (UUID) | FK → inspection (CASCADE) | `mime_type` ∈ {image/jpeg, image/png}; `size_bytes` ≤ 20MB |
| `defect` | `id` (UUID) | FK → inspection (CASCADE) | `type` ∈ 7 categorías; `severity` ∈ [1,5]; `distance_from_root` ≥ 0 |
| `defect_image` | `(defect_id, evidence_id)` | FK → defect (CASCADE), FK → evidence (CASCADE) | Junction table M:N |
| `report` | `id` (UUID) | FK → profiles (generated_by) | `type` ∈ {inspection, consolidated}; `reference_id` es polimórfico |

### 3.3 Triggers de Base de Datos

| Trigger | Tabla | Comportamiento |
|---------|-------|---------------|
| `on_turbine_created` | turbine | Inserta 3 blades (posiciones 1,2,3) automáticamente |
| `on_auth_user_created` | auth.users | Crea perfil en `profiles` con datos del registro |
| `set_updated_at` | profiles, wind_farm, turbine, blade, inspection, defect | Actualiza `updated_at` en cada UPDATE |

### 3.4 Función Auxiliar

- `get_user_role()` — Retorna el rol del usuario autenticado actual. Usado por las políticas RLS.

---

## 4. Autenticación y Autorización

### 4.1 Flujo de Autenticación

```
Usuario → Login Page → Supabase Auth (email/password)
                              │
                     ┌────────▼────────┐
                     │ JWT generado     │
                     │ Session stored   │
                     └────────┬────────┘
                              │
              ┌───────────────▼───────────────┐
              │ AuthGuard verifica sesión      │
              │ → Redirecciona si no autenticado│
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │ useAuth hook expone:          │
              │  user, session, login, logout │
              │  + inactivity detection       │
              └───────────────────────────────┘
```

### 4.2 Gestión de Estado de Sesión

- **Zustand Store** (`authStore.ts`): mantiene `user`, `session`, `isLoading`, `lastActivity`.
- **Inactividad**: se registra actividad en cada interacción. Si `Date.now() - lastActivity ≥ 30min`, se cierra sesión automáticamente.
- **Auto-refresh**: Supabase JS SDK maneja transparentemente el refresh del JWT.

### 4.3 Matriz de Permisos (RBAC)

| Acción | Inspector | Supervisor | Admin |
|--------|-----------|------------|-------|
| Ver activos, inspecciones, reportes | ✓ | ✓ | ✓ |
| Crear/editar/eliminar wind farms y turbines | ✗ | ✓ | ✓ |
| Crear inspección | ✓ | ✓ | ✓ |
| Completar inspección propia | ✓ | ✗ | ✗ |
| Aprobar inspección | ✗ | ✓ | ✓ |
| Subir/eliminar evidencia (propia, in_progress) | ✓ | ✗ | ✗ |
| Registrar/editar defectos (propia, in_progress) | ✓ | ✗ | ✗ |
| Generar reporte consolidado | ✗ | ✓ | ✓ |

### 4.4 Row Level Security (RLS)

Todas las tablas tienen RLS habilitado. Patrón general:
- **SELECT**: todos los usuarios autenticados (`auth.uid() IS NOT NULL`).
- **INSERT/UPDATE/DELETE**: condicional al rol vía `get_user_role()` y propiedad del recurso.

---

## 5. Máquina de Estados de Inspección

```
    ┌─────────────┐     complete()     ┌─────────────┐     approve()    ┌─────────────┐
    │ in_progress │ ──────────────────► │  completed  │ ───────────────► │  approved   │
    └─────────────┘                     └─────────────┘                  └─────────────┘
         │                                     │                                │
    Editable:                             Inmutable:                        Inmutable:
    - Evidencia                           - No se puede                    - Estado final
    - Defectos                              editar                         - Solo lectura
    - Stage transitions
```

### Transiciones (Edge Functions)

| Edge Function | Actor Requerido | Validaciones |
|---------------|-----------------|--------------|
| `complete-inspection` | Inspector asignado | JWT válido, status == in_progress, inspector_id == auth.uid() |
| `approve-inspection` | Supervisor/Admin | JWT válido, status == completed, rol ∈ {supervisor, admin} |

Ambas funciones registran `completed_at`/`approved_at` y `approved_by` para auditoría.

---

## 6. Estructura del Frontend

### 6.1 Estructura de Directorios

```
src/
├── components/
│   ├── atoms/          # Button, Input, Badge, Icon, Skeleton, Avatar, Tooltip
│   ├── molecules/      # FormField, SearchBar, FilterChip, StatCard, NavItem, Toast, EmptyState
│   ├── organisms/      # Sidebar, TopBar, Layout, AssetTree, DefectPanel, EvidenceGallery...
│   │   └── charts/     # InspectionPipelineChart, DefectsSpreadChart, ...
│   ├── design-system/  # ThemeProvider, tokens.css
│   ├── AuthGuard.tsx
│   └── RoleGuard.tsx
├── hooks/              # React hooks (useAuth, useInspections, useDashboard, ...)
├── lib/                # Supabase client initialization
├── pages/              # Route-level components (lazy loaded)
├── services/           # Capa de acceso a datos (Supabase SDK calls)
├── store/              # Zustand stores (authStore)
├── types/              # TypeScript types, enums, constants
└── utils/              # error-mapper, validation schemas
```

### 6.2 Arquitectura de Componentes (Atomic Design)

```
Pages (route-level, lazy-loaded)
  └── Organisms (layout + feature sections)
       └── Molecules (composed UI patterns)
            └── Atoms (primitivas: Button, Input, Badge, Icon)
```

### 6.3 Rutas de la Aplicación

| Ruta | Página | Protección |
|------|--------|-----------|
| `/login` | Login | Pública |
| `/dashboard` | Dashboard | AuthGuard |
| `/assets` | Assets (master-detail) | AuthGuard |
| `/inspections` | Inspections list | AuthGuard |
| `/inspections/new` | New Inspection form | AuthGuard |
| `/inspections/:id` | Inspection detail (tabs) | AuthGuard |
| `/reports` | Reports (split view) | AuthGuard |
| `*` | Redirect → /dashboard | — |

Todas las rutas protegidas usan `React.lazy()` + `Suspense` para code-splitting.

---

## 7. Capa de Servicios

Cada servicio encapsula operaciones de Supabase SDK y retorna datos tipados:

| Servicio | Responsabilidad |
|----------|----------------|
| `auth.service.ts` | login, logout, getSession, onAuthStateChange |
| `assets.service.ts` | CRUD wind farms, turbines; getAssetTree() |
| `inspections.service.ts` | CRUD inspections con filtrado y paginación |
| `inspection-transitions.service.ts` | complete/approve vía Edge Functions |
| `evidence.service.ts` | upload, list, delete; validación MIME/size; EXIF extraction |
| `defects.service.ts` | CRUD defects; link/unlink images |
| `dashboard.service.ts` | fetch aggregations desde Edge Function |
| `reports.service.ts` | generate/list reports |
| `history.service.ts` | historial de inspección por blade; búsqueda global |

---

## 8. Gestión de Estado

### 8.1 Server State — React Query

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});
```

- Cada hook (`useInspections`, `useWindFarms`, etc.) usa `useQuery` para fetching con cache.
- Mutaciones usan `useMutation` con invalidación de queries y optimistic updates donde aplica.

### 8.2 Client State — Zustand

- **`authStore`**: user, session, isLoading, isAuthenticated, lastActivity.
- Estado mínimo en client; la fuente de verdad de los datos de negocio es Supabase.

---

## 9. Edge Functions

Funciones serverless ejecutadas en Supabase (Deno runtime):

| Función | Endpoint | Método | Input | Output |
|---------|----------|--------|-------|--------|
| `complete-inspection` | `/functions/v1/complete-inspection` | POST | `{ inspection_id }` | `{ success, inspection }` |
| `approve-inspection` | `/functions/v1/approve-inspection` | POST | `{ inspection_id }` | `{ success, inspection }` |
| `dashboard-aggregate` | `/functions/v1/dashboard-aggregate` | POST | `{ chart, filters }` | Datos agregados por chart |
| `generate-report` | `/functions/v1/generate-report` | POST | `{ inspection_id }` | `{ report_id, url }` |
| `generate-consolidated-report` | `/functions/v1/generate-consolidated-report` | POST | `{ wind_farm_id }` | `{ report_id, url }` |

Todas comparten un módulo `_shared/` con utilidades de validación JWT y respuesta HTTP.

---

## 10. Almacenamiento de Archivos

### Buckets de Supabase Storage

| Bucket | Tipo | Lectura | Escritura | Eliminación |
|--------|------|---------|-----------|-------------|
| `evidence` | Privado | Autenticados | Inspector (inspección propia in_progress) | Inspector (inspección propia in_progress) |
| `reports` | Privado | Autenticados | Edge Functions / Autenticados | — |

### Estrategia de Uploads

1. Validación client-side: tipo MIME ∈ {image/jpeg, image/png}, tamaño ≤ 20MB.
2. Extracción de metadatos EXIF (geolocalización) antes del upload.
3. Upload directo al bucket vía Supabase Storage SDK con progreso.
4. Thumbnails generados on-the-fly con Supabase Image Transforms.

---

## 11. Sistema de Diseño

### 11.1 Tokens CSS

Definidos en `src/components/design-system/tokens.css`:
- Colores (paleta primaria, semánticos, superficies)
- Tipografía (font families, sizes, weights, line heights)
- Espaciado (scale de 4px base)
- Border radius, sombras, transiciones
- Variantes light/dark via atributo `data-theme`

### 11.2 Temas

- `ThemeProvider` gestiona el toggle claro/oscuro.
- Se respeta `prefers-color-scheme` del sistema como default.
- Se respeta `prefers-reduced-motion` desactivando animaciones.

### 11.3 Responsive

- Layout con sidebar colapsable para pantallas pequeñas.
- Breakpoints estándar para reorganización de grids.
- Touch targets adecuados (≥ 44px) en dispositivos móviles.

---

## 12. Manejo de Errores

### 12.1 Error Mapper (`src/utils/error-mapper.ts`)

Centraliza la traducción de errores de Supabase a mensajes amigables:

| Categoría | Ejemplo | Acción UI |
|-----------|---------|-----------|
| Red/conexión | timeout, network error | Toast de error + retry |
| Validación | constraint violation | Mensaje inline en formulario |
| Permisos | RLS policy denied | Toast + redirección si aplica |
| Conflicto | unique constraint | Mensaje descriptivo |
| Not found | 404 desde API | EmptyState o redirect |

### 12.2 Validación Client-Side

- Todos los formularios definen un schema Zod.
- Errores se muestran inline bajo cada campo.
- Scroll automático al primer error (scroll-to-first-error).

---

## 13. Despliegue

### 13.1 Frontend — Vercel

- Build: `tsc -b && vite build`
- Output: `dist/`
- SPA redirect configurado en `vercel.json`
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Cache headers para assets estáticos

### 13.2 Backend — Supabase Cloud

- Migraciones aplicadas con `supabase db push`
- Edge Functions desplegadas con `supabase functions deploy`
- Storage buckets y políticas creados via migraciones SQL
- CORS configurado para dominio Vercel

### 13.3 CI/CD — GitHub Actions

```yaml
Pipeline: lint → type-check → vitest run
Trigger: push a cualquier rama
```

---

## 14. Decisiones de Diseño Clave

| Decisión | Justificación |
|----------|--------------|
| Supabase como BaaS | Elimina la necesidad de API custom; RLS provee seguridad a nivel de fila; Edge Functions para lógica de negocio |
| React Query sobre Redux | Cache inteligente con stale-while-revalidate; menos boilerplate para server state |
| Zustand solo para auth | Estado de sesión es el único client-only state global; todo lo demás viene del servidor |
| Atomic Design | Componentes reutilizables escalables; separación clara de responsabilidades |
| Edge Functions para transiciones | Lógica crítica de negocio (completar/aprobar) no debe depender solo del cliente; validación server-side obligatoria |
| Lazy loading de páginas | Reduce bundle inicial; mejor Time to Interactive |
| CSS custom properties | Theming sin runtime JS; fácil toggle dark/light; performance |
| Zod para validación | Schema-first; compatible con TypeScript; reutilizable entre client y (potencialmente) server |
| ON DELETE RESTRICT en activos | Previene eliminación accidental de datos con dependencias |
| ON DELETE CASCADE en inspection children | Si se elimina la inspección, su evidencia y defectos no tienen sentido sin ella |

---

## 15. Módulo Wind Farms Dashboard (Vista de Assets)

### 15.1 Visión General

El módulo implementa una interfaz tipo panel para la visualización, filtrado, ordenamiento y paginación de parques eólicos. Accesible desde la ruta `/assets-wind`, presenta datos agregados por parque en formato tabular con métricas calculadas (sub-activos, inspecciones, potencia, fechas). Incluye navegación por pestañas para alternar entre vistas de Assets, Defects y Global Map.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Wind Farms                              [ 🔍 Search all and filter ]   │
├─────────────────────────────────────────────────────────────────────────┤
│  [Assets]    Defects    Global Map                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Asset Name ↑ │ SubAssets │ # Inspections │ Total Power │ Powering │ …  │
│  ──────────────┼───────────┼───────────────┼─────────────┼──────────┼── │
│  Filo de Mag…  │    7      │     14        │   21,000    │ 1/25/15  │…  │
│                │           │               │             │          │   │
│                │           │               │             │          │   │
├─────────────────────────────────────────────────────────────────────────┤
│                              Rows per page: [10 ▾]  1-1 of 1   < >     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 15.2 Arquitectura de Componentes

```
src/pages/WindFarmsDashboard.tsx (route-level, lazy-loaded)
├── Título "Wind Farms" + SearchBar (molecule existente)
├── TabNavigation (nuevo componente inline o molecule)
│   └── Tabs: Assets | Defects | Global Map
├── Tab "Assets" (activa por defecto):
│   ├── WindFarmsTable (organismo nuevo)
│   │   ├── Cabecera con columnas ordenables
│   │   ├── Filas de datos (o Skeleton durante carga)
│   │   └── Paginador (footer con rows-per-page + navegación)
│   └── EmptyState (si no hay resultados)
├── Tab "Defects": (placeholder / futuro módulo)
└── Tab "Global Map": (placeholder / futuro módulo)
```

#### Jerarquía de componentes nuevos:

| Componente | Ubicación | Tipo | Responsabilidad |
|------------|-----------|------|-----------------|
| `WindFarmsDashboard` | `src/pages/WindFarmsDashboard.tsx` | Page | Composición de toda la vista, state management |
| `WindFarmsTable` | `src/components/organisms/WindFarmsTable.tsx` | Organism | Tabla de datos con sorting, filas, skeleton |
| `TablePagination` | `src/components/molecules/TablePagination.tsx` | Molecule | Control de filas por página + navegación prev/next |
| `TabBar` | `src/components/molecules/TabBar.tsx` | Molecule | Navegación por pestañas reutilizable |

### 15.3 Modelo de Datos — Vista Agregada

La tabla no muestra campos directos de `wind_farm`, sino una vista agregada que combina datos de múltiples tablas:

```typescript
/** Datos de un wind farm para la tabla del dashboard */
export interface WindFarmDashboardRow {
  id: string;
  name: string;                    // wind_farm.name
  subAssetsCount: number;          // COUNT(turbine) WHERE wind_farm_id = id
  inspectionsCount: number;        // COUNT(inspection) via turbine → blade → inspection
  totalPower: number;              // SUM(turbine.power_kw) o campo calculado
  poweringDate: string | null;     // wind_farm.powering_date (fecha entrada en operación)
  oldestInspection: string | null; // MIN(inspection.created_at) del parque
}
```

#### Estrategia de Obtención de Datos

Se implementa una nueva función en `assetsService` que utiliza una consulta con joins y agregaciones en Supabase, o alternativamente una vista SQL (view) para eficiencia:

**Opción A — RPC Function (recomendada):**

```sql
CREATE OR REPLACE FUNCTION get_wind_farms_dashboard()
RETURNS TABLE (
  id UUID,
  name TEXT,
  sub_assets_count BIGINT,
  inspections_count BIGINT,
  total_power NUMERIC,
  powering_date TIMESTAMPTZ,
  oldest_inspection TIMESTAMPTZ
) AS $$
SELECT
  wf.id,
  wf.name,
  COUNT(DISTINCT t.id) AS sub_assets_count,
  COUNT(DISTINCT i.id) AS inspections_count,
  COALESCE(SUM(DISTINCT t.power_kw), 0) AS total_power,
  wf.powering_date,
  MIN(i.created_at) AS oldest_inspection
FROM wind_farm wf
LEFT JOIN turbine t ON t.wind_farm_id = wf.id
LEFT JOIN blade b ON b.turbine_id = t.id
LEFT JOIN inspection i ON i.blade_id = b.id
GROUP BY wf.id, wf.name, wf.powering_date
ORDER BY wf.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Opción B — Client-side aggregation (alternativa sin migración):**

Si no se desea añadir una migración, se puede calcular client-side usando `getAssetTree()` y realizando los conteos en JavaScript. Esta opción es válida para datasets pequeños (<100 parques).

### 15.4 Capa de Servicio

Extensión de `src/services/assets.service.ts`:

```typescript
// Nuevas funciones para el dashboard de Wind Farms
async getWindFarmsDashboard(): Promise<WindFarmDashboardRow[]> {
  const { data, error } = await supabase
    .rpc('get_wind_farms_dashboard');
  if (error) throw error;
  return data as WindFarmDashboardRow[];
}
```

### 15.5 Hook de React Query

Nuevo hook `src/hooks/useWindFarmsDashboard.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { assetsService } from '@/services/assets.service';

export function useWindFarmsDashboard() {
  return useQuery({
    queryKey: ['wind-farms-dashboard'],
    queryFn: () => assetsService.getWindFarmsDashboard(),
  });
}
```

### 15.6 Gestión de Estado del Componente

El estado local de `WindFarmsDashboard` page:

| Estado | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| `activeTab` | `'assets' \| 'defects' \| 'globalMap'` | `'assets'` | Pestaña activa |
| `searchQuery` | `string` | `''` | Texto de búsqueda |
| `sortField` | `SortField` | `'name'` | Columna de ordenamiento |
| `sortDirection` | `'asc' \| 'desc'` | `'asc'` | Dirección de orden |
| `page` | `number` | `1` | Página actual |
| `rowsPerPage` | `number` | `10` | Filas por página |

#### Flujo de datos:

```
useWindFarmsDashboard() → datos brutos
  → filtrado por searchQuery (client-side, match en name)
  → ordenamiento por sortField + sortDirection
  → paginación: slice((page-1)*rowsPerPage, page*rowsPerPage)
  → renderizado en WindFarmsTable
```

### 15.7 Especificación de Componentes UI

#### A. TabBar (Molecule)

```typescript
interface TabBarProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (tabId: string) => void;
}
```

Estilos:
- Contenedor: `display: flex; gap: var(--space-6); border-bottom: 1px solid var(--color-neutral-200);`
- Tab activa: `color: var(--color-primary-600); border-bottom: 2px solid var(--color-primary-600); font-weight: 600;`
- Tab inactiva: `color: var(--color-neutral-500); border-bottom: 2px solid transparent;`
- Hover: `color: var(--color-primary-500);`

#### B. WindFarmsTable (Organism)

Props:
```typescript
interface WindFarmsTableProps {
  data: WindFarmDashboardRow[];
  isLoading: boolean;
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
  onSort: (field: SortField) => void;
}
```

Estilos (consistentes con Inspections page):
- Cabecera: `background: var(--color-neutral-50); font-weight: 600; font-size: var(--text-xs); text-transform: uppercase; color: var(--color-neutral-600);`
- Filas: `border-bottom: 1px solid #E5E7EB; padding: var(--space-3) var(--space-4);`
- Hover en fila: `background-color: var(--color-neutral-50);`
- Icono de orden: flecha `↑` / `↓` junto a la cabecera activa.

#### C. TablePagination (Molecule)

```typescript
interface TablePaginationProps {
  page: number;
  rowsPerPage: number;
  totalCount: number;
  rowsPerPageOptions: number[];
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}
```

Layout:
- Alineado a la derecha (flexbox justify-end)
- Label: "Rows per page:" + `<select>` con opciones [5, 10, 25, 100]
- Indicador: "{from}-{to} of {total}"
- Botones `<` y `>` con iconos `ChevronLeft` / `ChevronRight` de Lucide
- Botones disabled cuando no hay página previa/siguiente

#### D. Skeleton de tabla (estado de carga)

Se reutiliza el componente `Skeleton` existente (variant="rect") para simular 5-8 filas de tabla durante la carga:

```tsx
{Array.from({ length: rowsPerPage }).map((_, i) => (
  <Skeleton key={i} variant="rect" height="48px" />
))}
```

### 15.8 Routing

Adición a `src/App.tsx`:

```typescript
const WindFarmsDashboardPage = lazy(() =>
  import('@/pages/WindFarmsDashboard').then((m) => ({ default: m.WindFarmsDashboard })),
);

// Nueva ruta en Routes:
<Route
  path="/assets-wind"
  element={
    <AuthGuard>
      <AppLayout>
        <WindFarmsDashboardPage />
      </AppLayout>
    </AuthGuard>
  }
/>
```

### 15.9 Comportamiento UX

| Interacción | Comportamiento |
|-------------|---------------|
| Carga inicial | Mostrar skeleton (rows simulados) mientras React Query resuelve |
| Búsqueda | Debounce 300ms → filtro client-side por `name` (case-insensitive includes) |
| Cambio de tab | Renderiza contenido de la pestaña activa sin navegar a otra ruta |
| Ordenamiento | Click en cabecera → toggle asc/desc; reset a page 1 |
| Cambio rows/page | Actualiza paginación y resetea a page 1 |
| Sin resultados | EmptyState con mensaje y acción de limpiar búsqueda |
| Error de red | Toast de error vía error handler existente |

### 15.10 Migración SQL Requerida

```sql
-- Migration: add powering_date and create dashboard RPC

-- 1. Añadir campo powering_date si no existe en wind_farm
ALTER TABLE wind_farm
  ADD COLUMN IF NOT EXISTS powering_date TIMESTAMPTZ;

-- 2. Añadir campo power_kw si no existe en turbine
ALTER TABLE turbine
  ADD COLUMN IF NOT EXISTS power_kw NUMERIC DEFAULT 0;

-- 3. Crear función RPC para dashboard
CREATE OR REPLACE FUNCTION get_wind_farms_dashboard()
RETURNS TABLE (
  id UUID,
  name TEXT,
  sub_assets_count BIGINT,
  inspections_count BIGINT,
  total_power NUMERIC,
  powering_date TIMESTAMPTZ,
  oldest_inspection TIMESTAMPTZ
) AS $$
SELECT
  wf.id,
  wf.name,
  COUNT(DISTINCT t.id) AS sub_assets_count,
  COUNT(DISTINCT i.id) AS inspections_count,
  COALESCE(SUM(DISTINCT t.power_kw), 0) AS total_power,
  wf.powering_date,
  MIN(i.created_at) AS oldest_inspection
FROM wind_farm wf
LEFT JOIN turbine t ON t.wind_farm_id = wf.id
LEFT JOIN blade b ON b.turbine_id = t.id
LEFT JOIN inspection i ON i.blade_id = b.id
GROUP BY wf.id, wf.name, wf.powering_date
ORDER BY wf.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### 15.11 Decisiones de Diseño Específicas

| Decisión | Justificación |
|----------|--------------|
| RPC function en vez de vista SQL | Más control sobre permisos (SECURITY DEFINER); reutilizable vía `supabase.rpc()` |
| Filtrado/ordenamiento client-side | Dataset de parques es típicamente pequeño (<100 registros); evita complejidad de paginación server-side |
| TabBar como molecule reutilizable | Podrá usarse en futuras vistas con pestañas (ej. InspectionDetail ya usa tabs) |
| TablePagination como molecule | Patrón de paginación replicable en múltiples tablas del sistema |
| Skeleton rows en vez de spinner | Mejor percepción de velocidad; indica la estructura que se va a cargar |
| Pestañas Defects y Global Map como placeholders | Preparación para extensión futura sin bloquear la implementación actual |


---

## 16. Módulo de Gestión de Defectos — Vista de Defects (Wind Farms)

### 16.1 Visión General

El módulo implementa la pestaña **Defects** dentro del dashboard de Wind Farms (`/assets-wind`), reemplazando el placeholder actual. Presenta una vista de doble panel: una tabla paginada/ordenable con todos los defectos registrados en el sistema (izquierda, ~70%) y un panel lateral de detalle del defecto seleccionado (derecha, ~30%). Incluye exportación CSV/XLSX, búsqueda global, comentarios, visualizador de imagen con zoom, y diagrama SVG de posición en la pala.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Wind Farms                                         [ 🔍 Search all and filter ] │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Assets    [Defects]    Global Map          [ ⬇ EXPORT LIST ]                    │
├─────────────────────────────────────────────┬────────────────────────────────────┤
│  TABLA DE DEFECTOS (~70%)                   │  PANEL DE DETALLE (~30%)           │
│  ┌─────────────────────────────────────┐    │  ┌──────────────────────────────┐  │
│  │ Asset│Turbine│Model│Type│Size│Cat│…  │    │  │ LE EROSION 🔗   Status: ⬜  │  │
│  │──────┼───────┼─────┼────┼────┼───┼──│    │  │ Cat: [3]  Size: 17x332     │  │
│  │ ████ │ WT01  │V90  │LE E│17x3│ 3 │…│◄───│  │ Blade Side: LE             │  │
│  │      │       │     │    │    │   │  │    │  │────────────────────────────│  │
│  │      │ WT01  │V90  │VOR │9x4 │ 3 │…│    │  │ Root Cause: ...            │  │
│  │      │       │     │    │    │   │  │    │  │ Next Step: ...             │  │
│  │      │       │     │    │    │   │  │    │  │ Notes: ...                 │  │
│  └─────────────────────────────────────┘    │  │────────────────────────────│  │
│  Rows per page: [25 ▾]  1-25 of 322  < >   │  │ Comments (N)               │  │
│                                             │  │ ┌────────────────────────┐ │  │
│                                             │  │ │ New comment       [→]  │ │  │
│                                             │  │ └────────────────────────┘ │  │
│                                             │  │────────────────────────────│  │
│                                             │  │ [  IMAGE VIEWER  ][+][-]  │  │
│                                             │  │ [     COMPARE    ]        │  │
│                                             │  │────────────────────────────│  │
│                                             │  │ [ BLADE DIAGRAM SS|PS ]   │  │
│                                             │  └──────────────────────────────┘  │
└─────────────────────────────────────────────┴────────────────────────────────────┘
```


### 16.2 Arquitectura de Componentes

```
src/pages/WindFarmsDashboard.tsx (existente — se extiende el tab "defects")
└── Tab "Defects" (activo):
    ├── ExportButton (atom/molecule nuevo)
    └── DefectsWindFarmsView (organism nuevo — layout de doble panel)
        ├── DefectsTable (organism nuevo — ~70% ancho)
        │   ├── Cabecera con 11 columnas ordenables
        │   ├── Filas de datos con selección activa (highlight azul)
        │   ├── Skeleton durante carga
        │   └── TablePagination (molecule existente — 25 por defecto)
        └── DefectDetailSidebar (organism nuevo — ~30% ancho)
            ├── DefectDetailHeader (nombre, badge categoría, toggle status)
            ├── DefectDetailInfo (size, blade side, root cause, next step, notes)
            ├── DefectComments (sección de comentarios)
            ├── DefectImageViewer (visor con zoom + botón COMPARE)
            └── BladeDiagram (SVG esquema de pala con indicador de posición)
```

#### Jerarquía de Componentes Nuevos

| Componente | Ubicación | Tipo | Responsabilidad |
|------------|-----------|------|-----------------|
| `DefectsWindFarmsView` | `src/components/organisms/DefectsWindFarmsView.tsx` | Organism | Layout split-panel, orquesta tabla + sidebar |
| `DefectsTable` | `src/components/organisms/DefectsTable.tsx` | Organism | Tabla de 11 columnas con sort, selección de fila, skeleton |
| `DefectDetailSidebar` | `src/components/organisms/DefectDetailSidebar.tsx` | Organism | Panel lateral con scroll independiente |
| `DefectImageViewer` | `src/components/organisms/DefectImageViewer.tsx` | Organism | Visor de imagen con controles zoom (+/-) y COMPARE |
| `BladeDiagram` | `src/components/organisms/BladeDiagram.tsx` | Organism | SVG vectorial de pala SS/PS con punto indicador |
| `DefectComments` | `src/components/molecules/DefectComments.tsx` | Molecule | Lista de comentarios + campo de entrada |
| `ExportButton` | `src/components/atoms/ExportButton.tsx` | Atom | Botón verde con icono de descarga |


### 16.3 Modelo de Datos — Vista Agregada de Defectos

La tabla de defectos requiere datos que cruzan múltiples tablas (defect → inspection → blade → turbine → wind_farm). Se necesita una nueva función RPC o vista que retorne todos los defectos con contexto completo:

```typescript
/** Fila de defecto en la tabla del dashboard de Wind Farms */
export interface DefectDashboardRow {
  id: string;
  assetName: string;             // wind_farm.name
  turbineName: string;           // turbine.name (ej. "WT01")
  turbineModel: string;          // turbine.model (ej. "Vestas V90")
  type: string;                  // defect.type (formateado para UI)
  defectWidth: number;           // defect.width_cm
  defectHeight: number;          // defect.height_cm
  category: number;              // defect.severity (1-5)
  actionText: string;            // campo de acción recomendada
  actionUrgency: 'high' | 'medium' | 'low';  // derivado de severity/plazo
  nextStep: string;              // defect.next_step
  bladePosition: string;         // "A" | "B" | "C" (derivado de blade.position)
  side: string;                  // "LE" | "SS" | "TE" | "PS"
  rootDistance: number;           // defect.distance_from_root
  // Campos para el panel de detalle:
  rootCause: string | null;
  notes: string | null;
  imageUrl: string | null;       // URL de primera imagen de evidencia
  resolved: boolean;             // estado de resolución
  inspectionId: string;          // para navegación
  bladeId: string;
}
```

#### Campos adicionales requeridos en la tabla `defect`

La tabla existente tiene: `type`, `severity`, `distance_from_root`, `description`. Se necesitan campos adicionales:

```sql
ALTER TABLE defect
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS side VARCHAR(2) DEFAULT 'LE',
  ADD COLUMN IF NOT EXISTS action_text TEXT,
  ADD COLUMN IF NOT EXISTS action_urgency VARCHAR(10) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;
```

Constraint para `side`:
```sql
ALTER TABLE defect
  ADD CONSTRAINT defect_side_check CHECK (side IN ('LE', 'SS', 'TE', 'PS'));
```

Constraint para `action_urgency`:
```sql
ALTER TABLE defect
  ADD CONSTRAINT defect_action_urgency_check CHECK (action_urgency IN ('high', 'medium', 'low'));
```


### 16.4 Tabla de Comentarios

Se requiere una nueva tabla para almacenar comentarios por defecto:

```sql
CREATE TABLE IF NOT EXISTS defect_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id UUID NOT NULL REFERENCES defect(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_defect_comment_defect_id ON defect_comment(defect_id);

-- RLS
ALTER TABLE defect_comment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read comments"
  ON defect_comment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert comments"
  ON defect_comment FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());
```

### 16.5 Función RPC para Dashboard de Defectos

```sql
CREATE OR REPLACE FUNCTION get_defects_dashboard(
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0,
  p_sort_field TEXT DEFAULT 'asset_name',
  p_sort_dir TEXT DEFAULT 'asc'
)
RETURNS TABLE (
  id UUID,
  asset_name TEXT,
  turbine_name TEXT,
  turbine_model TEXT,
  defect_type TEXT,
  width_cm NUMERIC,
  height_cm NUMERIC,
  category INT,
  action_text TEXT,
  action_urgency TEXT,
  next_step TEXT,
  blade_position INT,
  side VARCHAR(2),
  root_distance NUMERIC,
  root_cause TEXT,
  notes TEXT,
  resolved BOOLEAN,
  inspection_id UUID,
  blade_id UUID,
  total_count BIGINT
) AS $$
SELECT
  d.id,
  wf.name AS asset_name,
  t.name AS turbine_name,
  t.model AS turbine_model,
  d.type AS defect_type,
  d.width_cm,
  d.height_cm,
  d.severity AS category,
  d.action_text,
  d.action_urgency,
  d.next_step,
  b.position AS blade_position,
  d.side,
  d.distance_from_root AS root_distance,
  d.root_cause,
  d.notes,
  d.resolved,
  i.id AS inspection_id,
  b.id AS blade_id,
  COUNT(*) OVER() AS total_count
FROM defect d
JOIN inspection i ON i.id = d.inspection_id
JOIN blade b ON b.id = i.blade_id
JOIN turbine t ON t.id = b.turbine_id
JOIN wind_farm wf ON wf.id = t.wind_farm_id
WHERE (p_search = '' OR
  wf.name ILIKE '%' || p_search || '%' OR
  t.name ILIKE '%' || p_search || '%' OR
  t.model ILIKE '%' || p_search || '%' OR
  d.type ILIKE '%' || p_search || '%')
ORDER BY
  CASE WHEN p_sort_dir = 'asc' THEN
    CASE p_sort_field
      WHEN 'asset_name' THEN wf.name
      WHEN 'turbine_name' THEN t.name
      WHEN 'turbine_model' THEN t.model
      WHEN 'type' THEN d.type
    END
  END ASC,
  CASE WHEN p_sort_dir = 'desc' THEN
    CASE p_sort_field
      WHEN 'asset_name' THEN wf.name
      WHEN 'turbine_name' THEN t.name
      WHEN 'turbine_model' THEN t.model
      WHEN 'type' THEN d.type
    END
  END DESC
LIMIT p_limit OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```


### 16.6 Capa de Servicio

Extensión de `src/services/defects.service.ts` con métodos nuevos:

```typescript
// Nuevos métodos para el dashboard de defectos

async listDefectsDashboard(params: {
  search?: string;
  limit?: number;
  offset?: number;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ data: DefectDashboardRow[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('get_defects_dashboard', {
    p_search: params.search ?? '',
    p_limit: params.limit ?? 25,
    p_offset: params.offset ?? 0,
    p_sort_field: params.sortField ?? 'asset_name',
    p_sort_dir: params.sortDir ?? 'asc',
  });
  if (error) throw new DefectServiceError(error.message, error.code);
  const rows = (data ?? []) as RawDefectDashboardRow[];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map(mapToDefectDashboardRow),
    totalCount,
  };
}

async getDefectComments(defectId: string): Promise<DefectComment[]> {
  const { data, error } = await supabase
    .from('defect_comment')
    .select('*, author:profiles(full_name)')
    .eq('defect_id', defectId)
    .order('created_at', { ascending: false });
  if (error) throw new DefectServiceError(error.message, error.code);
  return data as unknown as DefectComment[];
}

async addDefectComment(defectId: string, text: string): Promise<DefectComment> {
  const { data, error } = await supabase
    .from('defect_comment')
    .insert({ defect_id: defectId, text, author_id: (await supabase.auth.getUser()).data.user?.id })
    .select('*, author:profiles(full_name)')
    .single();
  if (error) throw new DefectServiceError(error.message, error.code);
  return data as unknown as DefectComment;
}

async toggleDefectResolved(id: string, resolved: boolean): Promise<void> {
  const { error } = await supabase
    .from('defect')
    .update({ resolved })
    .eq('id', id);
  if (error) throw new DefectServiceError(error.message, error.code);
}

async exportDefectsList(params: { search?: string }): Promise<Blob> {
  // Fetch all matching rows (no limit) and convert to CSV
  const { data } = await this.listDefectsDashboard({
    search: params.search,
    limit: 10000,
    offset: 0,
  });
  return generateCSV(data);
}
```

### 16.7 Hooks de React Query

#### `src/hooks/useDefectsDashboard.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { defectsService } from '@/services/defects.service';

export function useDefectsDashboard(params: {
  search: string;
  page: number;
  rowsPerPage: number;
  sortField: string;
  sortDir: 'asc' | 'desc';
}) {
  return useQuery({
    queryKey: ['defects-dashboard', params],
    queryFn: () => defectsService.listDefectsDashboard({
      search: params.search,
      limit: params.rowsPerPage,
      offset: (params.page - 1) * params.rowsPerPage,
      sortField: params.sortField,
      sortDir: params.sortDir,
    }),
    placeholderData: (prev) => prev, // keepPreviousData equivalent
  });
}
```

#### `src/hooks/useDefectComments.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { defectsService } from '@/services/defects.service';

export function useDefectComments(defectId: string | null) {
  return useQuery({
    queryKey: ['defect-comments', defectId],
    queryFn: () => defectsService.getDefectComments(defectId!),
    enabled: !!defectId,
  });
}

export function useAddDefectComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ defectId, text }: { defectId: string; text: string }) =>
      defectsService.addDefectComment(defectId, text),
    onSuccess: (_, { defectId }) => {
      queryClient.invalidateQueries({ queryKey: ['defect-comments', defectId] });
    },
  });
}
```


### 16.8 Gestión de Estado del Componente

Estado local de la vista Defects dentro de `WindFarmsDashboard`:

| Estado | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| `searchQuery` | `string` | `''` | Búsqueda en defectos |
| `sortField` | `DefectSortField` | `'assetName'` | Columna de ordenamiento |
| `sortDirection` | `'asc' \| 'desc'` | `'asc'` | Dirección |
| `page` | `number` | `1` | Página actual |
| `rowsPerPage` | `number` | `25` | Filas por página |
| `selectedDefectId` | `string \| null` | primer defecto | Defecto seleccionado (abre panel) |
| `zoomLevel` | `number` | `1.0` | Nivel de zoom de imagen |

#### Flujo de datos:

```
useDefectsDashboard({ search, page, rowsPerPage, sortField, sortDir })
  → { data: DefectDashboardRow[], totalCount }
  → DefectsTable renderiza filas
  → Click en fila → setSelectedDefectId
  → DefectDetailSidebar muestra detalle del defecto seleccionado
  → useDefectComments(selectedDefectId) → comentarios
```

### 16.9 Especificación de Componentes UI

#### A. DefectsTable (Organism)

```typescript
export type DefectSortField =
  | 'assetName' | 'turbineName' | 'turbineModel' | 'type'
  | 'defectSize' | 'category' | 'action' | 'nextStep'
  | 'blade' | 'side' | 'rootDistance';

interface DefectsTableProps {
  data: DefectDashboardRow[];
  isLoading: boolean;
  sortField: DefectSortField;
  sortDirection: 'asc' | 'desc';
  onSort: (field: DefectSortField) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}
```

Estilos:
- Fondo de filas: azul marino profundo (#0A1929), texto blanco/gris claro
- Fila seleccionada: fondo azul claro translúcido (rgba(0, 163, 224, 0.15))
- Cabeceras: fondo ligeramente más oscuro, texto en mayúsculas, font-size xs
- Columna Category: Badge con bordes redondeados (naranja cat 3, naranja oscuro cat 4)
- Columna Action: Barra vertical de color a la izquierda del texto (naranja = urgente, amarillo = medio)
- Columna Defect size: formato "W x H" cm

#### B. DefectDetailSidebar (Organism)

```typescript
interface DefectDetailSidebarProps {
  defect: DefectDashboardRow | null;
  onResolvedToggle: (id: string, resolved: boolean) => void;
  zoomLevel: number;
  onZoomChange: (level: number) => void;
}
```

Layout vertical con secciones:
1. **Header**: Tipo de defecto (H3) + icono enlace externo + Badge categoría + Toggle status
2. **Metadata**: Defect size, Blade Side (texto)
3. **Info**: Root Cause, Next Step, Notes (campos de solo lectura)
4. **Comments**: Lista + input de nuevo comentario
5. **Image Viewer**: Imagen con controles zoom
6. **Blade Diagram**: SVG

Fondo: blanco (#FFFFFF), scroll vertical independiente, ancho fijo ~30%.

#### C. DefectImageViewer (Organism)

```typescript
interface DefectImageViewerProps {
  imageUrl: string | null;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCompare: () => void;
}
```

- Contenedor con overflow hidden, aspect-ratio fijo
- Imagen escalada por `transform: scale(zoomLevel)`
- Botones +/- en esquina inferior derecha
- Indicador de escala (ej. "x1.00")
- Botón COMPARE debajo del visor (estilo azul outline)
- Zoom con scroll del mouse (wheel event)

#### D. BladeDiagram (Organism)

```typescript
interface BladeDiagramProps {
  side: string;           // "LE" | "SS" | "TE" | "PS"
  rootDistance: number;   // metros
  bladeLength?: number;   // metros totales de la pala (default 45m)
}
```

- SVG inline con representación estilizada de pala (perfil lateral)
- Dos secciones: SS (izquierda) y PS (derecha)
- Punto amarillo (#FFD700) posicionado proporcionalmente según `rootDistance / bladeLength`
- Fondo gris claro, silueta verde/teal
- Labels "SS" y "PS" en los extremos

#### E. DefectComments (Molecule)

```typescript
interface DefectCommentsProps {
  defectId: string;
}
```

- Encabezado "Comments (N)" con conteo
- Lista de comentarios: avatar/nombre, fecha relativa, texto
- Input con placeholder "New comment" + botón send (icono flecha)
- Scroll independiente si hay muchos comentarios

#### F. ExportButton (Atom)

```typescript
interface ExportButtonProps {
  onClick: () => void;
  loading?: boolean;
}
```

- Fondo verde (#27AE60), texto blanco, icono Download de Lucide
- Texto: "EXPORT LIST"
- Bordes redondeados, hover más oscuro
- Estado loading con spinner


### 16.10 Comportamiento UX

| Interacción | Comportamiento |
|-------------|---------------|
| Carga inicial | Skeleton rows mientras React Query resuelve; primer defecto auto-seleccionado |
| Selección de fila | Click → highlight azul + actualización inmediata del panel derecho (sin recarga) |
| Zoom de imagen | Botones +/- incrementan/decrementan 0.25; wheel event sobre imagen; min x0.5, max x4.0 |
| Scroll independiente | Tabla y panel derecho con `overflow-y: auto` independientes, alturas fijas (calc 100vh - header) |
| Búsqueda | Debounce 300ms → servidor-side via RPC (búsqueda en asset name, turbine, model, type) |
| Ordenamiento | Click en cabecera → toggle asc/desc; reset a page 1; servidor-side via RPC |
| Cambio rows/page | Actualiza paginación, reset a page 1 |
| Export | Descarga CSV/XLSX respetando filtros activos |
| Toggle resolved | Switch en panel lateral → mutación → refetch de datos |
| Nuevo comentario | Envío → optimistic update en lista → mutación server |
| Cambio de tab | Mantiene estado de búsqueda/filtros compartido cuando es posible |
| Sin resultados | EmptyState con icono y sugerencia de ajustar búsqueda |
| Panel lateral cerrado | Si no hay defectos, el panel lateral no se muestra (tabla ocupa 100%) |

### 16.11 Migración SQL Requerida

```sql
-- Migration: defects dashboard support

-- 1. Nuevas columnas en defect
ALTER TABLE defect
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS side VARCHAR(2) DEFAULT 'LE',
  ADD COLUMN IF NOT EXISTS action_text TEXT,
  ADD COLUMN IF NOT EXISTS action_urgency VARCHAR(10) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;

-- 2. Constraints
ALTER TABLE defect
  ADD CONSTRAINT IF NOT EXISTS defect_side_check
    CHECK (side IN ('LE', 'SS', 'TE', 'PS'));

ALTER TABLE defect
  ADD CONSTRAINT IF NOT EXISTS defect_action_urgency_check
    CHECK (action_urgency IN ('high', 'medium', 'low'));

-- 3. Añadir campo model a turbine si no existe
ALTER TABLE turbine
  ADD COLUMN IF NOT EXISTS model TEXT;

-- 4. Tabla de comentarios
CREATE TABLE IF NOT EXISTS defect_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id UUID NOT NULL REFERENCES defect(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defect_comment_defect_id
  ON defect_comment(defect_id);

ALTER TABLE defect_comment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read defect comments"
  ON defect_comment FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert defect comments"
  ON defect_comment FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- 5. Crear función RPC para dashboard de defectos
CREATE OR REPLACE FUNCTION get_defects_dashboard(
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0,
  p_sort_field TEXT DEFAULT 'asset_name',
  p_sort_dir TEXT DEFAULT 'asc'
)
RETURNS TABLE (
  id UUID,
  asset_name TEXT,
  turbine_name TEXT,
  turbine_model TEXT,
  defect_type TEXT,
  width_cm NUMERIC,
  height_cm NUMERIC,
  category INT,
  action_text TEXT,
  action_urgency TEXT,
  next_step TEXT,
  blade_position INT,
  side VARCHAR,
  root_distance NUMERIC,
  root_cause TEXT,
  notes TEXT,
  resolved BOOLEAN,
  inspection_id UUID,
  blade_id UUID,
  total_count BIGINT
) AS $$
SELECT
  d.id,
  wf.name AS asset_name,
  t.name AS turbine_name,
  t.model AS turbine_model,
  d.type AS defect_type,
  d.width_cm,
  d.height_cm,
  d.severity::INT AS category,
  d.action_text,
  d.action_urgency,
  d.next_step,
  b.position AS blade_position,
  d.side,
  d.distance_from_root AS root_distance,
  d.root_cause,
  d.notes,
  d.resolved,
  i.id AS inspection_id,
  b.id AS blade_id,
  COUNT(*) OVER() AS total_count
FROM defect d
JOIN inspection i ON i.id = d.inspection_id
JOIN blade b ON b.id = i.blade_id
JOIN turbine t ON t.id = b.turbine_id
JOIN wind_farm wf ON wf.id = t.wind_farm_id
WHERE (p_search = '' OR
  wf.name ILIKE '%' || p_search || '%' OR
  t.name ILIKE '%' || p_search || '%' OR
  t.model ILIKE '%' || p_search || '%' OR
  d.type ILIKE '%' || p_search || '%')
ORDER BY
  CASE WHEN p_sort_dir = 'asc' THEN
    CASE p_sort_field
      WHEN 'asset_name' THEN wf.name
      WHEN 'turbine_name' THEN t.name
      WHEN 'turbine_model' THEN t.model
      WHEN 'type' THEN d.type
    END
  END ASC NULLS LAST,
  CASE WHEN p_sort_dir = 'desc' THEN
    CASE p_sort_field
      WHEN 'asset_name' THEN wf.name
      WHEN 'turbine_name' THEN t.name
      WHEN 'turbine_model' THEN t.model
      WHEN 'type' THEN d.type
    END
  END DESC NULLS LAST
LIMIT p_limit OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```


### 16.12 Exportación CSV/XLSX

La funcionalidad de exportación se implementa client-side:

1. Al hacer clic en EXPORT LIST, se consulta `get_defects_dashboard` con los filtros activos pero sin límite de paginación (limit: 10000).
2. Se genera un archivo CSV con separador ";" y encabezados en inglés.
3. Se dispara la descarga mediante un `Blob` + `URL.createObjectURL` + `<a>` temporal.

```typescript
function generateCSV(data: DefectDashboardRow[]): Blob {
  const headers = [
    'Asset', 'Turbine', 'Model', 'Type', 'Defect Size (cm)',
    'Category', 'Action', 'Next Step', 'Blade', 'Side', 'Root Distance (m)'
  ];
  const rows = data.map(row => [
    row.assetName, row.turbineName, row.turbineModel, row.type,
    `${row.defectWidth} x ${row.defectHeight}`, String(row.category),
    row.actionText, row.nextStep, row.bladePosition, row.side,
    String(row.rootDistance)
  ]);
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}
```

### 16.13 Decisiones de Diseño Específicas

| Decisión | Justificación |
|----------|--------------|
| Paginación y ordenamiento server-side (RPC) | El dataset de defectos puede ser grande (322+ registros en ejemplo); client-side no escala |
| Tabla con fondo oscuro (tema Wind Farms) | Consistente con el diseño de referencia de la imagen; mejora legibilidad de datos densos |
| Panel lateral fijo (no modal) | Permite ver contexto de la tabla mientras se analiza el detalle; no interrumpe el flujo |
| SVG inline para blade diagram | Performance y control total de posicionamiento del indicador; sin dependencias externas |
| Comentarios en tabla separada | Permite extensibilidad (menciones, adjuntos futuros) y consultas eficientes por defecto |
| Zoom con transform CSS | Solución ligera sin librería de imágenes; compatible con smooth animations |
| Export CSV sin librería externa | Datos tabulares simples; no justifica una dependencia como SheetJS para CSV básico |
| Campos adicionales en `defect` en vez de tabla separada | Los campos (width, height, side, action, etc.) son atributos intrínsecos del defecto; normalización excesiva añade JOINs innecesarios |
| RPC `SECURITY DEFINER` | Permite la consulta cruzada de múltiples tablas respetando permisos a nivel de función |
| `placeholderData` en React Query | Evita flicker al paginar/filtrar mostrando datos previos mientras carga los nuevos |


---

## 17. Módulo de Ficha del Parque Eólico (Asset Detail View)

### 17.1 Visión General

El módulo implementa la vista de detalle de un parque eólico específico, accesible desde la tabla de Wind Farms al hacer clic en una fila. La ruta es `/assets-wind/:id`. Presenta una interfaz dividida en dos columnas: la izquierda (~35%) contiene información estática (detalles técnicos, tabla de turbinas, documentos) y la derecha (~65%) contiene la gestión dinámica de campañas de inspección con tablas expandibles.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  [Asset Name]                    [ 🔍 Search all ]                        [🔔]       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  General    Defects                                                                   │
├────────────────────────────────┬─────────────────────────────────────────────────────┤
│  COLUMNA IZQUIERDA (~35%)      │  COLUMNA DERECHA (~65%) — Campaigns                 │
│  ┌──────────────────────────┐  │  ┌───────────────────────────────────────────────┐  │
│  │ Details                   │  │  │ Campaigns          [ MANAGE CAMPAIGNS ]       │  │
│  │ Oldest inspection: ...    │  │  │                                               │  │
│  │ Powering date: ...        │  │  │ ▼ June 2026 (Copy) (7)    [VIEW RESULTS][…]  │  │
│  │ Total power: 21000 kW     │  │  │ ┌─────────────────────────────────────────┐  │  │
│  │ Number of sub-assets: 7   │  │  │ │ InspDate│Subasset│Status│Type│Photos│…  │  │  │
│  │ [PLAN A NEW INSPECTION]   │  │  │ │─────────┼────────┼──────┼────┼──────┼──│  │  │
│  ├──────────────────────────┤  │  │ │ 6/3/26  │ WT01   │Report│Blad│ 498  │… │  │  │
│  │ Subassets                 │  │  │ └─────────────────────────────────────────┘  │  │
│  │ Name│Model│Last Insp│…    │  │  │                                               │  │
│  │─────┼─────┼─────────┼──  │  │  │ ▶ June 2026 (7)           [VIEW RESULTS][…]  │  │
│  │ WT01│V90  │6/5/2025 │…   │  │  │ ▶ Tests (2)               [VIEW RESULTS][…]  │  │
│  │ WT02│V90  │6/5/2025 │…   │  │  └───────────────────────────────────────────────┘  │
│  │ ...                       │  │                                                     │
│  │ Rows per page: [10▾] 1-7  │  │                                                     │
│  │ [TURBINES SERIAL NUMBERS] │  │                                                     │
│  ├──────────────────────────┤  │                                                     │
│  │ Documents dropbox         │  │                                                     │
│  │ [+ ADD DOCUMENT]          │  │                                                     │
│  │ "Have all your key docs…" │  │                                                     │
│  └──────────────────────────┘  │                                                     │
└────────────────────────────────┴─────────────────────────────────────────────────────┘
```


### 17.2 Arquitectura de Componentes

```
src/pages/WindFarmDetail.tsx (route-level, lazy-loaded)
├── Encabezado: nombre del parque + pestañas (General | Defects)
├── Tab "General" (activa por defecto):
│   ├── LeftColumn (flex ~35%)
│   │   ├── DetailsBlock (organism nuevo)
│   │   │   ├── Metadatos calculados (oldest inspection, powering date, total power, sub-assets count)
│   │   │   └── Botón "Plan a New Inspection"
│   │   ├── SubassetsTable (organism nuevo)
│   │   │   ├── Tabla paginada de turbinas con sort
│   │   │   ├── TablePagination (molecule existente)
│   │   │   └── Botón "Turbines Serial Numbers" → abre modal
│   │   └── DocumentDropbox (organism nuevo)
│   │       ├── Lista de documentos con download/delete
│   │       └── Botón "Add Document" con upload
│   └── RightColumn (flex ~65%)
│       └── CampaignsPanel (organism nuevo)
│           ├── Header: "Campaigns" + botón "Manage Campaigns"
│           └── CampaignAccordion[] (organism nuevo, uno por campaña)
│               ├── Header colapsable: nombre + count + "View Results" + menu "..."
│               └── CampaignInspectionsTable (expandido)
├── Tab "Defects":
│   └── DefectsWindFarmsView (existente, filtrado por wind_farm_id)
├── TurbineSerialNumbersModal (organism nuevo — dialog superpuesto)
└── CreateCampaignModal (organism nuevo — dialog superpuesto)
```

#### Jerarquía de Componentes Nuevos

| Componente | Ubicación | Tipo | Responsabilidad |
|------------|-----------|------|-----------------|
| `WindFarmDetail` | `src/pages/WindFarmDetail.tsx` | Page | Layout completo, orquesta columnas y modales |
| `DetailsBlock` | `src/components/organisms/DetailsBlock.tsx` | Organism | Muestra metadatos agregados del parque |
| `SubassetsTable` | `src/components/organisms/SubassetsTable.tsx` | Organism | Tabla paginada de turbinas con sort |
| `DocumentDropbox` | `src/components/organisms/DocumentDropbox.tsx` | Organism | Upload/list/delete de documentos del parque |
| `CampaignsPanel` | `src/components/organisms/CampaignsPanel.tsx` | Organism | Contenedor del listado de campañas |
| `CampaignAccordion` | `src/components/organisms/CampaignAccordion.tsx` | Organism | Campaña individual colapsable con tabla interna |
| `TurbineSerialNumbersModal` | `src/components/organisms/TurbineSerialNumbersModal.tsx` | Organism | Modal editable de números de serie |
| `CreateCampaignModal` | `src/components/organisms/CreateCampaignModal.tsx` | Organism | Modal para crear campaña y asignar inspecciones |


### 17.3 Modelo de Datos

#### Nueva tabla: `campaign`

```sql
CREATE TABLE campaign (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  wind_farm_id UUID NOT NULL REFERENCES wind_farm(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Nueva tabla: `asset_document`

```sql
CREATE TABLE asset_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wind_farm_id UUID NOT NULL REFERENCES wind_farm(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Campos nuevos en `inspection`

```sql
ALTER TABLE inspection
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inspection_type TEXT DEFAULT 'blades',
  ADD COLUMN IF NOT EXISTS photos_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS viewed_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;
```

#### Campos nuevos en `turbine`

```sql
ALTER TABLE turbine
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS tower_serial_number TEXT,
  ADD COLUMN IF NOT EXISTS anticlockwise BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS powering_date TIMESTAMPTZ;
```

#### Campo nuevo en `blade`

```sql
ALTER TABLE blade
  ADD COLUMN IF NOT EXISTS serial_number TEXT;
```


### 17.4 Tipos TypeScript

```typescript
/** Aggregated wind farm detail data */
export interface WindFarmDetail {
  id: string;
  name: string;
  location: string;
  poweringDate: string | null;
  totalPower: number;
  subAssetsCount: number;
  oldestInspection: string | null;
  inspectionsCount: number;
}

/** Turbine row in the subassets table */
export interface TurbineSubassetRow {
  id: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  powerKw: number;
  poweringDate: string | null;
  lastInspection: string | null;
  inspectionsCount: number;
}

/** Campaign entity */
export interface Campaign {
  id: string;
  name: string;
  windFarmId: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Inspection within a campaign */
export interface CampaignInspection {
  id: string;
  inspectionDate: string;
  subassetName: string;
  status: InspectionStatus;
  inspectionType: string;
  photosCount: number;
  viewedPercent: number;
  defectsCount: number;
  notes: string | null;
  reportUrl: string | null;
  campaignId: string | null;
}

/** Asset document record */
export interface AssetDocument {
  id: string;
  windFarmId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

/** Serial numbers for a turbine (used in modal) */
export interface TurbineSerialNumbers {
  turbineId: string;
  turbineName: string;
  turbineSerial: string;
  bladeASerial: string;
  bladeBSerial: string;
  bladeCSerial: string;
  towerSerial: string;
  anticlockwise: boolean;
}
```


### 17.5 Funciones RPC

#### `get_wind_farm_detail(p_wind_farm_id UUID)`

Retorna una fila con datos agregados del parque: id, name, location, powering_date, total_power (SUM turbine.power_kw), sub_assets_count (COUNT turbines), oldest_inspection (MIN inspection.created_at), inspections_count.

#### `get_wind_farm_subassets(p_wind_farm_id UUID)`

Retorna filas de turbinas con: id, name, model, serial_number, power_kw, powering_date, last_inspection (MAX inspection.created_at), inspections_count (COUNT inspections vía blades).

### 17.6 Capa de Servicio

Nuevo servicio: `src/services/asset-detail.service.ts`

```typescript
export const assetDetailService = {
  // Wind Farm Detail
  getWindFarmDetail(windFarmId: string): Promise<WindFarmDetail>;
  getSubassets(windFarmId: string): Promise<TurbineSubassetRow[]>;

  // Campaigns
  getCampaigns(windFarmId: string): Promise<Campaign[]>;
  createCampaign(windFarmId: string, name: string): Promise<Campaign>;
  updateCampaign(campaignId: string, name: string): Promise<void>;
  deleteCampaign(campaignId: string): Promise<void>;
  assignInspectionsToCampaign(campaignId: string, inspectionIds: string[]): Promise<void>;
  getCampaignInspections(campaignId: string): Promise<CampaignInspection[]>;
  getWindFarmInspections(windFarmId: string): Promise<CampaignInspection[]>;

  // Serial Numbers
  getSerialNumbers(windFarmId: string): Promise<TurbineSerialNumbers[]>;
  updateSerialNumbers(serials: TurbineSerialNumbers[]): Promise<void>;

  // Documents
  getDocuments(windFarmId: string): Promise<AssetDocument[]>;
  uploadDocument(windFarmId: string, file: File): Promise<AssetDocument>;
  deleteDocument(documentId: string, filePath: string): Promise<void>;
  getDocumentUrl(filePath: string): Promise<string>;
};
```

### 17.7 Hooks de React Query

```typescript
// src/hooks/useWindFarmDetail.ts
useWindFarmDetail(windFarmId)          // queryKey: ['wind-farm-detail', id]
useSubassets(windFarmId)               // queryKey: ['wind-farm-subassets', id]
useCampaigns(windFarmId)               // queryKey: ['campaigns', id]
useCampaignInspections(campaignId)     // queryKey: ['campaign-inspections', id]
useWindFarmInspections(windFarmId)     // queryKey: ['wind-farm-inspections', id]
useCreateCampaign()                    // mutation → invalidates ['campaigns']
useUpdateCampaign()                    // mutation → invalidates ['campaigns']
useDeleteCampaign()                    // mutation → invalidates ['campaigns']
useAssignInspectionsToCampaign()       // mutation → invalidates campaign-inspections
useSerialNumbers(windFarmId)           // queryKey: ['serial-numbers', id]
useUpdateSerialNumbers()               // mutation → invalidates serial-numbers + subassets
useAssetDocuments(windFarmId)          // queryKey: ['asset-documents', id]
useUploadDocument()                    // mutation → invalidates asset-documents
useDeleteDocument()                    // mutation → invalidates asset-documents
```


### 17.8 Gestión de Estado del Componente

| Estado | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| `activeTab` | `'general' \| 'defects'` | `'general'` | Pestaña activa |
| `subassetSortField` | `string` | `'name'` | Columna de orden en tabla de turbinas |
| `subassetSortDir` | `'asc' \| 'desc'` | `'asc'` | Dirección |
| `subassetPage` | `number` | `1` | Página actual de turbinas |
| `subassetRowsPerPage` | `number` | `10` | Filas por página |
| `showSerialModal` | `boolean` | `false` | Controla visibilidad del modal serial |
| `showCampaignModal` | `boolean` | `false` | Controla visibilidad del modal campaña |
| `expandedCampaigns` | `Set<string>` | `new Set()` | IDs de campañas expandidas |

### 17.9 Especificación de Componentes UI

#### A. DetailsBlock (Organism)

```typescript
interface DetailsBlockProps {
  detail: WindFarmDetail | undefined;
  isLoading: boolean;
  onPlanInspection: () => void;
}
```

- Contenedor con padding y borde inferior
- 4 campos en grid 2×2: Oldest inspection, Powering date, Total power, Number of sub-assets
- Labels en gris claro (font-size xs), valores en negro bold (font-size sm)
- Botón "Plan a New Inspection": azul primario, ancho completo, ícono Plus

#### B. SubassetsTable (Organism)

```typescript
interface SubassetsTableProps {
  data: TurbineSubassetRow[];
  isLoading: boolean;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  onOpenSerialNumbers: () => void;
  onRowClick: (turbineId: string) => void;
}
```

- Tabla con columnas: Name↕, Model, Last Inspection, Powering Date, # Inspections
- Cabecera gris claro, filas con borde bottom 1px
- Paginación inferior (molecule TablePagination existente, opciones: 5, 10, 25, 100)
- Botón "Turbines Serial Numbers" debajo de la paginación (estilo azul outline)
- Click en fila navega al detalle de la turbina

#### C. CampaignsPanel (Organism)

```typescript
interface CampaignsPanelProps {
  windFarmId: string;
  campaigns: Campaign[];
  isLoading: boolean;
  onManageCampaigns: () => void;
  onViewResults: (campaignId: string) => void;
}
```

- Header: título "Campaigns" + botón "Manage Campaigns" (outline oscuro, alineado derecha)
- Lista vertical de CampaignAccordion (uno por campaña)

#### D. CampaignAccordion (Organism)

```typescript
interface CampaignAccordionProps {
  campaign: Campaign;
  onViewResults: (campaignId: string) => void;
  onEdit?: (campaign: Campaign) => void;
  onDelete?: (campaignId: string) => void;
}
```

- Header colapsable: chevron + nombre + "(N)" + "View Results" (azul) + menú "..." (rename, delete)
- Al expandir: tabla de inspecciones con 9 columnas (Inspection Date, Subasset name, Status, Type, Photos uploaded, Viewed %, Defects, Notes, PDF report)
- Status badges: verde "Report", azul "Annotate", gris "Pending"
- PDF column: ícono Download clickeable

#### E. TurbineSerialNumbersModal (Organism)

```typescript
interface TurbineSerialNumbersModalProps {
  windFarmId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

- Overlay oscuro + modal centrado (90% ancho, max 900px)
- Título "Turbines serial numbers" (color primario)
- Tabla editable: Name (readonly) | Turbine | Blade A | Blade B | Blade C | Tower | Anticlockwise (checkbox)
- Inputs con borde gris, fondo neutral-50
- Footer: Cancel + Update (primario, con loading)

#### F. CreateCampaignModal (Organism)

```typescript
interface CreateCampaignModalProps {
  windFarmId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

- Overlay + modal centrado
- Título "Create campaign" (color primario)
- Campo de texto "Name" (input full-width)
- Tabla de inspecciones disponibles del parque con checkboxes de selección múltiple
- Columnas: ☐ | Inspection Date↕ | Subasset | Status | Notes | Campaign (actual)
- Footer: Cancel + Save


### 17.10 Routing

Adición a `src/App.tsx`:

```typescript
const WindFarmDetailPage = lazy(() =>
  import('@/pages/WindFarmDetail').then((m) => ({ default: m.WindFarmDetail })),
);

// Nueva ruta:
<Route
  path="/assets-wind/:id"
  element={
    <AuthGuard>
      <AppLayout>
        <WindFarmDetailPage />
      </AppLayout>
    </AuthGuard>
  }
/>
```

Navegación desde `WindFarmsTable`: al hacer clic en una fila, navegar a `/assets-wind/{id}`.

### 17.11 Comportamiento UX

| Interacción | Comportamiento |
|-------------|---------------|
| Carga inicial | Skeleton blocks en DetailsBlock y SubassetsTable; campañas con loader |
| Click en fila de turbina | Navega a detalle de turbina (futuro) o muestra info inline |
| Click "Plan a New Inspection" | Navega a `/inspections/new?windFarm={id}` |
| Click "Turbines Serial Numbers" | Abre modal con datos precargados |
| Click "Add Document" | Abre file picker; upload con progreso; refresh lista |
| Click "Manage Campaigns" | Abre modal con lista de inspecciones seleccionables |
| Expandir/colapsar campaña | Toggle local; lazy-load inspecciones al expandir |
| Click "View Results" | Navega a `/campaigns/{id}/results` |
| Click Download PDF | Valida permisos, descarga reporte en nueva pestaña |
| Tab "Defects" | Muestra DefectsWindFarmsView filtrado por wind_farm_id actual |
| Responsive (<1024px) | Columnas colapsan a vertical; campañas debajo de detalles |

### 17.12 Storage Bucket

Nuevo bucket privado: `asset-documents`
- Lectura: usuarios autenticados (signed URLs de 1h)
- Escritura: supervisores y admins
- Eliminación: supervisores y admins
- Estructura de paths: `{wind_farm_id}/{timestamp}-{filename}`

### 17.13 Migración SQL Requerida

```sql
-- Migration: Asset Detail View support

-- 1. Campaign table
CREATE TABLE IF NOT EXISTS campaign (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  wind_farm_id UUID NOT NULL REFERENCES wind_farm(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaign_wind_farm_id ON campaign(wind_farm_id);

-- 2. Campaign_id in inspection
ALTER TABLE inspection
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL;

-- 3. Serial number fields
ALTER TABLE turbine
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS tower_serial_number TEXT,
  ADD COLUMN IF NOT EXISTS anticlockwise BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS powering_date TIMESTAMPTZ;
ALTER TABLE blade ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- 4. Inspection extra fields
ALTER TABLE inspection
  ADD COLUMN IF NOT EXISTS inspection_type TEXT DEFAULT 'blades',
  ADD COLUMN IF NOT EXISTS photos_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS viewed_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. Asset documents table
CREATE TABLE IF NOT EXISTS asset_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wind_farm_id UUID NOT NULL REFERENCES wind_farm(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. RLS for campaign and asset_document
ALTER TABLE campaign ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_document ENABLE ROW LEVEL SECURITY;
-- (policies: authenticated SELECT, supervisor/admin ALL)

-- 7. RPC functions: get_wind_farm_detail, get_wind_farm_subassets
-- (see 17.5 for full definitions)
```


### 17.14 Decisiones de Diseño Específicas

| Decisión | Justificación |
|----------|--------------|
| Servicio dedicado `asset-detail.service.ts` | Separación de responsabilidades; el `assets.service.ts` existente maneja CRUD simple, el detalle es más complejo |
| Campañas como tabla separada | Relación 1:N con inspecciones (una inspección puede pertenecer a una campaña); permite agrupación flexible |
| `campaign_id` nullable en inspection | Una inspección puede existir sin campaña; ON DELETE SET NULL preserva inspecciones si se borra la campaña |
| Document storage con tabla de tracking | Necesitamos metadata (nombre original, tamaño, quién subió) que el bucket de Storage no provee por sí solo |
| Signed URLs de 1h para documentos | Balance entre seguridad (URLs expiran) y usabilidad (1h es suficiente para consulta) |
| Modal para serial numbers (no inline edit) | Son datos técnicos críticos; edición en modal da contexto completo y permite cancelar |
| Lazy-load inspecciones al expandir campaña | Evita N+1 queries al cargar la página; solo se consultan inspecciones de campañas que el usuario expande |
| Two-column layout con flex 35/65 | Replica el diseño de la imagen de referencia; la columna de campañas necesita más espacio por la tabla ancha |
| Tabs General/Defects en vez de nueva ruta | Mantiene contexto del parque sin navegación adicional; la pestaña Defects reutiliza componente existente con filtro |

---

## 18. Reporte Global de Campaña (Campaign Results View)

### 18.1 Visión General

Vista de reporte consolidado de una campaña de inspección, accesible desde el botón "View Results" en cada campaña. La ruta es `/campaigns/:id/results`. Presenta un layout cuadripartito: mapa de turbinas (superior izquierda), resumen de defectos con listado por turbina (superior derecha), gráficos estadísticos (inferior izquierda), y galería de imágenes por categoría (inferior derecha).

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  [Asset] > Global report of campaign [Name]    [🔍] [EXPORT CSV] [SHARE]            │
│  Campaign of [date]                                                                  │
├─────────────────────────────────┬───────────────────────────────────────────────────┤
│  MAP (satellite + markers)      │  DEFECT SUMMARY                                   │
│  ┌───────────────────────────┐  │  ┌──────────────────────────────────────────────┐ │
│  │   [WT01] [WT02]           │  │  │  0    44    149    11     0    │ 0 resolved  │ │
│  │      [WT03]               │  │  │ Cat5  Cat4  Cat3  Cat2  Cat1  │ 204 defects │ │
│  │  [WT04]    [route lines]  │  │  ├──────────────────────────────────────────────┤ │
│  │       [WT05]              │  │  │ ▼ ☐ Turbine WT01  [badges]  0/22 resolved   │ │
│  │  [+ / -]                  │  │  │ ▼ ☐ Turbine WT02  [badges]  0/36 resolved   │ │
│  └───────────────────────────┘  │  │ ▼ ☐ Turbine WT03  [badges]  0/36 resolved   │ │
│                                  │  │ ▼ ☐ Turbine WT04  [badges]  0/22 resolved   │ │
│                                  │  └──────────────────────────────────────────────┘ │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│  CHARTS                         │  IMAGE GALLERY                                     │
│  ┌──────────┐ ┌──────────────┐  │  ┌──────────────────────────────────────────────┐ │
│  │Defect cat│ │Defect type   │  │  │  Category 4                                  │ │
│  │repartit. │ │repartition   │  │  │  [img] [img] [img] [img]                     │ │
│  │(stacked) │ │(stacked)     │  │  │  [img] [img]                                 │ │
│  └──────────┘ └──────────────┘  │  └──────────────────────────────────────────────┘ │
└─────────────────────────────────┴───────────────────────────────────────────────────┘
```


### 18.2 Arquitectura de Componentes

```
src/pages/CampaignResults.tsx (route-level, lazy-loaded)
├── Breadcrumb: [Asset Name] > Global report of campaign [Campaign Name]
├── Subtitle: "Campaign of [date]"
├── Actions: Export CSV + Share buttons
├── Grid Layout (2×2):
│   ├── TopLeft: TurbineMapPanel (organism)
│   │   └── Mapa satelital con marcadores de turbinas + rutas de vuelo
│   ├── TopRight: DefectSummaryPanel (organism)
│   │   ├── CategoryBadgesBar (molécula) — badges Cat5-Cat1 + resolved/total
│   │   └── TurbineResultsList (organism, accordions colapsables)
│   │       └── TurbineResultRow[] — badges por turbina, expandible a blades
│   ├── BottomLeft: CampaignChartsPanel (organism)
│   │   ├── DefectCategoryChart (Recharts stacked bar)
│   │   └── DefectTypeChart (Recharts stacked bar)
│   └── BottomRight: DefectImageGallery (organism)
│       └── Grid de thumbnails agrupado por categoría
```

#### Componentes Nuevos

| Componente | Ubicación | Tipo |
|------------|-----------|------|
| `CampaignResults` | `src/pages/CampaignResults.tsx` | Page |
| `TurbineMapPanel` | `src/components/organisms/TurbineMapPanel.tsx` | Organism |
| `DefectSummaryPanel` | `src/components/organisms/DefectSummaryPanel.tsx` | Organism |
| `TurbineResultsList` | `src/components/organisms/TurbineResultsList.tsx` | Organism |
| `CampaignChartsPanel` | `src/components/organisms/CampaignChartsPanel.tsx` | Organism |
| `DefectImageGallery` | `src/components/organisms/DefectImageGallery.tsx` | Organism |
| `CategoryBadgesBar` | `src/components/molecules/CategoryBadgesBar.tsx` | Molecule |

### 18.3 Modelo de Datos

```typescript
/** Campaign results summary per turbine */
export interface CampaignTurbineResult {
  turbineId: string;
  turbineName: string;
  defectsByCat: Record<number, number>; // cat 1-5 → count
  resolvedCount: number;
  totalDefects: number;
  blades: {
    position: string;       // "A" | "B" | "C"
    defectsByCat: Record<number, number>;
    resolvedCount: number;
    totalDefects: number;
  }[];
}

/** Defect image for gallery */
export interface CampaignDefectImage {
  id: string;
  url: string;
  category: number;
  turbineName: string;
  defectType: string;
}
```

### 18.4 Capa de Servicio

Extensión de `asset-detail.service.ts`:

```typescript
// Campaign Results
getCampaignResults(campaignId: string): Promise<{
  campaign: Campaign;
  windFarm: { id: string; name: string };
  totalDefects: number;
  resolvedCount: number;
  defectsByCat: Record<number, number>;
  turbineResults: CampaignTurbineResult[];
}>;

getCampaignDefectImages(campaignId: string): Promise<CampaignDefectImage[]>;

exportCampaignCSV(campaignId: string): Promise<Blob>;
```

### 18.5 Hooks

```typescript
useCampaignResults(campaignId)           // queryKey: ['campaign-results', id]
useCampaignDefectImages(campaignId)      // queryKey: ['campaign-defect-images', id]
```


### 18.6 Especificación de Componentes

#### A. CategoryBadgesBar (Molecule)

```typescript
interface CategoryBadgesBarProps {
  defectsByCat: Record<number, number>;
  resolvedCount: number;
  totalDefects: number;
}
```

- 5 badges horizontales (Cat 5 → Cat 1) con conteo
- Colores: Cat5=rojo, Cat4=naranja, Cat3=amarillo, Cat2=azul, Cat1=verde/gris
- Panel lateral verde: "X resolved" / "Y defects"

#### B. TurbineResultsList (Organism)

- Lista de turbinas como acordeones colapsables
- Cada turbina: checkbox + nombre + badges de categoría + "X / Y resolved" + iconos (download, copy, open)
- Al expandir: muestra desglose por pala (BLADE A, B, C) con sus propios badges

#### C. TurbineMapPanel (Organism)

- Mapa satelital (placeholder con imagen estática o integración Leaflet/Mapbox)
- Marcadores posicionales para cada turbina
- Controles zoom (+/-), checkbox "Select all"
- Polylines naranjas representando rutas de vuelo del dron

#### D. CampaignChartsPanel (Organism)

- Dos gráficos Recharts stacked bar side by side:
  - "Turbine defect category repartition" (eje X: turbinas, stacks: categorías)
  - "Turbine defect type repartition" (eje X: turbinas, stacks: tipos de defecto)
- Colores consistentes con badges de categoría

#### E. DefectImageGallery (Organism)

- Agrupación por categoría con título coloreado (ej. "Category 4" en naranja)
- Grid de thumbnails (4-5 por fila)
- Click en imagen abre lightbox
- Borde de color según categoría

### 18.7 Routing

```typescript
const CampaignResultsPage = lazy(() =>
  import('@/pages/CampaignResults').then((m) => ({ default: m.CampaignResults })),
);

<Route
  path="/campaigns/:id/results"
  element={
    <AuthGuard>
      <AppLayout>
        <CampaignResultsPage />
      </AppLayout>
    </AuthGuard>
  }
/>
```

### 18.8 Decisiones de Diseño

| Decisión | Justificación |
|----------|--------------|
| Layout cuadripartito (2×2 grid) | Replica el diseño de referencia; cada cuadrante tiene función específica |
| Mapa como placeholder inicial | Integración de mapas satelitales reales (Leaflet + tiles) es compleja; se implementa en fase posterior |
| Recharts para gráficos | Consistente con el dashboard existente (sección 12); stacked bars ya implementadas |
| Galería agrupada por categoría | Permite identificación visual rápida de severidad; prioriza Cat4/5 visualmente |
| Acordeón expandible por turbina | Permite navegación progresiva sin sobrecargar con datos de todas las palas a la vez |
| Export CSV para todas las turbinas | Caso de uso frecuente: compartir datos con cliente o equipo de mantenimiento |

---

## 19. Inspección Detallada — Flujo de 4 Pasos (Inspection Workflow)

### 19.1 Visión General

Vista de inspección detallada de una turbina que presenta un flujo secuencial de 4 pasos con stepper horizontal. Cada paso tiene un layout específico optimizado para su función. Accesible desde la tabla de inspecciones en una campaña o desde la lista general de inspecciones. La ruta es `/inspections/:id/workflow`.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  [Asset] > Turbine [WTxx] > [Date]                                    [🔍]       │
│           ┌─────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐          │
│           │1.INSPECT│────│2.ANNOTATE │────│3.ANALYZE │────│4.RESULTS │          │
│           └─────────┘    └───────────┘    └──────────┘    └──────────┘          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                    [ STEP CONTENT — varies by active step ]                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```


### 19.2 Arquitectura de Componentes

```
src/pages/InspectionWorkflow.tsx (route-level, lazy-loaded)
├── Breadcrumb: [Asset] > Turbine [WTxx] > [Date]
├── WorkflowStepper (molecule nuevo)
│   └── 4 steps: INSPECT | ANNOTATE | ANALYZE | RESULTS
├── Step 1 — InspectStep (organism)
│   ├── LeftPanel: InspectionDetailsCard + DocumentDropbox + TurbineMap
│   └── RightPanel: ProgressIndicator + AcquisitionTable + PhotoUploadTable
├── Step 2 — AnnotateStep (organism)
│   ├── LeftPanel: ThumbnailGrid + BladeSelector + SideSelector
│   ├── CenterPanel: FullImageViewer (zoom, navigate, annotate tools)
│   └── RightPanel: ComparisonPanel + ExifMetadata + TurbineInfo + BladeChanger
├── Step 3 — AnalyzeStep (organism)
│   ├── LeftPanel: AnnotationsList (por pala)
│   ├── CenterPanel: DefectEditor (imagen + formulario de clasificación)
│   └── RightPanel: SummaryReviews (resumen por pala con tabla de defectos)
└── Step 4 — ResultsStep (organism)
    ├── LeftPanel: BladesDiagramFull (3 palas con puntos de defectos + conclusión)
    └── RightPanel: ResultsTabs (Statistics | Details)
        ├── Statistics: DonutCharts + CategoryBreakdown + TypeChart + OverviewTable
        └── Details: DefectsDetailTable + DefectPreview (nota, causa, imagen)
```

#### Componentes Nuevos

| Componente | Ubicación | Tipo |
|------------|-----------|------|
| `InspectionWorkflow` | `src/pages/InspectionWorkflow.tsx` | Page |
| `WorkflowStepper` | `src/components/molecules/WorkflowStepper.tsx` | Molecule |
| `InspectStep` | `src/components/organisms/InspectStep.tsx` | Organism |
| `AnnotateStep` | `src/components/organisms/AnnotateStep.tsx` | Organism |
| `AnalyzeStep` | `src/components/organisms/AnalyzeStep.tsx` | Organism |
| `ResultsStep` | `src/components/organisms/ResultsStep.tsx` | Organism |
| `InspectionDetailsCard` | `src/components/organisms/InspectionDetailsCard.tsx` | Organism |
| `ThumbnailGrid` | `src/components/organisms/ThumbnailGrid.tsx` | Organism |
| `FullImageViewer` | `src/components/organisms/FullImageViewer.tsx` | Organism |
| `DefectEditor` | `src/components/organisms/DefectEditor.tsx` | Organism |
| `BladesDiagramFull` | `src/components/organisms/BladesDiagramFull.tsx` | Organism |
| `SummaryReviews` | `src/components/organisms/SummaryReviews.tsx` | Organism |
| `ResultsStatistics` | `src/components/organisms/ResultsStatistics.tsx` | Organism |
| `ResultsDetails` | `src/components/organisms/ResultsDetails.tsx` | Organism |


### 19.3 Modelo de Datos del Workflow

```typescript
/** Inspection workflow data (complete context for all 4 steps) */
export interface InspectionWorkflowData {
  inspection: Inspection;
  windFarm: { id: string; name: string };
  turbine: { id: string; name: string; model: string; powerKw: number; commissioningDate: string };
  blades: { id: string; position: number; serialNumber: string }[];
  defects: WorkflowDefect[];
  evidence: WorkflowEvidence[];
  acquisitionData: AcquisitionData | null;
}

/** Evidence with review/annotation state */
export interface WorkflowEvidence {
  id: string;
  url: string;
  thumbnailUrl: string;
  status: 'unseen' | 'tagged' | 'annotated';
  bladePosition: number | null;
  side: string | null;
  rootDistance: number | null;
  exifData: Record<string, string> | null;
}

/** Defect within workflow context */
export interface WorkflowDefect {
  id: string;
  type: string;
  category: number;
  blade: string;        // "A" | "B" | "C"
  side: string;         // "LE" | "SS" | "TE" | "PS"
  rootDistance: number;
  defectSize: string;   // "W x H"
  note: string | null;
  rootCause: string | null;
  nextStep: string | null;
  resolved: boolean;
  imageUrls: string[];
}

/** Acquisition metadata */
export interface AcquisitionData {
  dateTime: string;
  photosCount: number;
  taggedPhotos: number;
  inspectionDuration: string;  // ej. "14 minutes"
  rtkStatus: string;           // ej. "Fixed (100%)"
}
```

### 19.4 Gestión de Estado

| Estado | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| `currentStep` | `1 \| 2 \| 3 \| 4` | `1` | Paso activo del stepper |
| `completedSteps` | `Set<number>` | `new Set()` | Pasos completados (navegables) |
| `selectedBladeTab` | `string` | `'A'` | Pala seleccionada en Annotate/Analyze |
| `selectedSide` | `string` | `'LE'` | Lado seleccionado |
| `selectedImageIndex` | `number` | `0` | Imagen actual en el visor |
| `selectedDefectId` | `string \| null` | `null` | Defecto seleccionado en tabla Results |
| `reviewProgress` | `number` | `0` | % de imágenes revisadas |
| `resultsTab` | `'statistics' \| 'details'` | `'statistics'` | Tab activa en Results |

### 19.5 Especificación de Componentes Clave

#### A. WorkflowStepper (Molecule)

```typescript
interface WorkflowStepperProps {
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}
```

- 4 steps horizontales conectados por líneas
- Paso activo: fondo azul sólido, texto blanco
- Paso completado: checkmark verde, clickeable
- Paso futuro: gris, no clickeable
- Labels: "1. INSPECT", "2. ANNOTATE", "3. ANALYZE", "4. RESULTS"

#### B. InspectStep (Organism)

- **Left Panel:** Card con campos readonly (Asset Name, Inspection type, Turbine, Model, Date, Notes con edición inline, Legislation en rojo, Weather info). + DocumentDropbox + Mapa satelital con marcador.
- **Right Panel:** Barra de progreso (2 checkpoints verdes "Complete"). + Tabla "Acquisition" (date/time, photos, tagged, duration, RTK status). + Tabla "Photo upload" (uploaded, pending).

#### C. AnnotateStep (Organism)

- **Left Panel:** Grid 6×N de thumbnails con borde de selección. Contadores: UNSEEN (naranja), TAGGED (azul), ANNOT (verde). Selector de pala (A/B/C tabs) + lado (SS/PS/LE/TL). Esquema de pala con indicador de posición.
- **Center Panel:** Imagen full-size con controles de navegación (prev/next), "Fast forward mode" toggle, barra de info (Blade, Side, Root distance, Distance to blade). Progress bar "Review progress: X%". Botones: marcar defecto (azul), eliminar (rojo), toggle contraste.
- **Right Panel:** Comparison (checkboxes de inspecciones anteriores). EXIF metadata (original name, type, aperture, exposure, ISO, date, dimensions). Turbine info (model, power, commissioning). Change vertical blade (selector + diagrama clockwise/anticlockwise + Save).

#### D. AnalyzeStep (Organism)

- **Left Panel:** Tabs BLADE A/B/C con badge de conteo. Lista de anotaciones pendientes. Mensaje "All annotations processed" cuando vacío.
- **Center Panel — Defect Editor:** Imagen del defecto con overlays (distancia, lado). Navegación entre imágenes (< >). Campos: Type (dropdown), Category (1-5 visual selector), Root distance (input), Blade face (dropdown). "Automatic category suggestions" colapsable. Note, Root cause, Next step (textareas con X para limpiar). Botones: Clear + Save as Defect.
- **Right Panel — Summary:** Acordeones por pala (Blade A/B/C con conteo). Tabla resumen: #, Type, Face, Category, Root(m), Copy. Click en fila carga en editor. Blade notes textarea. SubAsset total + SubAsset notes.

#### E. ResultsStep (Organism)

- **Left Panel — Blades Diagram:** 3 siluetas de palas (A, B, C) con serial numbers. Escala vertical 0-43m. Puntos naranjas en posiciones de defectos. Badges rojos para severidad alta. Contadores: "[X] defects" + "[Y] resolved". Sección "Conclusion" (texto por turbina y por pala). Botón "Plan Next Inspection" (azul, ancho completo).
- **Right Panel — Statistics tab:** Donut charts por pala (Blade A, B, C con %). Breakdown by category (badges Cat5-Cat1). Breakdown by type (bar chart). Defect overview table (tipos × categorías con totales).
- **Right Panel — Details tab:** Tabla con filtros por columna: Id, Type↕, Category↕, Blade↕, Side↕, Root distance↕, Defect size, Edit, Resolved(toggle). Al seleccionar fila: Note, Root cause, Next step + Comments section + Image viewer con zoom.


### 19.6 Routing

```typescript
const InspectionWorkflowPage = lazy(() =>
  import('@/pages/InspectionWorkflow').then((m) => ({ default: m.InspectionWorkflow })),
);

<Route
  path="/inspections/:id/workflow"
  element={
    <AuthGuard>
      <AppLayout>
        <InspectionWorkflowPage />
      </AppLayout>
    </AuthGuard>
  }
/>
```

### 19.7 Hooks Adicionales

```typescript
useInspectionWorkflow(inspectionId)       // queryKey: ['inspection-workflow', id]
useUpdateInspectionNotes()                // mutation
useMarkImageReviewed()                    // mutation
useSaveDefect()                           // mutation (create/update)
useDeleteDefect()                         // mutation
useResolveDefect()                        // mutation (toggle resolved)
```

### 19.8 Comportamiento UX

| Interacción | Comportamiento |
|-------------|---------------|
| Stepper navigation | Solo pasos completados son clickeables; paso actual resaltado |
| Fast forward mode | Avanza automáticamente al siguiente imagen no vista cada 2s |
| Image annotation | Click en thumbnail → carga en visor central; teclas ←/→ para navegar |
| Defect classification | Formulario pre-rellena datos del contexto (blade, side, distance) |
| Auto-save on step change | Al avanzar de paso, se guardan datos pendientes automáticamente |
| Responsive | Steps se reorganizan verticalmente en mobile; panels se apilan |
| Keyboard shortcuts | Flechas para navegar imágenes; Enter para guardar; Esc para cancelar |

### 19.9 Decisiones de Diseño

| Decisión | Justificación |
|----------|--------------|
| Stepper horizontal de 4 pasos | Replica el flujo UX de la referencia; guía al inspector secuencialmente |
| Layout variable por paso | Cada paso tiene necesidades diferentes (visor de imágenes vs formularios vs estadísticas) |
| Fast forward mode | Optimiza el tiempo de revisión para inspecciones con cientos de fotos |
| Defect Editor como panel central | El inspector necesita ver la imagen y el formulario simultáneamente |
| Donut charts + bar charts en Results | Visualización complementaria: distribución proporcional (donut) + comparación absoluta (bars) |
| Defect table con filtros por columna | Dataset puede ser grande (22+ defectos); filtros permiten focalizar en categorías específicas |
| Conclusión editable por pala | Permite documentar observaciones generales que no son defectos puntuales |
| "Plan Next Inspection" en Results | Cierra el ciclo de trabajo: al terminar resultados, planificar la siguiente inspección |
| Ruta `/inspections/:id/workflow` | Separada de `/inspections/:id` (detalle simple existente) para no romper la vista existente |


---

## 20. Módulo de Planificación y Registro de Nueva Inspección (RF-002)

### 20.1 Visión General

El módulo reemplaza la página actual de creación de inspecciones (`NewInspection.tsx`) con un formulario avanzado de planificación de campañas de inspección. Accesible desde la ruta `/inspections/new` (o desde el botón "Plan a New Inspection" en la ficha del parque). Presenta un layout de 3 columnas: formulario de configuración (izquierda ~25%), tabla de selección de subactivos/turbinas (centro ~35%), y mapa meteorológico en tiempo real via iframe de Windy.com (derecha ~40%).

El formulario permite:
- Seleccionar el parque eólico (asset) con búsqueda.
- Elegir tipo de inspección (BLADES/TOWER) y método (SKYVISOR/External).
- Definir fecha de inspección con DatePicker.
- Nombrar la campaña (auto-sugerido como "Mes Año").
- Agregar notas opcionales.
- Activar/desactivar notificaciones por correo.
- Seleccionar qué turbinas incluir en la inspección.
- Consultar pronóstico meteorológico del sitio antes de confirmar.

Al crear, se genera una campaña con N inspecciones individuales (una por turbina seleccionada) en estado `scheduled`.


```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Create new inspection                            [ 🔍 Search all ]                       │
├──────────────────────┬──────────────────────────────────┬────────────────────────────────┤
│  FORMULARIO (~25%)   │  SUBACTIVOS (~35%)               │  MAPA METEO (~40%)             │
│  ┌────────────────┐  │  ┌────────────────────────────┐  │  ┌──────────────────────────┐  │
│  │ Asset:         │  │  │ ☑ □  Name  Model  LastInsp │  │  │  [WINDY.COM IFRAME]      │  │
│  │ [Fila de Mog▾] │  │  │ ☑ 🌀 WT01  V90   1 months│  │  │  Mapa de viento centrado │  │
│  │                │  │  │ ☑ 🌀 WT02  V90   1 months│  │  │  en coords del parque    │  │
│  │ Type:          │  │  │ ☑ 🌀 WT03  V90   1 months│  │  │                          │  │
│  │ [BLADES|TOWER] │  │  │ ☑ 🌀 WT04  V90   1 months│  │  │  +/- zoom               │  │
│  │                │  │  │ ☑ 🌀 WT05  V90   1 months│  │  │                          │  │
│  │ Method:        │  │  │ ☑ 🌀 WT06  V90   1 months│  │  └──────────────────────────┘  │
│  │ [SKYVISOR|Ext] │  │  │ ☑ 🌀 WT07  V90   1 months│  │  ┌──────────────────────────┐  │
│  │                │  │  └────────────────────────────┘  │  │  Miérc 15 │ Juev 16 │ Vi│  │
│  │ Inspection Date│  │                                  │  │  Temp: 22° 23° 24° ...  │  │
│  │ [15/07/2026 📅]│  │                                  │  │  Lluvia: 0.4 0.5 ...    │  │
│  │                │  │                                  │  │  Viento: 7 7 6 4 3 5 .. │  │
│  │ Campaign name* │  │                                  │  └──────────────────────────┘  │
│  │ [July 2026   ] │  │                                  │                                │
│  │                │  │                     [CREATE]     │                                │
│  │ Notes:         │  │                                  │                                │
│  │ [            ] │  │                                  │                                │
│  │                │  │                                  │                                │
│  │ 🟢 Subscribe…  │  │                                  │                                │
│  └────────────────┘  │                                  │                                │
└──────────────────────┴──────────────────────────────────┴────────────────────────────────┘
```


### 20.2 Arquitectura de Componentes

```
src/pages/NewInspection.tsx (REESCRITA — route-level, lazy-loaded)
├── Encabezado: "Create new inspection" + SearchBar global
├── ThreeColumnLayout (CSS grid/flex)
│   ├── LeftColumn — InspectionConfigForm (organism nuevo)
│   │   ├── AssetSelector (molecule nuevo — dropdown con búsqueda)
│   │   ├── SegmentedControl (molecule nuevo — para Type y Method)
│   │   ├── DatePickerField (molecule nuevo — input con máscara DD/MM/YYYY + icono calendario)
│   │   ├── FormField (molecule existente — Campaign name)
│   │   ├── TextArea nativo (Notes)
│   │   └── NotificationToggle (atom — switch con label)
│   ├── CenterColumn — SubassetsSelectionPanel (organism nuevo)
│   │   ├── Encabezado "Subassets" + Master Checkbox
│   │   ├── SubassetsSelectionTable (organism nuevo)
│   │   │   ├── Filas con: checkbox, icono turbina, nombre, modelo, last inspection, last defects
│   │   │   └── Skeleton loader durante carga
│   │   └── CreateButton (atom Button — "CREATE", alineado inferior derecho)
│   └── RightColumn — WeatherMapPanel (organism nuevo)
│       └── WindyIframe (iframe embebido con coordenadas dinámicas)
```

#### Jerarquía de Componentes Nuevos

| Componente | Ubicación | Tipo | Responsabilidad |
|------------|-----------|------|-----------------|
| `NewInspection` (reescrita) | `src/pages/NewInspection.tsx` | Page | Layout de 3 columnas, orquesta formulario completo |
| `InspectionConfigForm` | `src/components/organisms/InspectionConfigForm.tsx` | Organism | Panel izquierdo con todos los campos de configuración |
| `SubassetsSelectionPanel` | `src/components/organisms/SubassetsSelectionPanel.tsx` | Organism | Panel central con tabla de turbinas seleccionables |
| `WeatherMapPanel` | `src/components/organisms/WeatherMapPanel.tsx` | Organism | Panel derecho con iframe Windy |
| `SegmentedControl` | `src/components/molecules/SegmentedControl.tsx` | Molecule | Botones de selección única (Type, Method) |
| `DatePickerField` | `src/components/molecules/DatePickerField.tsx` | Molecule | Input de fecha con formato DD/MM/YYYY e icono calendario |
| `AssetSelector` | `src/components/molecules/AssetSelector.tsx` | Molecule | Dropdown de parques eólicos con búsqueda |
| `NotificationToggle` | `src/components/atoms/NotificationToggle.tsx` | Atom | Toggle switch con etiqueta de suscripción |


### 20.3 Modelo de Datos

#### Tipos TypeScript Nuevos

```typescript
/** Tipo de inspección */
export type InspectionType = 'blades' | 'tower';

/** Método de inspección */
export type InspectionMethod = 'skyvisor' | 'external';

/** Turbina con datos para la tabla de selección de subactivos */
export interface SubassetSelectionRow {
  id: string;
  name: string;
  model: string | null;
  lastInspectionDate: string | null;     // tiempo transcurrido (ej. "1 months")
  lastDefectsCount: number;              // defectos detectados en última inspección
  selected: boolean;                     // si está seleccionada para la campaña
}

/** Input para la creación de campaña + inspecciones desde el formulario */
export interface CreateCampaignInspectionInput {
  windFarmId: string;
  campaignName: string;
  inspectionType: InspectionType;
  inspectionMethod: InspectionMethod;
  scheduledDate: string;                 // ISO date string
  notes: string;
  subscribeNotifications: boolean;
  selectedTurbineIds: string[];          // IDs de turbinas seleccionadas
}

/** Coordenadas geográficas de un parque (para el iframe Windy) */
export interface WindFarmCoordinates {
  latitude: number;
  longitude: number;
}
```

#### Campos adicionales requeridos en `wind_farm`

```sql
ALTER TABLE wind_farm
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;
```

Nota: Estos campos permiten centrar el iframe de Windy en las coordenadas del parque seleccionado.

#### Relación con tablas existentes

El flujo de creación utiliza:
1. `campaign` (tabla existente de sección 17) — se crea la campaña con nombre + wind_farm_id.
2. `inspection` (tabla existente) — se crean N inspecciones (una por turbina) con campaign_id, inspection_type, scheduled_date, notes.

No se requieren nuevas tablas; se reutilizan las ya definidas en la migración de Asset Detail (sección 17).


### 20.4 Capa de Servicio

Nuevo archivo: `src/services/new-inspection.service.ts`

```typescript
export const newInspectionService = {
  /**
   * Obtiene las turbinas de un parque con datos de última inspección y defectos
   * para la tabla de selección de subactivos.
   */
  async getSubassetsForSelection(windFarmId: string): Promise<SubassetSelectionRow[]>;

  /**
   * Obtiene las coordenadas geográficas de un parque eólico para el iframe de Windy.
   */
  async getWindFarmCoordinates(windFarmId: string): Promise<WindFarmCoordinates | null>;

  /**
   * Crea una campaña con múltiples inspecciones asociadas.
   * 1. Crea la campaña con el nombre proporcionado.
   * 2. Para cada turbina seleccionada, obtiene la primera blade y crea una inspección
   *    con status 'in_progress', stage 'planned', campaign_id, inspection_type, notes.
   * 3. Si subscribeNotifications es true, invoca Edge Function de notificación.
   * Retorna la campaña creada y los IDs de las inspecciones.
   */
  async createCampaignWithInspections(
    input: CreateCampaignInspectionInput
  ): Promise<{ campaign: Campaign; inspectionIds: string[] }>;
};
```

#### Estrategia de `getSubassetsForSelection`:

```sql
-- Consulta conceptual (implementada client-side con Supabase SDK):
SELECT
  t.id, t.name, t.model,
  MAX(i.created_at) AS last_inspection_date,
  (SELECT COUNT(*) FROM defect d WHERE d.inspection_id = last_insp.id) AS last_defects_count
FROM turbine t
LEFT JOIN blade b ON b.turbine_id = t.id
LEFT JOIN inspection i ON i.blade_id = b.id
WHERE t.wind_farm_id = :windFarmId
GROUP BY t.id, t.name, t.model
ORDER BY t.name;
```

Se implementará client-side reutilizando `assetDetailService.getSubassets()` existente, con un query adicional para los defectos de la última inspección de cada turbina.


### 20.5 Hooks de React Query

```typescript
// src/hooks/useNewInspection.ts

/** Lista de parques eólicos para el selector de Asset */
export function useWindFarmsList() {
  return useQuery({
    queryKey: ['wind-farms-list'],
    queryFn: () => assetsService.getWindFarms(),
  });
}

/** Subactivos (turbinas) del parque seleccionado con datos de última inspección */
export function useSubassetsForSelection(windFarmId: string | null) {
  return useQuery({
    queryKey: ['subassets-selection', windFarmId],
    queryFn: () => newInspectionService.getSubassetsForSelection(windFarmId!),
    enabled: !!windFarmId,
  });
}

/** Coordenadas del parque para el iframe meteorológico */
export function useWindFarmCoordinates(windFarmId: string | null) {
  return useQuery({
    queryKey: ['wind-farm-coordinates', windFarmId],
    queryFn: () => newInspectionService.getWindFarmCoordinates(windFarmId!),
    enabled: !!windFarmId,
  });
}

/** Mutación para crear campaña + inspecciones */
export function useCreateCampaignInspections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInspectionInput) =>
      newInspectionService.createCampaignWithInspections(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}
```


### 20.6 Validación (Zod)

Nuevo schema en `src/utils/validation.ts`:

```typescript
export const newCampaignInspectionSchema = z.object({
  windFarmId: z.string().uuid('Debe seleccionar un parque eólico'),
  campaignName: z.string().min(1, 'El nombre de campaña es obligatorio'),
  inspectionType: z.enum(['blades', 'tower']),
  inspectionMethod: z.enum(['skyvisor', 'external']),
  scheduledDate: z.string().min(1, 'La fecha de inspección es obligatoria'),
  notes: z.string().optional().default(''),
  subscribeNotifications: z.boolean().default(true),
  selectedTurbineIds: z
    .array(z.string().uuid())
    .min(1, 'Debe seleccionar al menos una turbina'),
});

export type NewCampaignInspectionFormData = z.infer<typeof newCampaignInspectionSchema>;
```

### 20.7 Gestión de Estado del Componente

Estado local de la página `NewInspection`:

| Estado | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| `windFarmId` | `string \| null` | URL param `?windFarm=` o primer parque | Parque seleccionado |
| `inspectionType` | `InspectionType` | `'blades'` | Tipo de inspección |
| `inspectionMethod` | `InspectionMethod` | `'skyvisor'` | Método de inspección |
| `scheduledDate` | `string` | Fecha actual (DD/MM/YYYY) | Fecha planificada |
| `campaignName` | `string` | `"[MesActual] [AñoActual]"` | Nombre de campaña |
| `notes` | `string` | `''` | Notas opcionales |
| `subscribeNotifications` | `boolean` | `true` | Toggle de email |
| `selectedTurbineIds` | `string[]` | Todos los IDs | Turbinas seleccionadas |
| `errors` | `Record<string, string>` | `{}` | Errores de validación |

#### Flujo de datos:

```
useWindFarmsList() → opciones del dropdown Asset
  → usuario selecciona windFarmId
    → useSubassetsForSelection(windFarmId) → tabla de turbinas
    → useWindFarmCoordinates(windFarmId) → iframe Windy se actualiza
    → selectedTurbineIds se inicializa con todos los IDs

Al hacer clic CREATE:
  → validar con newCampaignInspectionSchema
  → si válido → useCreateCampaignInspections.mutate(input)
  → onSuccess → toast + redirect a /inspections o /assets-wind/:id
```


### 20.8 Especificación de Componentes UI

#### A. SegmentedControl (Molecule)

```typescript
interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  name: string;        // para aria-label
  disabled?: boolean;
}
```

Estilos:
- Contenedor: `display: inline-flex; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--color-neutral-200);`
- Opción activa: `background: #00A3E0; color: white; font-weight: 600;`
- Opción inactiva: `background: var(--color-neutral-50); color: var(--color-neutral-700);`
- Hover inactiva: `background: var(--color-neutral-100);`
- Transición suave entre estados (150ms ease).
- Cada opción: `padding: var(--space-2) var(--space-4); cursor: pointer;`

#### B. DatePickerField (Molecule)

```typescript
interface DatePickerFieldProps {
  label: string;
  value: string;           // DD/MM/YYYY
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}
```

- Input con máscara `DD/MM/YYYY` (auto-formato al escribir).
- Icono de calendario (Calendar de Lucide) a la derecha como botón.
- Click en icono abre input nativo `type="date"` (fallback) o un mini-calendario.
- Borde gris (#D1D5DB), focus ring azul, fondo blanco.
- Error: borde rojo + mensaje inline.

#### C. AssetSelector (Molecule)

```typescript
interface AssetSelectorProps {
  windFarms: { id: string; name: string }[];
  value: string | null;
  onChange: (windFarmId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}
```

- Dropdown nativo `<select>` estilizado con chevron.
- Opciones: lista de parques eólicos disponibles.
- Si hay muchos parques, permite búsqueda dentro del dropdown (filtrado local).
- Muestra "Seleccionar parque..." como placeholder cuando no hay valor.
- Se pre-selecciona si viene de URL param `?windFarm=`.

#### D. SubassetsSelectionPanel (Organism)

```typescript
interface SubassetsSelectionPanelProps {
  data: SubassetSelectionRow[];
  isLoading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}
```

- Encabezado "Subassets" implícito en la tabla.
- Master checkbox en cabecera: checked si todos seleccionados, indeterminate si algunos, unchecked si ninguno.
- Tabla sin bordes exteriores, separadores horizontales finos.
- Columnas: ☐ | 🌀 icono | Name | Model | Last inspection | Last defects detected.
- Checkbox activo: fondo azul (#00A3E0) con checkmark blanco.
- Filas clickeables (toggle selección al hacer clic en cualquier parte de la fila).
- Skeleton rows durante carga (6-8 filas simuladas).

#### E. WeatherMapPanel (Organism)

```typescript
interface WeatherMapPanelProps {
  latitude: number | null;
  longitude: number | null;
  isLoading: boolean;
}
```

- Contenedor con bordes redondeados, sin borde visible, ocupa 100% del alto disponible.
- Iframe de Windy.com con parámetros de URL para centrar en coordenadas:
  ```
  https://embed.windy.com/embed.html?type=map&location=coordinates
  &metricRain=mm&metricTemp=°C&metricWind=m/s
  &lat={latitude}&lon={longitude}&zoom=10&level=surface&overlay=wind
  &product=ecmwf&menu=&message=true&marker=&calendar=now
  &pressure=&type=map&location=coordinates&detail=true&detailLat={lat}&detailLon={lon}
  ```
- Debajo del mapa: tabla de pronóstico integrada en el iframe (Windy la provee nativamente con `detail=true`).
- Si no hay coordenadas (parque sin geolocalización): mostrar placeholder con mensaje "Seleccione un parque para ver el pronóstico meteorológico".
- Fondo gris claro cuando no hay iframe cargado.

#### F. NotificationToggle (Atom)

```typescript
interface NotificationToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}
```

- Toggle switch circular (24px alto, 44px ancho).
- Activo: fondo verde (#4CAF50), botón circular blanco a la derecha.
- Inactivo: fondo gris (#CCC), botón circular blanco a la izquierda.
- Label a la derecha: "Subscribe to email notifications for new inspections".
- Transición suave (200ms).

#### G. CreateButton (dentro de SubassetsSelectionPanel)

- Botón `Button` existente (variant="primary").
- Texto: "CREATE" en mayúsculas.
- Fondo azul (#00A3E0), bordes redondeados, texto blanco bold.
- Posición: alineado a la esquina inferior derecha del panel central.
- **Estado deshabilitado**: opacidad 0.5, cursor not-allowed.
- **Condición para habilitar**: `campaignName.trim() !== '' && selectedTurbineIds.length > 0`.
- Loading state: spinner reemplaza texto durante la mutación.


### 20.9 Integración con Windy.com (Iframe)

La URL del iframe se construye dinámicamente según las coordenadas del parque:

```typescript
function buildWindyUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    type: 'map',
    location: 'coordinates',
    metricRain: 'mm',
    metricTemp: '°C',
    metricWind: 'm/s',
    lat: lat.toString(),
    lon: lon.toString(),
    zoom: '10',
    level: 'surface',
    overlay: 'wind',
    product: 'ecmwf',
    message: 'true',
    calendar: 'now',
    detail: 'true',
    detailLat: lat.toString(),
    detailLon: lon.toString(),
  });
  return `https://embed.windy.com/embed.html?${params.toString()}`;
}
```

Coordenadas por defecto para "Fila de Mogote" (Costa Rica): `lat=10.7089, lon=-85.2528`.

El iframe incluye `detail=true` para que Windy muestre la tabla de pronóstico extendido (temperatura, lluvia, viento, rachas) por hora y días directamente dentro del widget.

### 20.10 Lógica de Creación (Backend)

El método `createCampaignWithInspections` ejecuta las siguientes operaciones en secuencia:

```
1. Crear campaña → INSERT INTO campaign (name, wind_farm_id, created_by)
2. Para cada turbineId en selectedTurbineIds:
   a. Obtener la primera blade de la turbina (position=1)
   b. INSERT INTO inspection (blade_id, inspector_id, campaign_id, inspection_type, scheduled_date, notes, status='in_progress', stage='planned')
3. Si subscribeNotifications → invocar Edge Function de notificación (futuro)
4. Retornar { campaign, inspectionIds }
```

Se reutiliza:
- `assetDetailService.createCampaign()` para paso 1.
- `assetDetailService.assignInspectionsToCampaign()` si se separan los pasos.
- O se implementa una transacción lógica en el nuevo servicio.

### 20.11 Routing

La página `NewInspection` ya tiene ruta asignada (`/inspections/new`). Se reescribe el componente manteniendo la misma ruta. Se soporta query param opcional: `?windFarm={id}` para pre-seleccionar el parque (usado desde "Plan a New Inspection" en la ficha del parque).

```typescript
// En src/App.tsx (ya existe, no requiere cambio de ruta):
<Route
  path="/inspections/new"
  element={
    <AuthGuard>
      <AppLayout>
        <NewInspectionPage />
      </AppLayout>
    </AuthGuard>
  }
/>
```


### 20.12 Comportamiento UX

| Interacción | Comportamiento |
|-------------|---------------|
| Carga inicial | Pre-selecciona parque de URL param o primer parque disponible; carga turbinas + mapa |
| Cambio de Asset | Actualiza tabla de turbinas (skeleton), actualiza iframe Windy con nuevas coordenadas, selecciona todas las turbinas por defecto |
| Segmented Control (Type) | Toggle visual instantáneo; no afecta otros campos |
| Segmented Control (Method) | Toggle visual instantáneo; no afecta otros campos |
| DatePicker | Formato DD/MM/YYYY; icono calendario para selector nativo |
| Campaign name | Auto-sugerido como "[Mes actual] [Año]"; editable libremente |
| Master checkbox | Selecciona/deselecciona todas las turbinas; estado indeterminate si solo algunas están seleccionadas |
| Click en fila de turbina | Toggle de su checkbox individual |
| Toggle notificaciones | Cambia estado local; efecto solo al crear |
| Botón CREATE (deshabilitado) | Si campaignName vacío O ninguna turbina seleccionada → botón gris, no clickeable |
| Botón CREATE (habilitado) | Valida Zod → crea campaña + inspecciones → toast éxito → redirect |
| Error de validación | Errores inline bajo campos; scroll al primer error |
| Error de red/servidor | Toast de error vía error handler existente |
| Responsive <1280px | 2 columnas (formulario+tabla juntos, mapa debajo) |
| Responsive <768px | 1 columna apilada (formulario → tabla → mapa) |

### 20.13 Migración SQL Requerida

```sql
-- Migration: New Inspection form support (coordenadas geográficas)

-- Añadir campos de geolocalización al parque eólico (si no existen)
ALTER TABLE wind_farm
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Actualizar datos de ejemplo con coordenadas de Fila de Mogote
UPDATE wind_farm
SET latitude = 10.7089, longitude = -85.2528
WHERE name ILIKE '%mogote%' OR name ILIKE '%fila%';
```

Nota: La tabla `campaign` y los campos `campaign_id`, `inspection_type`, `notes` en `inspection` ya existen desde la migración de la sección 17 (Asset Detail). No se requieren nuevas tablas.

### 20.14 Decisiones de Diseño Específicas

| Decisión | Justificación |
|----------|--------------|
| Reescritura de `NewInspection.tsx` | El formulario actual es demasiado simple (blade selector + date); RF-002 requiere un rediseño completo con layout de 3 columnas |
| Servicio dedicado `new-inspection.service.ts` | Separación de la lógica de creación masiva (campaña + N inspecciones) del CRUD simple de `inspections.service.ts` |
| Iframe de Windy en vez de API propia | Windy ofrece widget embed gratuito con toda la funcionalidad meteorológica (mapa + pronóstico); no requiere backend custom |
| Coordenadas en `wind_farm` en vez de lookup externo | Permite control total sobre la geolocalización; simple de implementar y mantener |
| SegmentedControl como molecule reutilizable | Patrón de UI que puede usarse en otros formularios (filtros, configuraciones) |
| Todas las turbinas pre-seleccionadas por defecto | Caso de uso más común es inspeccionar todo el parque; deseleccionar es más fácil que seleccionar manualmente |
| campaign_name auto-sugerido "[Mes] [Año]" | Reduce fricción; el usuario puede editar pero tiene un default útil |
| Validación Zod + botón disabled | Doble protección: feedback visual inmediato (botón gris) + validación formal al submit |
| Skeleton loader en tabla de turbinas | Feedback visual durante la carga asíncrona al cambiar de parque |
| Layout responsivo con breakpoints | 3 columnas en desktop (>1280px), 2 en tablet, 1 en mobile; prioriza usabilidad en cada viewport |
| No se implementa lógica de email notifications en esta fase | El toggle se persiste y queda preparado; la Edge Function de notificación se implementa en fase posterior |