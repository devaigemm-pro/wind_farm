---
inclusion: manual
---

# Visual Redesign — Instrucciones de Trabajo Continuo

> Este archivo instruye a cualquier sesión que trabaje sobre la rama `feature/visual-redesign-v2`.

## Estado Actual

Branch: `feature/visual-redesign-v2` (basada en main)
Dev server: `npx vite --port 4180`
Feature flag: `VITE_FF_NEW_LAYOUT=true` (en .env.development)

### Pantallas YA migradas (V2 con Tailwind):
- ✅ Login (`LoginV2.tsx`) — Split screen + turbina animada
- ✅ Dashboard (`DashboardV2.tsx`) — KPIs + pipeline bar + donut + activity timeline
- ✅ Wind Farms list (`WindFarmsDashboardV2.tsx`) — Card grid + table toggle
- ✅ Wind Farm Detail (`WindFarmDetailV2.tsx`) — KPIs + 4 tabs
- ✅ Subasset/Turbine Detail (`SubassetDetailV2.tsx`) — Health gauge + timeline
- ✅ Inspections list (`InspectionsV2.tsx`) — Status counters + data table
- ✅ Reports (`ReportsV2.tsx`) — Card gallery + list toggle
- ✅ Profile (`ProfileV2.tsx`) — Cards con Tailwind
- ✅ Ongoing Inspections (`OngoingInspectionsV2.tsx`) — Kanban columns por stage
- ✅ New Inspection (`NewInspectionV2.tsx`) — Wizard 3 pasos
- ✅ Layout shell (sidebar dock + topbar 44px + command palette + bg gris)

### Pantallas PENDIENTES de migración profunda:
- ❌ Inspection Workflow (`InspectionWorkflow.tsx`) — Progress bar segmentado + step transitions
- ❌ Step 1 INSPECT (`InspectStep.tsx`) — Cards Tailwind, checklist, OpenLayers map
- ❌ Step 2 ANNOTATE (`AnnotateStep.tsx`) — Film strip sidebar, floating toolbar, Tailwind classes
- ❌ Step 3 ANALYZE (`AnalyzeStep.tsx`) — Triage board 25/50/25, Save & Next, live stats
- ❌ Step 4 RESULTS (`TurbineDetail.tsx`) — KPI row, Nivo charts, DataTable
- ❌ Campaign Results (`CampaignResults.tsx`)
- ❌ Compare Viewer (`ComparePage.tsx`)

## Requisitos del Rediseño

1. **PROFUNDO** — No wrappers. Cada componente se reescribe con Tailwind classes, sin inline styles
2. **Funcionalidad intacta** — Cada query, mutation, navegación, y acción del usuario DEBE funcionar igual
3. **Referencia visual** — Ver `.kiro/specs/prototype/index.html` para el look esperado
4. **Specs detalladas** — Ver `.kiro/specs/visual-redesign-*.md` (6 documentos) para arquitectura
5. **Colores** — Acento: #5A8F5A. Sidebar: #1E1E1E. Page bg: #F7F8FA. Cards: white con border-gray-100 shadow-sm
6. **Tipografía** — Inter (body). Títulos: text-xl font-semibold. Labels: text-xs text-gray-500
7. **Feature flag** — Todo V2 se activa solo con `VITE_FF_NEW_LAYOUT=true`. El código viejo coexiste

## Cómo continuar

1. Leer `visual-redesign-data-flows.md` para entender qué hooks/mutations usa cada pantalla
2. Leer `visual-redesign-workflow-deep.md` para los steps del workflow
3. Leer `visual-redesign-steps-3-4-deep.md` para ANALYZE y RESULTS
4. Crear archivos V2 nuevos (no modificar los viejos)
5. Conectar en App.tsx via feature flag (pattern ya establecido)
6. Build + verificar que compile sin errores
7. Dev server en puerto libre (4180+)

## Patrón de archivo V2

```typescript
// src/pages/[Name]V2.tsx
import { cn } from '@/lib/utils';
import { useXxx } from '@/hooks/useXxx'; // mismos hooks que la versión actual
// ... toda la UI con Tailwind classes
export function NameV2() { ... }
```

## NO hacer
- No tocar archivos de la versión actual (sin V2 suffix)
- No eliminar el sistema viejo — coexiste
- No pushear a main ni a producción
- No preguntar al usuario — ejecutar directamente
