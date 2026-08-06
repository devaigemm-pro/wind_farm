# Skyvisor - Inspections/Reports: Especificación de Referencia para Desarrollo

> Documento generado el 2026-07-21 mediante navegación automatizada de https://app.skyvisor.io
> Usar como referencia para replicar la funcionalidad en otra aplicación.

---

## 1. Resumen General

La sección **Reports** de Skyvisor es un módulo de visualización y gestión de reportes de inspección de palas de aerogeneradores. Permite listar todas las inspecciones finalizadas, ver estadísticas de defectos, explorar defectos individuales sobre un diagrama de la pala, y descargar reportes PDF.

---

## 2. Arquitectura de Vistas

```
/inspections/reports          → Lista de reportes (tabla paginada)
/inspections/{id}             → Detalle de inspección con 4 pasos
    ├── 1. INSPECT            → Vista de imágenes crudas
    ├── 2. ANNOTATE           → Grid de imágenes con anotaciones
    ├── 3. ANALYZE            → Análisis (no explorado en detalle)
    └── 4. RESULTS            → Resultados finales
        ├── Tab: Statistics   → Gráficos y resumen estadístico
        └── Tab: Details      → Tabla completa de defectos
```

---

## 3. Design System / Estilos Visuales

### 3.1 Paleta de Colores

| Uso | Color | Valor |
|-----|-------|-------|
| Sidebar background | Azul oscuro | `rgb(0, 50, 87)` / `#003257` |
| Page background | Gris claro | `rgb(244, 246, 248)` / `#F4F6F8` |
| Cards/Paper background | Blanco | `rgb(255, 255, 255)` / `#FFFFFF` |
| Table header background | Gris muy claro | `rgb(250, 250, 250)` / `#FAFAFA` |
| Texto principal | Negro | `rgba(0, 0, 0, 0.87)` |
| Texto secundario | Gris | `rgba(0, 0, 0, 0.54)` |
| Texto terciario/muted | Gris claro | `rgba(0, 0, 0, 0.6)` |
| Primary / accent | Azul claro | `rgb(0, 166, 255)` / `#00A6FF` |
| Sidebar text active | Blanco | `rgba(255, 255, 255, 0.9)` |
| Sidebar text inactive | Blanco muted | `rgba(255, 255, 255, 0.7)` |

### 3.2 Tipografía

| Propiedad | Valor |
|-----------|-------|
| Font family | `Calibri, "Gill Sans", Arial, sans-serif` |
| Body font size | `11.2px` (base muy pequeña, equivale a ~0.7rem) |
| Heading h5 (page title) | `16.8px`, weight `400`, color negro |
| Table header text | `9.8px`, weight `700` |
| Table cell text | `9.8px`, weight normal |
| Heading h1 (big numbers) | Usado para contadores de categorías en Statistics |

### 3.3 Layout

| Componente | Dimensión |
|------------|-----------|
| Sidebar | `width: 90px`, `position: fixed`, `height: 100vh` |
| Content area | `margin-left: 90px`, `width: calc(100% - 90px)` |
| Toolbar (page header) | `height: ~52px`, `border-bottom: 1px solid rgba(0,0,0,0.12)` |
| Table row height | `65px` |
| Table cell padding | `16px` |
| Content layout | `display: flex; flex-direction: column` |

### 3.4 Framework UI

- **Material UI (MUI)** — Identificado por clases CSS: `MuiGrid`, `MuiPaper`, `css-1l1ecpp-sideBar`, `css-mxlaxo-main`
- Componentes MUI observados: Grid, Table, TablePagination, Tabs, Switch, Button, Combobox/Select, Accordion

---

