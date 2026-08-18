# Propuesta de Rediseño Visual — CORE Insight

> **Objetivo**: Diferenciar visualmente la plataforma de Skyvisor manteniendo todas las funcionalidades y acciones intactas.
> **Restricciones**: Respetar paleta cromática actual (#5A8F5A acento, #2C2C2C superficies oscuras), no modificar lógica de negocio.

---

## 1. Filosofía de Diseño

### De "Réplica de Skyvisor" a "Plataforma Industrial Moderna"

| Aspecto | Skyvisor (actual) | CORE Insight (propuesta) |
|---------|------------------|--------------------------|
| Layout | Sidebar clásica + contenido plano | Sidebar compacta + Bento Grid modular |
| Datos | Tablas densas, gráficos genéricos | KPIs prominentes + drill-down progresivo |
| Tipografía | Inter uniforme | DM Sans (display) + Inter (body) — jerarquía visual clara |
| Gráficos | Recharts básico (bar/pie) | Tremor charts + sparklines inline en KPIs |
| Tablas | HTML manual con inline styles | TanStack Table v8 con faceted filters, resize, sticky headers |
| Movimiento | Ninguno | Motion (ex Framer Motion) — transiciones suaves entre vistas |
| Densidad | Media-alta (Skyvisor style) | "Comfortable density" — más whitespace, cards con respiro |
| Identidad | Barra verde izquierda en títulos | Badge + gradiente sutil en headers de sección |

### Principio diferenciador

> **"Metrics-first, details on demand"** — Cada pantalla abre con las métricas más relevantes en cards prominentes (KPIs). Los datos detallados (tablas, gráficos expandidos) aparecen debajo o al hacer drill-down. Esto invierte la jerarquía de Skyvisor donde las tablas dominan.

---

## 2. Stack Técnico Propuesto

| Capa | Librería | Justificación |
|------|----------|---------------|
| UI base | **Tailwind CSS v4** + tokens custom | Reemplaza inline styles. Consistencia total, theming con CSS vars |
| Componentes | **shadcn/ui** (copy-paste) | Accesible, personalizable, sin dependencia runtime. Base Radix UI |
| Charts | **Tremor** (@tremor/react) | KPI cards, sparklines, bar/area/donut charts — diseñados para dashboards |
| Charts avanzados | **Nivo** (@nivo/pie, @nivo/bar) | Para gráficos del blade diagram y breakdowns complejos |
| Tablas | **TanStack Table v8** | Headless — sorting, filtering, pagination, column resize, row selection |
| Animaciones | **Motion** (motion.dev) | Layout animations, page transitions, mount/unmount |
| Iconos | **Lucide** (mantener) | Ya instalado, consistente |
| Mapas | **OpenLayers** (mantener) | Ya funcional |

### Migración gradual
No se propone reescribir todo de golpe. Se puede migrar pantalla por pantalla, empezando por Dashboard y WindFarmsDashboard que son las más visibles.

---

## 3. Tokens de Diseño Actualizados

```css
:root {
  /* Paleta — se mantiene identidad cromática */
  --accent: #5A8F5A;
  --accent-light: #6BA86B;
  --accent-subtle: rgba(90, 143, 90, 0.08);
  --accent-border: rgba(90, 143, 90, 0.2);
  
  --surface-dark: #2C2C2C;
  --surface-sidebar: #1E1E1E; /* Más profundo que antes */
  --surface-card: #FFFFFF;
  --surface-elevated: #F8FAFB;
  --surface-page: #F1F4F6; /* Fondo de página gris muy sutil (vs blanco puro) */
  
  /* Neutros refinados */
  --text-primary: #111827;
  --text-secondary: #4B5563;
  --text-muted: #9CA3AF;
  --border-default: #E5E7EB;
  --border-subtle: #F3F4F6;
  
  /* Tipografía */
  --font-display: 'DM Sans', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Escala tipográfica revisada */
  --text-display: 1.75rem; /* 28px — títulos de página */
  --text-heading: 1.25rem; /* 20px — subtítulos de sección */
  --text-subhead: 1rem;    /* 16px — headers de cards */
  --text-body: 0.875rem;   /* 14px — texto general */
  --text-caption: 0.75rem; /* 12px — labels, metadata */
  
  /* Nuevos: KPI metrics */
  --text-metric: 2rem;     /* 32px — números prominentes */
  --text-metric-sm: 1.5rem; /* 24px — métricas secundarias */
  
  /* Espaciado — mantener escala actual */
  /* Radius — más consistente */
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-badge: 6px;
  --radius-input: 8px;
  
  /* Sombras refinadas */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
  --shadow-card-hover: 0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03);
  --shadow-dropdown: 0 10px 30px rgba(0,0,0,0.08);
}
```

---

## 4. Rediseño Pantalla por Pantalla

### 4.1 Layout Global (Sidebar + TopBar + Content)

**Actual**: Sidebar 256px oscura → TopBar blanca → Contenido con padding.

**Propuesta**:
```
┌──────┬──────────────────────────────────────────────────┐
│      │  TopBar: más delgada (48px), sin bordes,         │
│  S   │  breadcrumb integrado + avatar a la derecha      │
│  I   ├──────────────────────────────────────────────────┤
│  D   │                                                  │
│  E   │  Content Area                                    │
│  B   │  background: var(--surface-page) #F1F4F6         │
│  A   │  padding: 24px 32px                              │
│  R   │                                                  │
│      │  Cards flotan sobre el fondo gris sutil          │
│ 72px │  con shadow-card y radius-card                   │
│ icon │                                                  │
│ only │                                                  │
│      │                                                  │
└──────┴──────────────────────────────────────────────────┘
```

**Cambios clave**:
- Sidebar **por defecto colapsada** (72px, solo iconos). Se expande al hover o click del toggle. Esto da más espacio al contenido.
- Fondo de contenido: **gris sutil** (#F1F4F6) en vez de blanco puro — las cards blancas "flotan" con sombra suave.
- TopBar: **48px** (vs 64px actual), más compacta. Breadcrumb a la izquierda, avatar + idioma a la derecha. Sin borde inferior (la diferencia de color basta).
- Sidebar oscura más profunda (#1E1E1E vs #2C2C2C) para mayor contraste.

---

### 4.2 Dashboard (`/dashboard`)

**Actual**: 4 gráficos en grid 2x2, cada uno en un ChartCard con filtros en header.

**Propuesta**: Layout **"Metrics + Trends"**

```
┌─────────────────────────────────────────────────────────┐
│ Good morning, Risto           [Last 30 days ▾]          │
├────────┬────────┬────────┬────────┬────────────────────┤
│  KPI   │  KPI   │  KPI   │  KPI   │    Sparkline       │
│ Total  │Active  │Defects │Uptime  │    combinada       │
│Turbines│Inspect │Found   │  %     │    (7 días)        │
│  12    │   3    │  47    │ 98.2%  │    ───────         │
├────────┴────────┴────────┴────────┴────────────────────┤
│                                                         │
│  ┌─────────────────────────┐  ┌──────────────────────┐ │
│  │ Inspection Pipeline     │  │ Defects by Category  │ │
│  │ (Stacked area chart)    │  │ (Donut + legend)     │ │
│  │                         │  │                      │ │
│  │ Tremor AreaChart         │  │ Tremor DonutChart    │ │
│  └─────────────────────────┘  └──────────────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Recent Activity                                     ││
│  │ Timeline vertical: últimas inspecciones/defectos    ││
│  │ con timestamps, badges de estado, avatars           ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Diferenciadores vs Skyvisor**:
- Fila de **4 KPI cards** con métricas grandes (32px) + delta indicator (↑2.3% verde)
- Sparkline combinada al final de la fila de KPIs
- Gráficos con **area charts** en vez de bar charts — look más fluido/moderno
- **Activity timeline** al fondo (reemplaza el 4to gráfico) — muestra las últimas acciones del equipo
- Filtro global "Last 30 days" en el header (no por gráfico individual)

---

### 4.3 WindFarms Dashboard (`/assets-wind`)

**Actual**: Título + SearchBar + TabBar (Assets/Defects/Map) + Tabla grande.

**Propuesta**: Layout **"Portfolio Overview"**

```
┌─────────────────────────────────────────────────────────┐
│ Wind Farms                    [Search...] [+ New Farm]  │
├────────┬────────┬────────┬──────────────────────────────┤
│ Total  │ Online │Inspect.│  Map Preview (mini,          │
│ Farms  │Turbines│Pending │  clickable to expand)        │
│   3    │  12    │   2    │  ┌──────────────────┐        │
├────────┴────────┴────────┤  │   🗺️  mini map   │        │
│                           │  └──────────────────┘        │
│ ┌───────────────────────────────────────────────────────┐│
│ │ Tab: Assets | Defects                                 ││
│ ├───────────────────────────────────────────────────────┤│
│ │                                                       ││
│ │  DataTable con TanStack Table:                        ││
│ │  - Column resize                                     ││
│ │  - Faceted filters (dropdown en headers)             ││
│ │  - Sticky header en scroll                           ││
│ │  - Row hover → slide-in action buttons               ││
│ │  - Pagination abajo (rows per page + nav)            ││
│ │                                                       ││
│ └───────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Diferenciadores**:
- **3 KPI cards** arriba de la tabla (no existen en Skyvisor)
- Mini mapa en la esquina superior derecha (preview, click para ver full-screen)
- Tabla con **faceted filters** en cada columna (filtros inline, no un bar separado)
- Row actions on hover (edit, view, archive) — slide-in desde la derecha
- Eliminar tab "Global Map" como tab separado → integrar mini-map + botón expand

---

### 4.4 WindFarm Detail (`/assets-wind/:id`)

**Actual**: Header + TabBar (General/Defects). General = 2 columnas (details + campaigns).

**Propuesta**: Layout **"Asset Command Center"**

```
┌─────────────────────────────────────────────────────────┐
│ [← Back]  Parque Eólico FDM                            │
├────────┬────────┬────────┬────────┬─────────────────────┤
│Turbinas│Power   │Last    │Defects │   Status Ring       │
│  5     │3.2 MW  │Inspect.│ Open:12│   (donut mini)     │
│        │total   │3d ago  │        │   ●●●○             │
├────────┴────────┴────────┴────────┴─────────────────────┤
│                                                         │
│ ┌─── Tabs: Overview | Turbines | Defects | Docs ──────┐│
│ │                                                      ││
│ │ [Overview tab]:                                      ││
│ │  Bento grid 2x2:                                    ││
│ │  ┌──────────┐ ┌──────────┐                          ││
│ │  │ Campaigns│ │ Recent   │                          ││
│ │  │ Timeline │ │ Defects  │                          ││
│ │  └──────────┘ └──────────┘                          ││
│ │  ┌──────────┐ ┌──────────┐                          ││
│ │  │ Documents│ │ Power    │                          ││
│ │  │          │ │ Trend    │                          ││
│ │  └──────────┘ └──────────┘                          ││
│ │                                                      ││
│ │ [Turbines tab]: DataTable de turbinas                ││
│ │ [Defects tab]: Split panel (tabla + sidebar)         ││
│ │ [Docs tab]: Document dropbox                         ││
│ └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Diferenciadores**:
- KPI row al top (Skyvisor no tiene esto en el detail)
- **4 tabs** en vez de 2 — separa las responsabilidades (Turbines sale de "General")
- Tab "Overview" usa **bento grid** con cards informativas (no una tabla inmediata)
- Mini donut "Status Ring" mostrando distribución de estados de turbinas
- Botón "← Back" en vez de solo breadcrumb

---

### 4.5 SubassetDetail — Turbina (`/assets-wind/:wf/subasset/:id`)

**Actual**: Breadcrumb + Tabs (General/Defects). General = 2 columnas (metadata + inspecciones tabla).

**Propuesta**: Layout **"Turbine Health Card"**

```
┌─────────────────────────────────────────────────────────┐
│ [← FDM]  Turbina FDM-T02                    [Actions ▾]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌── Hero Card ───────────────────────────────────────┐  │
│ │  ┌─────────┐                                       │  │
│ │  │ Turbine │  Model: Vestas V110                   │  │
│ │  │  Icon   │  Power: 2.1 MW  |  Since: 2021-03    │  │
│ │  │ (SVG)   │  Last Inspection: 14 days ago         │  │
│ │  │         │  Health Score: ████████░░ 82%         │  │
│ │  └─────────┘                                       │  │
│ └────────────────────────────────────────────────────┘  │
│                                                         │
│ ┌─── Tabs: Inspections | Defects | Documents ─────────┐ │
│ │                                                      │ │
│ │ [Inspections]:                                       │ │
│ │  Timeline view (vertical) con cards por inspección   │ │
│ │  Cada card: fecha, status badge, fotos count,        │ │
│ │  defectos encontrados, botón "Open Workflow →"       │ │
│ │                                                      │ │
│ │ [Defects]: Split panel existente                     │ │
│ │ [Documents]: Dropbox existente                       │ │
│ └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Diferenciadores**:
- **Hero card** con ícono de turbina + metadata principal en formato horizontal
- **Health Score** (barra de progreso visual) — dato derivado del % de defectos resueltos
- Inspecciones como **timeline vertical** (no tabla) — más visual, muestra progresión temporal
- Cada inspección es una "card" con preview info + CTA "Open Workflow"
- Dropdown "Actions" (Plan inspection, Export, Share) — reemplaza botones sueltos

---

### 4.6 Inspection Workflow (`/inspections/:id/workflow`)

**Actual**: Toolbar con breadcrumb + step pills. Full viewport. Steps 1-4.

**Propuesta**: Mismo concepto pero refinado

```
┌─────────────────────────────────────────────────────────┐
│ ┌─ Step Progress Bar ─────────────────────────────────┐ │
│ │  ① INSPECT ──── ② ANNOTATE ──── ③ ANALYZE ── ④ RESULTS│
│ │     ✓              ●              ○              ○   │ │
│ └─────────────────────────────────────────────────────┘ │
│ FDM > FDM-T02 > 2026-08-12              [ES] [⟳] [✕]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                Step Content                              │
│                (sin cambios funcionales,                 │
│                 solo refinamiento visual)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Cambios visuales del toolbar**:
- Step indicator: **progress bar con línea conectora** (no pills aislados)
- Steps completados muestran ✓ con color verde
- Step activo muestra ● relleno
- Steps futuros muestran ○ vacío
- Breadcrumb debajo del progress bar (segunda línea, más sutil)
- Botones de utilidad a la derecha (idioma, refresh, cerrar)

**Steps internos** (no cambian funcionalidad, solo look):
- Step 2 (Annotate): sidebar de thumbnails con borde redondeado, grid gap uniforme
- Step 3 (Analyze): defect cards con bordes left-color por severidad
- Step 4 (Results): mantener estructura actual que ya es TurbineDetail

---

### 4.7 Inspections List (`/inspections`)

**Actual**: Header + filter bar + chips + tabla + pagination.

**Propuesta**:

```
┌─────────────────────────────────────────────────────────┐
│ Inspections                          [+ New Inspection] │
├────────┬────────┬────────┬──────────────────────────────┤
│Planned │Active  │Completed│ Analyze                     │
│  4     │  2     │  18    │    3                         │
├────────┴────────┴────────┴──────────────────────────────┤
│                                                         │
│ ┌─ Filters (collapsible panel) ───────────────────────┐ │
│ │ Status [▾]  Farm [▾]  Date range [__|__]  [Apply]   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ DataTable ─────────────────────────────────────────┐ │
│ │ Columns con faceted sort + filter inline            │ │
│ │ Status badges con colores semánticos                │ │
│ │ Row click → navigate to workflow                    │ │
│ │ Hover → quick actions (archive, duplicate)          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Showing 1-10 of 27        [← 1 2 3 →]  [10 per page ▾] │
└─────────────────────────────────────────────────────────┘
```

**Diferenciadores**:
- **4 KPI cards** por status arriba (como contadores rápidos + filtro clickeable)
- Filtros en panel collapsible (no siempre visibles)
- Tabla con TanStack Table — column headers clickeables para sort + filter facetado
- Pagination mejorada con número de páginas visibles

---

### 4.8 New Inspection (`/inspections/new`)

**Actual**: Grid 3 columnas (config form | turbine selection | weather map).

**Propuesta**: Layout **"Wizard Steps"** (misma info, distinta distribución)

```
┌─────────────────────────────────────────────────────────┐
│ Create New Inspection                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─── Step indicator: 1. Configure  2. Select  3. Review│
│ │                                                      │
│ │ [Step 1: Configure]                                  │
│ │  Form card (max-width 640px, centered):              │
│ │  - Wind Farm selector                               │
│ │  - Inspection type                                   │
│ │  - Method (Drone/Manual)                            │
│ │  - Date picker                                       │
│ │  - Campaign name                                     │
│ │  - Notes                                             │
│ │  [Next →]                                            │
│ │                                                      │
│ │ [Step 2: Select Turbines]                            │
│ │  Grid de turbine cards (seleccionables)              │
│ │  con checkbox visual + mini weather widget aside     │
│ │                                                      │
│ │ [Step 3: Review & Create]                            │
│ │  Summary card + [Create Inspection]                  │
│ │                                                      │
│ └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Diferenciadores**:
- De 3 columnas simultáneas a **wizard de 3 pasos** — reduce carga cognitiva
- Turbinas como **grid de cards seleccionables** (no tabla con checkboxes)
- Review step muestra resumen visual antes de crear
- El weather map se integra como widget al lado de la selección de turbinas (no columna completa)

---

### 4.9 Reports (`/inspections/reports`)

**Actual**: Tabla con búsqueda + download PDF.

**Propuesta**: **"Report Cards"** view + table toggle

- Vista por defecto: **grid de cards** (2-3 columnas) con preview del reporte (miniatura, título, fecha, badge)
- Toggle para vista tabla (para buscar rápido)
- Filtros: date range, farm, turbine, status
- Card click → descarga PDF o abre preview

---

### 4.10 Login (`/login`)

**Actual**: Card blanca centrada sobre fondo gradient oscuro.

**Propuesta**: Layout **"Split Screen"**

```
┌──────────────────────────┬──────────────────────────────┐
│                          │                              │
│   Background Panel       │     Login Form              │
│   (dark, #1E1E1E)       │     (white card)            │
│                          │                              │
│   Logo grande            │     Welcome back            │
│   "CORE | Insight"       │                              │
│                          │     [Email         ]        │
│   Tagline:               │     [Password      ]        │
│   "Wind Farm             │                              │
│    Intelligence           │     [Sign In →    ]        │
│    Platform"             │                              │
│                          │     Forgot password?         │
│   ─── Abstract wind      │                              │
│       turbine SVG ───    │                              │
│                          │                              │
└──────────────────────────┴──────────────────────────────┘
```

**Diferenciadores**:
- **Split screen** (50/50) vs card centrada — más impactante, más espacio para branding
- Panel izquierdo oscuro con logo grande + tagline + SVG decorativo de turbina
- Panel derecho con form limpio sin ruido
- Responsive: en mobile el panel izquierdo desaparece, queda solo el form

---

### 4.11 Compare Viewer (`/compare`)

**Actual**: Standalone page con navegación de caras (SS/PS/Hub) + anotación roja.

**Propuesta**: Sin cambios estructurales (ya es standalone y funcional). Mejoras visuales:
- Fondo page: #F1F4F6 (vs blanco puro)
- Cards de imagen con shadow-card
- Botones de navegación con estilo consistent (shadcn Button variants)
- Labels (Blade/Side/Hub) con Badge component

---

## 5. Componentes Transversales

### 5.1 DataTable (reemplaza todas las tablas hand-rolled)

Basado en **TanStack Table v8** + estilos shadcn:
- Header sticky con sort indicators
- Column resize drag handles
- Faceted filter dropdowns en headers
- Row selection con checkboxes
- Row hover: slide-in action buttons
- Empty state con ilustración
- Skeleton loading (rows fantasma)
- Pagination: rows-per-page + page numbers + nav

### 5.2 KPI Card (nuevo componente)

```
┌────────────────────┐
│ 📊 Total Turbines  │  ← icon + label (caption size)
│                    │
│      12            │  ← metric (32px, bold, DM Sans)
│   ↑ 2 this month  │  ← delta (verde/rojo + texto)
│                    │
│ ▁▂▃▄▅▆▇█▇▅▃       │  ← sparkline optional
└────────────────────┘
```

### 5.3 StatusBadge (refinado)

- Pill shape (radius-full)
- Colores: planned=#94A3B8, inspect=#3B82F6, annotate=#F59E0B, analyze=#EF4444, complete=#10B981
- Dot indicator (●) antes del texto
- Font: 11px uppercase, letter-spacing 0.04em

### 5.4 Page Header

```
┌─────────────────────────────────────────────────────────┐
│ [Icon] Page Title                      [Primary Action] │
│ Subtitle o description breve                            │
└─────────────────────────────────────────────────────────┘
```
- Sin barra verde izquierda (Skyvisor style)
- Icon + título en DM Sans 28px semibold
- Subtitle en Inter 14px text-secondary
- Action button alineado a la derecha

### 5.5 Sidebar Refinado

- Default: **collapsed (72px)**
- Background: #1E1E1E (más profundo)
- Active item: pill con background rgba(90,143,90,0.15) + texto #5A8F5A
- Hover: background rgba(255,255,255,0.05)
- Icons: 20px, stroke-width 1.5 (más fino)
- Tooltip al hover en modo collapsed
- Logo: solo eye icon en collapsed, full logo en expanded
- Expand: **on hover** del sidebar (auto-expand, no click) con Motion animation

---

## 6. Transiciones y Micro-animaciones (Motion)

| Elemento | Animación | Duración |
|----------|-----------|----------|
| Page mount | fadeIn + slideUp (8px) | 200ms |
| Card mount (staggered) | fadeIn + scale(0.98→1) | 150ms cada una, 50ms stagger |
| Tab switch | crossfade content | 150ms |
| Sidebar expand | width 72→256px | 200ms ease-out |
| Table row hover | background-color transition | 100ms |
| KPI counter | countUp animation al mount | 500ms |
| Modal open | fadeIn overlay + scale card | 200ms spring |
| Toast notification | slideIn from right | 300ms spring |

---

## 7. Relación Entre Pantallas (Information Architecture)

```
Login
  │
  └─► Dashboard (métricas globales)
        │
        ├─► /assets-wind (lista de farms + KPIs)
        │     │
        │     └─► /assets-wind/:id (farm detail + turbines + defects)
        │           │
        │           └─► /assets-wind/:wf/subasset/:id (turbine health)
        │                 │
        │                 └─► /inspections/:id/workflow (4 steps)
        │
        ├─► /inspections (lista + filtros)
        │     │
        │     ├─► /inspections/new (wizard 3 steps)
        │     └─► /inspections/ongoing
        │
        └─► /inspections/reports (cards/table de reportes)
```

**Principio de navegación**: cada nivel de profundidad reduce la amplitud. Dashboard = todo. Farm = sus turbinas. Turbina = sus inspecciones. Inspección = su workflow. Se navega con **back buttons** claros + breadcrumbs contextuales en TopBar.

---

## 8. Resumen de Diferenciación vs Skyvisor

| Skyvisor | CORE Insight (propuesta) |
|----------|--------------------------|
| Tablas dominantes, datos densos | KPIs primero, tablas en segundo plano |
| Layout 2 columnas fijo | Bento grid modular + cards |
| Sin animaciones | Micro-animaciones con Motion |
| Sidebar expandida por defecto | Sidebar collapsed por defecto (más contenido) |
| Gráficos Recharts básicos | Tremor charts + sparklines inline |
| Fondo blanco puro | Fondo gris sutil, cards flotantes |
| Barra verde lateral en títulos | Icons + badges en headers |
| Inline styles en todo | Tailwind classes + shadcn components |
| 3 columnas para New Inspection | Wizard de 3 pasos |
| Tabs simples (underline) | Tabs con conteo/badge |
| Login card centrada | Split screen branding |

---

## 9. Plan de Implementación Sugerido

### Fase 1: Fundación (1-2 sesiones)
- Instalar Tailwind CSS v4 + configurar tokens
- Instalar shadcn/ui + TanStack Table + Tremor + Motion
- Crear componentes base: KPICard, DataTable, PageHeader, StatusBadge
- Migrar Layout (sidebar collapsed default + fondo gris)

### Fase 2: Dashboard + Assets (2-3 sesiones)
- Rediseñar Dashboard con KPIs + Tremor charts + Activity timeline
- Rediseñar WindFarmsDashboard con KPIs + faceted table
- Rediseñar WindFarmDetail con bento grid overview

### Fase 3: Detail Views (2-3 sesiones)
- SubassetDetail con hero card + timeline de inspecciones
- Inspections list con KPI counters + DataTable
- Reports con card view toggle

### Fase 4: Workflow + Forms (1-2 sesiones)
- Workflow toolbar con progress bar
- New Inspection como wizard
- Login split screen

### Fase 5: Polish (1 sesión)
- Micro-animaciones globales
- Dark mode actualizado con nuevos tokens
- Testing responsive
- Performance audit

---

## 10. Dependencias Nuevas

```json
{
  "tailwindcss": "^4.x",
  "@tailwindcss/vite": "^4.x",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-dropdown-menu": "latest",
  "@radix-ui/react-tabs": "latest",
  "@radix-ui/react-tooltip": "latest",
  "@tremor/react": "latest",
  "@tanstack/react-table": "^8.x",
  "motion": "^11.x",
  "clsx": "latest",
  "tailwind-merge": "latest"
}
```

> **Nota**: shadcn/ui no es una dependencia npm — son archivos copiados al proyecto. Se instalan con `npx shadcn@latest add [component]`.

---

*Documento elaborado para revisión del usuario. Los cambios son exclusivamente visuales/de presentación. Ninguna funcionalidad, acción o flujo de datos se modifica.*
