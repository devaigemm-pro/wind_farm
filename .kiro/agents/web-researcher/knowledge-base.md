# Base de Conocimiento - Web Researcher

> Última actualización: 2026-07-21
> Total de fuentes: 1

---

## Skyvisor - Plataforma de Inspección de Parques Eólicos

**URL**: https://app.skyvisor.io
**Fecha de última extracción**: 2026-07-21
**Categoría**: SaaS - Gestión de inspecciones de aerogeneradores / parques eólicos

### Vista: Detalle de Inspección (4. RESULTS) - `/inspections/{id}`

**URL explorada**: https://app.skyvisor.io/inspections/6Uva57kLoG9Vj24DlTF1

#### Estructura de la vista:

**Toolbar superior:**
- Breadcrumb: `Fila de Mogote > Turbine WT01 > [fecha]`
- 4 pasos: `1. INSPECT` | `2. ANNOTATE` | `3. ANALYZE` | `4. RESULTS`
- Botón "Search all"
- 2 botones de acción adicionales (icons)

**Panel izquierdo - Blade Diagram:**
- Heading "Blades" (h5)
- 3 palas (A, B, C) con seriales
- Escala 0m → 43m
- Defectos marcados como números clickeables en cada pala
  - Blade A: 7 defectos (1-7)
  - Blade B: 4 defectos (1-4)  
  - Blade C: 6 defectos (1-6)
- Controles zoom (+/-)
- Botón de pantalla completa

**Panel derecho - Resultados:**
- Resumen: "17 defects", "0 resolved"
- Sección "Conclusion" con conclusiones por turbina y por cada pala
- Botón "PLAN NEXT INSPECTION"
- Tabs: `Statistics` | `Details`

**Tab Statistics:**
- "Breakdown by blade": 3 donut/pie charts (Blade A, B, C)
- "Breakdown by category": 5 contadores grandes (Cat 5: 0, Cat 4: 0, Cat 3: 8, Cat 2: 2, Cat 1: 7)
- "Breakdown by type": gráfico barras horizontal
- "Defect overview table":
  | Defects | Total/Type | Cat 5 | Cat 4 | Cat 3 | Cat 2 | Cat 1 |
  |---------|-----------|-------|-------|-------|-------|-------|
  | VORTEX (MISSING PANELS) | 3 | 0 | 0 | 3 | 0 | 0 |
  | LE EROSION | 3 | 0 | 0 | 3 | 0 | 0 |
  | PAINT DAMAGES | 6 | 0 | 0 | 1 | 2 | 3 |
  | OTHER ADD-ONS MISSING | 2 | 0 | 0 | 1 | 0 | 1 |
  | BLADES WITH HYDRAULIC OIL | 3 | 0 | 0 | 0 | 0 | 3 |
  | Total/Category | 17 | 0 | 0 | 8 | 2 | 7 |

**Tab Details:**
- Tabla de defectos con columnas:
  - Id (A1, B2, C3...)
  - Type
  - Category (severidad 1-5)
  - Blade (A/B/C)
  - Side (SS/PS/LE/TE)
  - Root distance (m)
  - Defect size (cm) (ej: "10 x 377")
  - Edit (icono pencil)
  - Resolved (switch toggle, header muestra "Resolved (0)")
- Columnas filtrables: Type, Category, Blade, Side (tienen icono filter)
- Columnas sortables: Id, Type, Category, Blade, Side, Root distance
- Filas clickeables (selecciona defecto en blade diagram)
- Botón "Add" para agregar defecto

---

## Skyvisor - Plataforma de Inspección de Parques Eólicos

**URL**: https://app.skyvisor.io
**Fecha de última extracción**: 2026-07-21
**Categoría**: SaaS - Gestión de inspecciones de aerogeneradores / parques eólicos

### Funcionalidades

#### 1. Dashboard (Panel Principal)
- **Inspection Pipeline**: Pipeline visual del estado de inspecciones con etapas:
  - To Plan → Planned → Upload → Annotate → Analyze → Finalized
  - Muestra contadores por cada etapa
  - Filtrable por Type(s)
- **Defects Spread**: Gráfico de barras horizontal con distribución de defectos por tipo:
  - Tipos de defectos: LE EROSION, VORTEX, PAINT DAMAGE, LONGITUDINAL, BLADES, OTHER CRACKS, OTHER AREAS, LIGHTNING, VOIDS
  - Clasificación por severidad (1-5)
  - Filtrable por: Type(s), Farm(s), Model(s), Severity
- **Inspection Operations**: Gráfico temporal (meses) mostrando:
  - Inspecciones a planificar
  - Inspecciones planificadas
  - Inspecciones completadas
  - Filtrable por: Type(s), Farm(s)
- **Subassets Status**: Mapa/gráfico de tiempo desde última inspección:
  - > 6 months (rojo)
  - 6 to 3 months (amarillo)
  - < 3 months (verde)
  - Filtrable por Type(s)

