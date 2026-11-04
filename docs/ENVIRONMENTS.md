# Ambientes (local / producción)

Separación de configuración por ambiente para la base de datos Supabase.
Objetivo: desarrollar sin riesgo de romper producción.

## Resumen

| Ambiente   | Base de datos                          | Config                                  | Cómo se usa                         |
|------------|----------------------------------------|-----------------------------------------|-------------------------------------|
| **local**  | Supabase local (Docker, `supabase start`) | `.env.local`                            | `vite dev` / `vite preview` locales |
| **prod**   | Proyecto Supabase (`esphlzrzwmzeozjmyvqm`) | Vercel env vars + `.env.production.local` | deploy `vercel --prod`              |

## Cómo carga Vite los `.env`

En `vite dev` (modo `development`): `.env` → `.env.local` → `.env.development` → `.env.development.local`.
Por eso **`.env.local` es el que manda en desarrollo local**.

- `.env.local` → apunta a la base **local** (Docker). Valores los imprime `supabase start`.
- `.env.production.local` → valores de **producción** (para un build local contra prod puntual). No lo usa `vite dev`.
- **Producción (deploy)**: las env vars reales están en la configuración del proyecto en **Vercel**, no en un archivo commiteado. Todos los scopes de Vercel (Production / Preview / Development) apuntan a prod.

Todos los `.env*` están en `.gitignore` (no se commitean). La plantilla versionada es `.env.local.example`.

## Archivos

- `.env.local` — desarrollo local (→ Supabase local).
- `.env.production.local` — valores de prod (respaldo / build local contra prod). **Git-ignored.**
- `.env.local.bak-prod` — respaldo del `.env.local` original que apuntaba a prod. **Git-ignored.** Se puede borrar una vez validado el flujo local.
- `.env.local.example` — plantilla commiteada con la estructura de los ambientes (sin secretos).

## Estado de implementación (por fases)

- [x] **Fase 1 — Separar configs**: respaldo de prod en `.env.production.local`, plantilla de ambientes documentada, esta guía.
- [x] **Fase 2 — Supabase local**: Supabase local en Docker con el esquema real de prod (clonado por `db dump`), seed de datos de prueba, `.env.local` re-apuntado a `http://127.0.0.1:54331`.
- [ ] ~~**Fase 3 — Staging**~~: implementada y luego **retirada** (2026-10-31). Se eliminó el proyecto `wind_farm_staging` y los Preview deployments de Vercel volvieron a apuntar a prod. Si en el futuro se necesita staging, se puede recrear clonando el esquema de prod con `supabase db dump --linked` + `supabase/seed.sql`.

## Notas

- La base de prod pesa ~30 MB (trivial de replicar). Las ~4 GB de fotos viven en Storage y **no** se copian a dev; en local se usan pocas fotos de prueba (seed).
- Las tablas `repair_*` / `cleaning_*` / `hoist_*` las llena el app móvil vía RPCs que no están en las migraciones del repo; en local estarán vacías hasta seedear datos de prueba.
