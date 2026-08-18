---
inclusion: manual
---

# Visual Redesign — Referencia de Implementación

Cuando el usuario pida implementar el rediseño visual de la aplicación, consultar OBLIGATORIAMENTE:

## Documento de Propuesta
#[[file:.kiro/specs/visual-redesign-proposal.md]]

## Resumen ejecutivo para la sesión

### Qué es
Propuesta aprobada de rediseño visual completo de la app wind_farm para diferenciarla de Skyvisor. Solo cambia el look/distribución. Ninguna funcionalidad se modifica.

### Stack técnico a instalar
- Tailwind CSS v4 + @tailwindcss/vite
- shadcn/ui (copy-paste components, base Radix UI)
- Tremor (@tremor/react) — charts y KPI cards
- TanStack Table v8 (@tanstack/react-table)
- Motion (motion.dev) — animaciones
- clsx + tailwind-merge (utilidades)

### Colores (NO CAMBIAR)
- Acento: #5A8F5A
- Sidebar: #1E1E1E (propuesto, más profundo que #2C2C2C actual)
- Fondo página: #F1F4F6 (gris sutil, nuevo)
- Cards: #FFFFFF con shadow sutil

### Tipografía
- Display: DM Sans (semibold, para títulos y métricas)
- Body: Inter (mantener, para texto general)
- Mono: JetBrains Mono (mantener)

### Filosofía
"Metrics-first, details on demand" — KPIs prominentes arriba, tablas/detalles debajo.

### Fases de implementación
1. **Fundación**: Instalar Tailwind + shadcn + crear componentes base (KPICard, DataTable, PageHeader)
2. **Dashboard + Assets**: Rediseñar Dashboard y WindFarmsDashboard
3. **Detail Views**: SubassetDetail, Inspections list, Reports
4. **Workflow + Forms**: Toolbar progress bar, New Inspection wizard, Login
5. **Polish**: Animaciones, dark mode, responsive, performance

### Reglas críticas
- NO modificar funcionalidades ni lógica de negocio
- Respetar paleta cromática (#5A8F5A acento único)
- Migración gradual pantalla por pantalla (no big bang)
- Cada pantalla debe compilar y funcionar después de migrarse