## 4. Vista: Lista de Reportes (`/inspections/reports`)

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar 90px] │ [Content Area]                         │
│                │                                         │
│  Logo          │  ┌─ Toolbar ──────────────────────────┐│
│  Dashboard     │  │ "Reports" (h5)    [🔍 Search all] ││
│  ─────         │  └────────────────────────────────────┘│
│  ASSETS        │                                         │
│  Wind farms    │  ┌─ Table ────────────────────────────┐│
│  ─────         │  │ Date | Asset | SubAsset | Type |   ││
│  INSPECTIONS   │  │      | Defects | Note | PDF report ││
│  New           │  │─────────────────────────────────────││
│  Uploader      │  │ 6/2/2026 | Fila de... | WT01 | ...││
│  Ongoing       │  │ (clickable row, cursor:pointer)    ││
│  Reports ←     │  │ ...                                 ││
│  ─────         │  └────────────────────────────────────┘│
│  Profile       │                                         │
│  Exit          │  ┌─ Pagination ───────────────────────┐│
│                │  │ Rows: [5|10|25|100]  < page N >    ││
│                │  └────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 4.2 Tabla de Reportes

**Columnas:**
| # | Header | Contenido | Sortable | Filtrable |
|---|--------|-----------|----------|-----------|
| 1 | Inspection Date | Fecha formato M/D/YYYY | ✅ | ❌ |
| 2 | Asset | Nombre del parque eólico | ✅ | ❌ |
| 3 | SubAsset | ID del aerogenerador (WT01, WT02...) | ✅ | ❌ |
| 4 | Type | Tipo de inspección ("Blades") | ✅ | ❌ |
| 5 | Defects | Número total de defectos (integer) | ✅ | ❌ |
| 6 | Note | Texto libre (ej: "Correct one") | ✅ | ❌ |
| 7 | PDF report | Botón "Download report" | ✅ | ❌ |

**Comportamiento:**
- Todas las columnas son **sortables** (botones en headers)
- Las filas son clickeables → navegan a `/inspections/{id}`
- Botón "Download report" descarga PDF (no todas las filas lo tienen)
- Search global filtra toda la tabla
- Paginación: opciones 5/10/25/100 rows por página

### 4.3 Datos de ejemplo

| Date | Asset | SubAsset | Type | Defects | Note |
|------|-------|----------|------|---------|------|
| 6/2/2026 | Fila de Mogote | WT01 | Blades | 39 | Correct one |
| 6/2/2026 | Fila de Mogote | WT01 | Blades | 17 | Correct one |
| 6/2/2026 | Fila de Mogote | WT07 | Blades | 49 | |
| 6/2/2026 | Fila de Mogote | WT05 | Blades | 48 | |
| 6/2/2026 | Fila de Mogote | WT04 | Blades | 35 | |
| 6/2/2026 | Fila de Mogote | WT02 | Blades | 54 | |
| 6/2/2026 | Fila de Mogote | WT06 | Blades | 40 | |

---

## 5. Vista: Detalle de Inspección (`/inspections/{id}`)

### 5.1 Breadcrumb

```
Fila de Mogote > Turbine WT01 > 6/3/2026
```
- Cada segmento es un link clickeable
- Formato: `{Asset} > {SubAsset} > {Date}`

### 5.2 Step Navigation (Wizard-style)

4 botones horizontales que representan el flujo de trabajo:

```
[ 1. INSPECT ]  [ 2. ANNOTATE ]  [ 3. ANALYZE ]  [ 4. RESULTS ]
```

- Botones de texto uppercase
- El paso activo se resalta visualmente
- Navegación no lineal (puedes ir a cualquier paso)

### 5.3 Panel Lateral: Blade Diagram

Presente en todas las vistas del detalle:

```
┌─────────────────────────┐
│ Blades (h5)             │
│                         │
│  A        B        C    │
│  82618    82612    82615 │
│                         │
│ ┌─ Scale 0m → 43m ───┐ │
│ │  [imagen blade]      │ │
│ │  ● 1  ● 2  ● 3  ● 4│ │  ← defectos marcados
│ │                      │ │
│ │  [imagen blade]      │ │
│ │  ● 1...7            │ │
│ │                      │ │
│ │  [imagen blade]      │ │
│ │  ● 1...11           │ │
│ └──────────────────────┘ │
│  [+] [-]  zoom controls │
└─────────────────────────┘
```