#### 2. Wind Farms (Parques Eólicos)
- Vista con 3 tabs: **Assets**, **Defects**, **Global Map**
- **Assets Tab**: Tabla con columnas:
  - Asset Name (nombre del parque)
  - SubAssets Count (número de aerogeneradores)
  - # Inspections (total de inspecciones)
  - Total Power (potencia total en kW)
  - Powering Date (fecha de puesta en marcha)
  - Oldest Inspection (inspección más antigua)
- Datos observados: "Fila de Mogote" - 7 subassets, 16 inspecciones, 21000 kW, desde 11/25/2015
- Búsqueda y filtrado disponible
- Paginación configurable (5/10/25/100 rows)

#### 3. New Inspection (Crear Nueva Inspección)
- Formulario simple con:
  - Selector de Asset (combobox)
  - Botón CREATE
  - Búsqueda disponible

#### 4. Uploader (Carga de Imágenes)
- Área de drag & drop para imágenes
- Botón "Choose Files" alternativo
- Tabla de inspecciones con columnas:
  - Inspection Date
  - Asset
  - SubAsset
  - Type
  - Note
  - Progress
  - Photos
- Filtros por columna (Asset, SubAsset, Type)
- Paginación configurable

#### 5. Ongoing Inspections (Inspecciones en Curso)
- Vistas: STATUS / LIST
- Botón "> Reports" para generar reportes
- Agrupación por parque eólico con:
  - Porcentaje de avance ("6% viewed")
  - Número de items
  - Defectos encontrados
- Inspecciones individuales muestran: SubAsset, fecha, porcentaje/defectos

#### 6. Reports (Reportes)
- Tabla con columnas:
  - Inspection Date
  - Asset
  - SubAsset
  - Type (tipo de inspección, ej: "Blades")
  - Defects (número de defectos encontrados)
  - Note (notas, ej: "Correct one")
  - PDF Report (botón de descarga)
- Datos observados: múltiples inspecciones de "Fila de Mogote" (WT01-WT07) con 13-54 defectos por inspección
- Paginación configurable
- Las filas son clickeables (acceden al detalle)

### Componentes UI
- **Navegación lateral**: Sidebar con iconos y texto, secciones ASSETS e INSPECTIONS
- **Barra de búsqueda global**: Presente en todas las páginas ("Search all")
- **Tablas paginadas**: Con ordenamiento por columna, filtros, y selección de rows por página
- **Comboboxes/filtros**: Múltiples filtros dropdown en Dashboard
- **Gráficos**: SVG-based charts (barras horizontales, líneas temporales, pipeline visual)
- **Drag & drop area**: Para upload de imágenes
- **Accordion/Collapsible**: En inspecciones ongoing, agrupado por parque

### Flujos de Trabajo

1. **Flujo de Inspección Completo**:
   ```
   Crear inspección (New) → Subir imágenes (Uploader) → Anotar defectos (Annotate) → Análisis (Analyze) → Finalizado (Reports)
   ```

2. **Pipeline de estados**:
   - To Plan: Inspecciones por planificar
   - Planned: Inspecciones planificadas
   - Upload: Esperando carga de imágenes
   - Annotate: En proceso de anotación de defectos
   - Analyze: En análisis
   - Finalized: Completadas, con reporte disponible

3. **Flujo de generación de reportes**:
   - Desde Ongoing → botón "> Reports"
   - Descarga PDF por inspección individual

### Detalles Técnicos
- **Autenticación**: Login con email + password (flujo de dos pasos: email → continue → password → log in)
- **URLs base**: `https://app.skyvisor.io`
- **Rutas principales**:
  - `/login` - Página de autenticación
  - `/inspections/reports` - Reportes
  - `/inspections/ongoing` - Inspecciones en curso
  - `/inspections/new` - Crear nueva inspección
  - `/inspections/uploader` - Cargador de imágenes
  - `/wind-farms` (estimado) - Parques eólicos
  - `/dashboard` (estimado) - Dashboard principal
- **Tecnología frontend**: React SPA (navegación sin recarga)
- **Gráficos**: SVG nativos (no librería identificada claramente)
- **Acciones disponibles**: Activar cuenta, recuperar password, crear cuenta

### Modelo de Datos Observado

| Entidad | Campos |
|---------|--------|
| Wind Farm (Asset) | name, subassets_count, inspections_count, total_power, powering_date, oldest_inspection |
| SubAsset | id (WT01, WT02...), pertenece a un Asset |
| Inspection | date, asset, subasset, type, defects_count, note, status, progress, photos |
| Defect | type (LE EROSION, VORTEX, etc.), severity (1-5) |
| Report | inspection_date, asset, subasset, type, defects, note, pdf_url |

### Roles/Permisos
- Usuario logueado: `risto.martinez@core-tec.cl`
- Funcionalidades de "Profile" disponibles
- Opción de "Exit" (logout)

### Notas Adicionales
- El sistema parece especializado en inspección de **palas de aerogeneradores** (Blades)
- Los defectos principales son erosión, vórtices, daño de pintura, grietas longitudinales, impacto de rayos, vacíos
- El parque "Fila de Mogote" tiene 7 aerogeneradores (WT01-WT07)
- Las inspecciones generan entre 13 y 54 defectos por subasset
- El sistema soporta anotación de defectos sobre imágenes de drones (inferido del flujo upload → annotate)

---
