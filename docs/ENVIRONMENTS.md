# Ambientes (local / staging / producción)

Separación de configuración por ambiente para la base de datos Supabase.
Objetivo: desarrollar sin riesgo de romper producción.

## Resumen

| Ambiente   | Base de datos                          | Config                                  | Cómo se usa                         |
|------------|----------------------------------------|-----------------------------------------|-------------------------------------|
| **local**  | Supabase local (Docker, `supabase start`) | `.env.local`                            | `vite dev` / `vite preview` locales |
| **staging**| 2º proyecto Supabase `wind_farm_staging` (`gfnnxivmencxapvfbqat`) | `.env.staging` + Vercel (scope Preview) | preview deployments de Vercel       |
| **prod**   | Proyecto Supabase actual (`esphlzrzwmzeozjmyvqm`) | Vercel env vars + `.env.production.local` | deploy `vercel --prod`              |

## Cómo carga Vite los `.env`

En `vite dev` (modo `development`): `.env` → `.env.local` → `.env.development` → `.env.development.local`.
Por eso **`.env.local` es el que manda en desarrollo local**.

- `.env.local` → apunta a la base **local** (Docker). Valores los imprime `supabase start`.
- `.env.production.local` → valores de **producción** (para un build local contra prod puntual). No lo usa `vite dev`.
- **Producción (deploy)**: las env vars reales están en la configuración del proyecto en **Vercel**, no en un archivo commiteado.

Todos los `.env*` están en `.gitignore` (no se commitean). La plantilla versionada es `.env.local.example`.

## Archivos

- `.env.local` — desarrollo local (→ Supabase local).
- `.env.staging` — valores del proyecto staging (→ `gfnnxivmencxapvfbqat`). **Git-ignored.**
- `.env.production.local` — valores de prod (respaldo / build local contra prod). **Git-ignored.**
- `.env.local.bak-prod` — respaldo del `.env.local` original que apuntaba a prod. **Git-ignored.** Se puede borrar una vez validado el flujo local.
- `.env.local.example` — plantilla commiteada con la estructura de los 3 ambientes (sin secretos).

## Staging (Fase 3)

- Proyecto Supabase dedicado: **`wind_farm_staging`** · ref `gfnnxivmencxapvfbqat` · org `devaigemm-pro` · región Canada (Central).
- Esquema **clonado de prod** vía `supabase db dump --linked` (32 tablas) — evita el drift de migraciones del repo.
- Datos: **seed de demo** (`supabase/seed.sql`), no se copian datos ni fotos reales de prod.
- Vercel: los **Preview deployments** usan staging (env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` en el scope **Preview** apuntan a staging). Production y Development siguen apuntando a prod.

### Re-clonar esquema de prod a staging (cuando prod cambie)

```bash
export SUPABASE_ACCESS_TOKEN=<token-de-.env.local.bak-prod>
supabase db dump --linked -f /tmp/prod_schema.sql      # con el proyecto prod linkeado
CONN="postgresql://postgres.gfnnxivmencxapvfbqat:<db-pass>@aws-1-ca-central-1.pooler.supabase.com:5432/postgres"
docker run --rm -i postgres:15 psql "$CONN" < /tmp/prod_schema.sql
docker run --rm -i postgres:15 psql "$CONN" < supabase/seed.sql
```

## Estado de implementación (por fases)

- [x] **Fase 1 — Separar configs**: respaldo de prod en `.env.production.local`, plantilla de ambientes documentada, esta guía.
- [x] **Fase 2 — Supabase local**: Supabase local en Docker con el esquema real de prod (clonado por `db dump`), seed de datos de prueba, `.env.local` re-apuntado a `http://127.0.0.1:54331`.
- [x] **Fase 3 — Staging**: 2º proyecto Supabase `wind_farm_staging` (esquema de prod + seed), conectado a los Preview deployments de Vercel.

## Notas

- La base de prod pesa ~30 MB (trivial de replicar). Las ~4 GB de fotos viven en Storage y **no** se copian a dev; en local se usan pocas fotos de prueba (seed).
- Las tablas `repair_*` / `cleaning_*` / `hoist_*` las llena el app móvil vía RPCs que no están en las migraciones del repo; en local estarán vacías hasta seedear datos de prueba.