**Características:**
- 3 palas (A, B, C) con sus serial numbers
- Escala vertical: 0m a 43m con marcas cada 5m
- Defectos mostrados como **números clickeables** sobre la imagen de cada pala
- Cada número corresponde al ID del defecto (A1, A2, B1, B2, C1, etc.)
- Controles de zoom (+/-)
- Imagen de fondo representando la pala

### 5.4 Sección: Resumen y Conclusión

```
**22** defects    **0** resolved

── Conclusion ──
Turbine (48806): No conclusion.
Blade A (82618): No conclusion for this blade.
Blade B (82612): No conclusion for this blade.
Blade C (82615): No conclusion for this blade.

[ PLAN NEXT INSPECTION ]
```

---

## 6. Tab: Statistics (dentro de RESULTS)

### 6.1 Breakdown by Blade

3 **pie/donut charts** lado a lado, uno por cada pala:

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│  ◉ 75%  │  │  ◉ 100% │  │  ◉ 73%  │
│    25%  │  │         │  │    27%  │
│ Blade A │  │ Blade B │  │ Blade C │
└─────────┘  └─────────┘  └─────────┘
```

- Gráficos SVG circulares
- Muestran distribución porcentual de algo (probablemente severidad o resolución)
- Leyenda con hasta 5 segmentos de colores (por categoría de severidad)

### 6.2 Breakdown by Category

5 **contadores grandes** (heading h1) con labels debajo:

```
   0         4         18        0         0
  Cat 5    Cat 4     Cat 3    Cat 2    Cat 1
