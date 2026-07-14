# Wind Blade Inspection

A web application for managing wind turbine blade inspections, defect tracking, and report generation. Built with React, TypeScript, Supabase, and Vite.

## Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase CLI (`npx supabase`)
- Vercel CLI (optional, for deployment)

## Local Development

### 1. Clone and Install

```bash
git clone <repository-url>
cd wind-blade-inspection
pnpm install
```

### 2. Environment Variables

Copy the example environment file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable                | Description                          |
| ----------------------- | ------------------------------------ |
| `VITE_SUPABASE_URL`    | Your Supabase project URL            |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |

### 3. Supabase Setup

#### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy the project URL and anon key into your `.env.local`.

#### Run Database Migrations

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies the migrations in `supabase/migrations/`:
- `20240101000001_create_tables.sql` — Core schema (wind_farm, turbine, blade, inspection, defect, evidence, report, profiles)
- `20240101000002_create_triggers.sql` — Database triggers
- `20240101000003_create_rls_policies.sql` — Row-level security policies
- `20240101000004_create_storage.sql` — Storage buckets for evidence images

#### Deploy Edge Functions

```bash
npx supabase functions deploy approve-inspection
npx supabase functions deploy complete-inspection
npx supabase functions deploy dashboard-aggregate
npx supabase functions deploy generate-consolidated-report
npx supabase functions deploy generate-report
```

#### Seed Data (Optional)

```bash
npx supabase db seed
```

### 4. Run Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`.

### 5. Run Tests

```bash
pnpm test
```

### 6. Build for Production

```bash
pnpm build
```

## Deployment (Vercel)

The project includes a `vercel.json` with SPA routing rewrites configured.

### Steps

1. Install Vercel CLI: `npm i -g vercel`
2. Link to your Vercel project: `vercel link`
3. Set environment variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy:
   ```bash
   vercel --prod
   ```

Alternatively, connect the GitHub repository directly in the Vercel dashboard for automatic deployments on push.

## Project Structure

```
src/
├── components/        # UI components (atoms, molecules, organisms)
├── hooks/             # React Query hooks and custom hooks
├── lib/               # Supabase client configuration
├── pages/             # Route-level page components
├── services/          # API service layer
├── store/             # Zustand state stores
├── types/             # TypeScript type definitions
└── utils/             # Validation schemas and utilities

supabase/
├── functions/         # Edge Functions (report generation, approvals)
├── migrations/        # Database schema migrations
└── seed/              # Seed data
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: CSS design tokens (no framework)
- **State**: Zustand (auth/toast), TanStack React Query (server state)
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Validation**: Zod
- **Charts**: Recharts
- **Testing**: Vitest, Testing Library, fast-check
- **Deployment**: Vercel