```

- Números grandes y prominentes
- Categorías de severidad 1-5 (5 = más severo)

### 6.3 Breakdown by Type

**Gráfico de barras horizontal** (SVG):

```
LE EROSION        ████████████ 11
VORTEX (MISSI…    ████████ 8
BLADES WITH H…    █ 1
OTHER ADD-ONS…    █ 1
PAINT DAMAGES     █ 1
                  0  3  6  9  12
```

### 6.4 Defect Overview Table

| Defects | Total/Type | Category 5 | Category 4 | Category 3 | Category 2 | Category 1 |
|---------|-----------|-----------|-----------|-----------|-----------|-----------|
| LE EROSION | 11 | 0 | 2 | 9 | 0 | 0 |
| BLADES WITH HYDRAULIC OIL | 1 | 0 | 1 | 0 | 0 | 0 |
| OTHER ADD-ONS MISSING | 1 | 0 | 1 | 0 | 0 | 0 |
| VORTEX (MISSING PANELS) | 8 | 0 | 0 | 8 | 0 | 0 |
| PAINT DAMAGES | 1 | 0 | 0 | 1 | 0 | 0 |
| **Total/Category** | **22** | **0** | **4** | **18** | **0** | **0** |

---

## 7. Tab: Details (dentro de RESULTS)

### 7.1 Tabla de Defectos

**Columnas:**
| # | Header | Tipo | Filtrable | Sortable |
|---|--------|------|-----------|----------|
| 1 | Id | String (A1, B2, C3...) | ❌ | ✅ |
| 2 | Type | Enum (LE EROSION, VORTEX...) | ✅ (filter icon) | ✅ |
| 3 | Category | Integer (1-5) | ✅ (filter icon) | ✅ |
| 4 | Blade | Letter (A, B, C) | ✅ (filter icon) | ✅ |
| 5 | Side | Enum (SS, LE, PS, TE) | ✅ (filter icon) | ✅ |
| 6 | Root distance (m) | Decimal | ❌ | ✅ |
| 7 | Defect size (cm) | String "W x H" | ❌ | ❌ |
| 8 | Edit | Icon button (pencil) | ❌ | ❌ |
| 9 | Resolved (N) | Switch toggle | ✅ (filter icon) | ❌ |

**Comportamiento:**
- Filas clickeables → selecciona el defecto y lo muestra en el blade diagram
- Switch "Resolved" permite marcar defectos como resueltos
- Header muestra contador de resueltos: "Resolved (0)"
- Columnas Type, Category, Blade, Side tienen iconos de filtro al lado del sort
- Edit button (pencil icon) abre editor del defecto

### 7.2 Datos de ejemplo (parcial)

| Id | Type | Cat | Blade | Side | Root dist | Size |
|----|------|-----|-------|------|-----------|------|
| A1 | VORTEX (MISSING PANELS) | 3 | A | SS | 29.7 | 10 x 377 |
| A2 | LE EROSION | 3 | A | LE | 33.5 | 17 x 332 |
| A3 | LE EROSION | 3 | A | LE | 37.6 | 11 x 351 |
| A4 | LE EROSION | 4 | A | LE | 40.6 | 8 x 352 |
| B1 | VORTEX (MISSING PANELS) | 3 | B | SS | 31.0 | 9 x 487 |
| C1 | OTHER ADD-ONS MISSING | 4 | C | LE | 0 | 25 x 6 |
| C8 | PAINT DAMAGES | 3 | C | SS | 39.8 | 28 x 406 |
| C11 | BLADES WITH HYDRAULIC OIL | 4 | C | SS | 42.7 | 48 x 83 |

---

## 8. Vista: ANNOTATE (paso 2)

### 8.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Breadcrumb]  [1.INSPECT][2.ANNOTATE]...    │
│           │                                              │
│           │ ┌─ Filters ────────────────────────────────┐│
│           │ │ [82618] [82612] [82615]  [SS][PS][LE][TE]││
│           │ └──────────────────────────────────────────┘│
│           │                                              │
│           │ ┌─ Image Grid ─────┐  ┌─ Detail Panel ────┐│
│           │ │ ┌───┐ ┌───┐     │  │ [Blade image]      ││
│           │ │ │img│ │img│ ... │  │                     ││
│           │ │ └───┘ └───┘     │  │ [Zoomed image]     ││
│           │ │ 0 UNSEEN        │  │ ─────────────────── ││
│           │ │ 0 TAGGED        │  │ ▶ Comparison        ││
│           │ │ 23 ANNOTS       │  │ ▶ Exif & metadata   ││
│           │ │                  │  │ ▶ Turbine info      ││
│           │ │ [thumbnails grid]│  │ ▶ Change blade      ││
│           │ └──────────────────┘  │                     ││
│           │                        │ [EDIT] [Turn blade]││
│           │                        └────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 8.2 Filtros

- **Blade serial buttons**: 82618, 82612, 82615 (toggle buttons por pala)
- **Side buttons**: SS (Suction Side), PS (Pressure Side), LE (Leading Edge), TE (Trailing Edge)
- **Status counters**: `0 UNSEEN`, `0 TAGGED`, `23 ANNOTS`
- **Toggle switch** en la toolbar (propósito no determinado, posiblemente mostrar/ocultar anotaciones)

### 8.3 Grid de Imágenes

- Thumbnails de las imágenes de inspección
- Cada thumbnail es clickeable
- Código de 3 dígitos por imagen (ej: "000", "100")
- Las imágenes con "100" parecen tener anotaciones

### 8.4 Panel de Detalle (derecho)

- **Imagen principal** ampliada de la pala seleccionada
- **Imagen zoom** del defecto seleccionado
- **Controles de zoom**: (+) (-)
- **Secciones colapsables (Accordion)**:
  - Comparison (comparar con inspecciones anteriores)
  - Exif & metadata (datos EXIF de la imagen)
  - Turbine information
  - Change vertical blade
- **Botones de acción**: EDIT, Turn around the blade

---

## 9. Modelo de Datos

### 9.1 Entidades

```typescript
interface Report {
  id: string;                    // Firebase-like ID: "4QD0PFKimOfV2o89LIFX"
  inspectionDate: Date;
  asset: string;                 // "Fila de Mogote"
  subAsset: string;              // "WT01"
  type: string;                  // "Blades"
  defectsCount: number;
  note?: string;
  pdfReportUrl?: string;
}

interface InspectionDetail {
  id: string;
  asset: Asset;
  subAsset: SubAsset;
  date: Date;
  blades: Blade[];
  defects: Defect[];
  conclusions: BladeConclusion[];
  totalDefects: number;
  resolvedDefects: number;
}

interface Blade {
  label: 'A' | 'B' | 'C';
  serialNumber: string;          // "82618", "82612", "82615"
}

interface Defect {
  id: string;                    // Internal ID: "VdR2yrGYbsiY56g5S6xs"
  displayId: string;             // "A1", "B3", "C11"
  type: DefectType;
  category: 1 | 2 | 3 | 4 | 5; // Severity 1 (minor) to 5 (critical)
  blade: 'A' | 'B' | 'C';
  side: 'SS' | 'PS' | 'LE' | 'TE';
  rootDistance: number;          // meters from root (0 to ~43m)
  defectSize: {
    width: number;               // cm
    height: number;              // cm
  };
  resolved: boolean;
}

type DefectType = 
  | 'LE EROSION'
  | 'VORTEX (MISSING PANELS)'
  | 'PAINT DAMAGES'
  | 'BLADES WITH HYDRAULIC OIL'
  | 'OTHER ADD-ONS MISSING'
  | 'OTHER CRACKS'
  | 'LIGHTNING'
  | 'LONGITUDINAL'
  | 'VOIDS';

interface BladeConclusion {
  blade: 'A' | 'B' | 'C' | 'Turbine';
  serialOrId: string;
  text: string;
}

interface AnnotationImage {
  id: string;
  bladeSerial: string;
  side: 'SS' | 'PS' | 'LE' | 'TE';
  status: 'unseen' | 'tagged' | 'annotated';
  thumbnailUrl: string;
  fullUrl: string;
  annotations: Annotation[];
  exifData?: ExifMetadata;
}
```

### 9.2 Enumeraciones Clave

```typescript
// Sides of a wind turbine blade
enum BladeSide {
  SS = 'SS',  // Suction Side
  PS = 'PS',  // Pressure Side
  LE = 'LE',  // Leading Edge
  TE = 'TE',  // Trailing Edge
}

// Defect severity categories
enum DefectCategory {
  CAT_1 = 1,  // Minor - no action required
  CAT_2 = 2,  // Monitor in next inspection
  CAT_3 = 3,  // Repair recommended
  CAT_4 = 4,  // Repair required soon
  CAT_5 = 5,  // Critical - immediate action
}
```

---

## 10. Componentes Reutilizables

| Componente | Uso | Props principales |
|------------|-----|-------------------|
| `SortableTable` | Tabla con sort, paginación, filas clickeables | columns, data, onRowClick, sortable |
| `TablePagination` | Selector de rows per page + nav | rowsPerPage: [5,10,25,100], page, count |
| `SearchBar` | Input de búsqueda global | placeholder="Search all", onSearch |
| `StepNavigation` | Wizard de 4 pasos | steps: [{label, active}], onStepClick |
| `BladeDiagram` | Visualización de pala con defectos | blades, defects, scale, onDefectClick |
| `PieChart` | Donut chart de distribución | data, label, colors |
| `HorizontalBarChart` | Barras horizontales por tipo | data: [{label, value}] |
| `CategoryCounters` | 5 números grandes Cat 1-5 | counts: [n1,n2,n3,n4,n5] |
| `DefectOverviewTable` | Tabla pivote tipo vs categoría | defects grouped by type |
| `ImageGrid` | Grid de thumbnails con status | images, filters, onSelect |
| `DetailPanel` | Panel derecho con imagen zoom + accordion | image, sections |
| `FilterButtons` | Toggle buttons group | options: [{label, value}], multiSelect |
| `ResolvedSwitch` | Switch para marcar resuelto | checked, onChange |
| `Breadcrumb` | Navegación jerárquica | items: [{label, href}] |
| `Sidebar` | Navegación lateral fija | items, activeItem |
| `AccordionSection` | Sección colapsable | title, expanded, children |

---

## 11. Interacciones y UX

### 11.1 Navegación
- Sidebar fija con navegación principal (always visible)
- Breadcrumb para navegación jerárquica en vistas de detalle
- Las filas de tabla actúan como links (cursor:pointer + navegación en click)
- Back navigation via breadcrumb (no browser back button visible)

### 11.2 Tablas
- **Sort**: Click en header → toggle asc/desc
- **Filter**: Icono de filtro junto al sort en columnas específicas (abre dropdown)
- **Row click**: Navega al detalle
- **Pagination**: Selector de rows + botones prev/next

### 11.3 Vista de Detalle
- **Step buttons**: Cambian la vista principal sin cambiar URL (SPA navigation)
- **Tabs (Statistics/Details)**: Contenido cambia debajo
- **Blade diagram**: Click en número → resalta defecto en tabla y viceversa
- **Resolved switch**: Toggle inmediato (optimistic update probable)
- **Accordion sections**: Click → expand/collapse

### 11.4 ANNOTATE
- **Filter buttons**: Toggle (multi-select probable) para blade serial y side
- **Thumbnail click**: Selecciona imagen y la muestra en panel derecho
- **Zoom controls**: +/- para zoom en imagen de detalle
- **"Turn around the blade"**: Cambia perspectiva de la vista de la pala

---

## 12. Screenshots de Referencia

Los siguientes screenshots están disponibles en `.kiro/agents/web-researcher/screenshots/`:

| Archivo | Contenido |
|---------|-----------|
| `reports-main.png` | Vista principal de Reports (tabla completa, full page) |
| `reports-annotated.png` | Vista principal con refs numerados de elementos |
| `report-detail-statistics.png` | Vista de detalle - Tab Statistics (full page) |
| `report-detail-defects-table.png` | Vista de detalle - Tab Details con tabla defectos |
| `report-defect-selected.png` | Defecto seleccionado con blade diagram resaltado |
| `report-annotate-view.png` | Vista ANNOTATE con grid de imágenes y filtros |

---

## 13. Notas para Implementación

1. **Framework recomendado**: React + MUI (Material UI) — es lo que usa Skyvisor
2. **Tablas**: Usar MUI DataGrid o MUI Table con custom sort/filter
3. **Gráficos**: SVG custom o librería como Recharts/Chart.js para pie charts y bar charts
4. **Blade Diagram**: Componente custom SVG con markers posicionados por `rootDistance`
5. **Image Grid**: CSS Grid con aspect ratio fijo por thumbnail
6. **Paginación**: MUI TablePagination component
7. **Routing**: React Router con params dinámicos (`/inspections/:id`)
8. **State management**: Los filtros son locales (no persisten en URL)
9. **IDs**: Parecen ser Firebase document IDs (20 chars alphanumeric)
10. **PDF generation**: Servidor genera PDF descargable (no client-side)

---

## 14. API Endpoints Inferidos

```
GET  /api/reports                    → Lista de reportes (paginada, sortable)
GET  /api/reports?search=<query>     → Filtrado por búsqueda
GET  /api/inspections/{id}           → Detalle completo de inspección
GET  /api/inspections/{id}/defects   → Lista de defectos
GET  /api/inspections/{id}/images    → Imágenes de la inspección
GET  /api/inspections/{id}/pdf       → Descarga reporte PDF
PATCH /api/defects/{id}/resolve      → Toggle resolved status
GET  /api/assets                     → Lista de assets (parques)
GET  /api/assets/{id}/subassets      → SubAssets del parque
```

---
