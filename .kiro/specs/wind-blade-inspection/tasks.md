# Implementation Plan: Wind Blade Inspection

## Tasks

- [x] 1. Project scaffolding and repository setup
  - [x] 1.1 Initialize Vite + React + TypeScript project with pnpm
    - Create the project using `pnpm create vite` with React TypeScript template
    - Configure `tsconfig.json` with strict mode and path aliases (`@/`)
    - Install core dependencies: `react-router-dom`, `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `zod`, `recharts`, `lucide-react`
    - Install dev dependencies: `vitest`, `fast-check`, `@testing-library/react`, `eslint`, `prettier`
    - Create `.env.local.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
    - Set up the directory structure: `src/components/`, `src/hooks/`, `src/lib/`, `src/pages/`, `src/services/`, `src/store/`, `src/types/`, `src/utils/`, `tests/unit/`, `tests/property/`, `tests/integration/`

  - [x] 1.2 Configure build tooling and CI pipeline
    - Configure `vite.config.ts` with path aliases matching `tsconfig.json`
    - Set up Vitest configuration in `vitest.config.ts`
    - Create ESLint config with TypeScript and React rules
    - Create Prettier config for consistent formatting
    - Create `.github/workflows/ci.yml` with lint, type-check, and Vitest steps
    - Create `vercel.json` with SPA redirect, build command, and cache headers

- [x] 2. Supabase project configuration and database schema
  - [x] 2.1 Create Supabase migrations for core tables
    - Initialize Supabase CLI with `supabase init`
    - Create migration for `profiles`, `wind_farm`, `turbine`, `blade` tables with all constraints and indexes
    - Create migration for `inspection`, `evidence`, `defect`, `defect_image`, `report` tables
    - Include all CHECK constraints (role, status, stage, severity, mime_type, size_bytes, position)
    - Include UNIQUE constraints (wind_farm.name, blade(turbine_id, position), profiles.email)
    - Include FK constraints with appropriate ON DELETE behavior (RESTRICT for assets, CASCADE for inspection children)

  - [x] 2.2 Create database triggers and functions
    - Create `create_blades_for_turbine()` trigger function that inserts 3 blades on turbine creation
    - Create `handle_new_user()` trigger function that creates a profile on auth.users insert
    - Create `set_updated_at()` trigger function and apply to all relevant tables
    - Create `get_user_role()` helper function for RLS policies

  - [x] 2.3 Create Row Level Security policies
    - Enable RLS on all tables
    - Create SELECT policies (all authenticated users can read)
    - Create INSERT/UPDATE/DELETE policies for wind_farm, turbine (supervisor/admin only)
    - Create INSERT/UPDATE policies for inspection (inspector can create; update own in-progress)
    - Create INSERT/DELETE policies for evidence (inspector on own in-progress inspections)
    - Create INSERT/UPDATE/DELETE policies for defect and defect_image

  - [x] 2.4 Create Supabase Storage buckets and policies
    - Create `evidence` bucket (private) with RLS policies
    - Create `reports` bucket (private) with RLS policies
    - Configure storage policies for evidence bucket: authenticated read, inspector upload/delete
    - Configure storage policies for reports bucket: authenticated read/upload

  - [x] 2.5 Create seed data for development
    - Create `supabase/seed.sql` with sample wind farms, turbines, inspections, evidence, and defects
    - Include users with different roles (inspector, supervisor, admin)

- [x] 3. Supabase client initialization and TypeScript types
  - [x] 3.1 Set up Supabase client and generate types
    - Create `src/lib/supabase.ts` with typed Supabase client initialization
    - Create `src/types/supabase.ts` for the generated Database type
    - Create `src/types/index.ts` with application-level interfaces
    - Create shared enums/constants for InspectionStatus, InspectionStage, DefectType, Severity, UserRole

- [x] 4. Authentication integration
  - [x] 4.1 Implement authentication service and hooks
    - Create `src/services/auth.service.ts` with login, logout, getSession, onAuthStateChange
    - Create `src/hooks/useAuth.ts` hook with user, session, isLoading, login, logout
    - Create `src/store/authStore.ts` Zustand store for auth state
    - Implement session inactivity detection (30-min timeout) with auto-logout
    - Create Zod schemas for login form validation

  - [x] 4.2 Implement auth guard and protected routes
    - Create `src/components/AuthGuard.tsx` that redirects unauthenticated users to login
    - Set up React Router with protected routes
    - Implement role-based route guards
    - Handle token refresh and expired session redirect

  - [x] 4.3 Create Login page
    - Create `src/pages/Login.tsx` with email/password form, validation, error display
    - Style with design tokens (centered card, gradient background, responsive)
    - Implement form submission with error handling
    - Redirect to dashboard on successful login

- [x] 5. Design system and base components
  - [x] 5.1 Create design tokens and theme provider
    - Create `src/components/design-system/tokens.css` with all CSS custom properties
    - Create `src/components/design-system/ThemeProvider.tsx` with dark/light toggle
    - Include both light and dark mode token values
    - Set up `prefers-reduced-motion` media query support

  - [x] 5.2 Create atom components
    - Create `Button` component (variants: primary/secondary/ghost/danger, sizes, loading, disabled, icon)
    - Create `Input` component (with label, error, helper text, floating label, focus ring)
    - Create `Badge` component (variants: info/success/warning/danger/neutral)
    - Create `Icon` component (wrapper for Lucide icons)
    - Create `Skeleton` component (variants: text/circle/rect with pulse animation)
    - Create `Avatar` component (with fallback initials, status dot)
    - Create `Tooltip` component (with placement, delay, fade-in animation)

  - [x] 5.3 Create molecule components
    - Create `FormField` component (Label + Input + Error + Helper)
    - Create `SearchBar` component (debounced input, expandable, clear button)
    - Create `FilterChip` component (animated add/remove, multi-select)
    - Create `StatCard` component (icon + number + label + trend)
    - Create `NavItem` component (icon + label + badge, active state)
    - Create `Toast` component (icon, message, action, auto-dismiss)
    - Create `EmptyState` component (illustration + title + description + action)

  - [x] 5.4 Create organism components (layout)
    - Create `Sidebar` component (collapsible, grouped sections, active tracking)
    - Create `TopBar` component (hamburger toggle, logo, search, notifications, avatar dropdown)
    - Create `Breadcrumbs` component (auto-generated from route, truncation)
    - Create `Layout` component (sidebar + top bar + breadcrumbs + content)
    - Create `ConfirmDialog` component (modal with cancel/confirm)
    - Create `ToastContainer` component (manages toast stack)

- [x] 6. Checkpoint - Ensure base setup compiles and renders

- [x] 7. Asset management (Wind Farms, Turbines, Blades)
  - [x] 7.1 Implement asset service layer
    - Create `src/services/assets.service.ts` with CRUD functions using Supabase SDK
    - Implement `getAssetTree()` function for nested structure
    - Implement create/update/delete for wind farms and turbines with error handling
    - Create Zod schemas for asset validation

  - [x] 7.2 Implement asset hooks and state
    - Create `src/hooks/useWindFarms.ts` with React Query
    - Create `src/hooks/useTurbines.ts` with React Query
    - Create `src/hooks/useBlades.ts` with React Query
    - Create `src/hooks/useAssetTree.ts` with React Query
    - Handle optimistic updates and error rollback

  - [x] 7.3 Create AssetTree and detail panel components
    - Create `AssetTree` organism with expand/collapse, selection, lazy loading
    - Create `AssetDetailPanel` component
    - Create `WindFarmForm` component for create/edit
    - Create `TurbineForm` component for create/edit

  - [x] 7.4 Create Assets page
    - Create `src/pages/Assets.tsx` with master-detail split layout
    - Wire AssetTree to detail panel
    - Add contextual actions with role-based visibility
    - Implement delete confirmation with referential integrity error display
    - Handle responsive behavior

  - [ ]* 7.5 Write property tests for asset management
    - Property 4: Turbine Creation Produces Exactly Three Blades
    - Property 5: Unique Name Constraint for Wind Farms
    - Property 6: Referential Integrity on Asset Deletion
    - Property 7: Asset Tree Structural Correctness

- [x] 8. Inspection CRUD and state management
  - [x] 8.1 Implement inspection service layer
    - Create `src/services/inspections.service.ts` with CRUD functions
    - Implement create, list (filtered, paginated), get with related data
    - Create Zod schemas for inspection validation

  - [x] 8.2 Implement inspection state transition logic
    - Create `src/services/inspection-transitions.service.ts`
    - Implement `completeInspection()` calling Edge Function
    - Implement `approveInspection()` calling Edge Function

  - [x] 8.3 Create Supabase Edge Functions for inspection transitions
    - Create `supabase/functions/complete-inspection/index.ts`
    - Create `supabase/functions/approve-inspection/index.ts`
    - Both verify JWT, check role, validate status, record actor and timestamp

  - [x] 8.4 Implement inspection hooks
    - Create `src/hooks/useInspections.ts` for list/filter/paginate
    - Create `src/hooks/useInspection.ts` for single inspection detail
    - Create `src/hooks/useInspectionMutations.ts` for create, complete, approve

  - [x] 8.5 Create Inspection list page
    - Create `src/pages/Inspections.tsx` with FilterBar, DataTable, pagination
    - Implement sortable columns and filter bar
    - Display active filter chips with clear-all
    - Handle empty state

  - [x] 8.6 Create Inspection detail page with tabs
    - Create `src/pages/InspectionDetail.tsx` with header and tab panel
    - Implement tabs: Evidence, Defects, Timeline
    - Show contextual actions based on status and role
    - Wire status transitions with confirmation dialogs

  - [x] 8.7 Create new inspection form
    - Create `src/pages/NewInspection.tsx` with blade selector and date picker
    - Validate blade selection (required)
    - Navigate to detail on success

  - [ ]* 8.8 Write property tests for inspection state machine
    - Property 8: Inspection State Machine Transitions
    - Property 9: Completed Inspection Immutability

- [x] 9. Evidence upload and gallery
  - [x] 9.1 Implement evidence service layer
    - Create `src/services/evidence.service.ts` with upload, list, delete
    - Implement client-side MIME type and file size validation
    - Implement thumbnail URL generation using Supabase image transforms
    - Extract geolocation from EXIF metadata

  - [x] 9.2 Implement evidence hooks
    - Create `src/hooks/useEvidence.ts` for listing evidence
    - Create `src/hooks/useEvidenceUpload.ts` for upload with progress

  - [x] 9.3 Create EvidenceGallery and upload components
    - Create `EvidenceGallery` with thumbnail grid, lightbox, drag-and-drop upload
    - Show upload progress per file
    - Show delete action only for in-progress inspections

  - [ ]* 9.4 Write property test for file upload validation
    - Property 10: File Upload Validation

- [x] 10. Checkpoint - Ensure inspections and evidence flow works

- [x] 11. Defect registration and classification
  - [x] 11.1 Implement defect service layer
    - Create `src/services/defects.service.ts` with CRUD functions
    - Implement create, update, delete with validation
    - Implement image linking/unlinking
    - Create Zod schemas for defect validation

  - [x] 11.2 Implement defect hooks
    - Create `src/hooks/useDefects.ts` for listing defects
    - Create `src/hooks/useDefectMutations.ts` for CRUD operations

  - [x] 11.3 Create DefectPanel and DefectForm components
    - Create `DefectPanel` with defect list, severity indicators, expandable detail
    - Create `DefectForm` for create/edit with type, severity, distance, description, image linking
    - Disable editing when inspection is completed/approved

  - [ ]* 11.4 Write property test for defect severity validation
    - Property 11: Defect Severity Range Validation

- [x] 12. Dashboard with charts and filters
  - [x] 12.1 Create dashboard Edge Function for aggregations
    - Create `supabase/functions/dashboard-aggregate/index.ts`
    - Implement inspection-pipeline, defects-spread, inspection-operations, subassets-status aggregations
    - Verify JWT and handle filters

  - [x] 12.2 Implement dashboard service and hooks
    - Create `src/services/dashboard.service.ts`
    - Create `src/hooks/useDashboard.ts` with React Query per chart
    - Handle loading, error, empty states independently per chart

  - [x] 12.3 Create ChartCard component and dashboard charts
    - Create `ChartCard` organism
    - Create `InspectionPipelineChart` (vertical bars, 6 stages)
    - Create `DefectsSpreadChart` (stacked bars by type × severity)
    - Create `InspectionOperationsChart` (grouped monthly bars)
    - Create `SubassetsStatusChart` (donut chart, 3 segments)

  - [x] 12.4 Create Dashboard page with filter integration
    - Create `src/pages/Dashboard.tsx` with 2x2 grid layout
    - Wire filter controls per chart
    - Implement async chart updates on filter change
    - Handle empty filter results and chart entrance animations

  - [ ]* 12.5 Write property tests for dashboard data
    - Property 14: Pipeline Data Structure Invariant
    - Property 15: Dashboard Filter Correctness
    - Property 16: Subasset Health Classification

- [x] 13. Report generation
  - [x] 13.1 Create report generation Edge Function
    - Create `supabase/functions/generate-report/index.ts` for inspection PDF reports
    - Handle inspections with zero defects
    - Store PDF in reports bucket and create database record

  - [x] 13.2 Create consolidated report Edge Function
    - Create `supabase/functions/generate-consolidated-report/index.ts`
    - Require supervisor role
    - Generate PDF with defect summary grouped by turbine and severity

  - [x] 13.3 Implement report service and hooks
    - Create `src/services/reports.service.ts`
    - Create `src/hooks/useReports.ts` and `src/hooks/useReportGeneration.ts`

  - [x] 13.4 Create Reports page and preview components
    - Create `src/pages/Reports.tsx` with split view
    - Create `ReportPreview` component
    - Add generate actions on inspection detail and farm detail

- [x] 14. History and search functionality
  - [x] 14.1 Implement inspection history service
    - Create `src/services/history.service.ts`
    - Implement filter functions for date range, severity, status
    - Implement global search service

  - [x] 14.2 Implement history and search hooks
    - Create `src/hooks/useBladeHistory.ts`
    - Create `src/hooks/useGlobalSearch.ts`

  - [x] 14.3 Create history UI and integrate search
    - Add inspection history section to blade detail panel
    - Add filter controls
    - Display empty state for no results
    - Wire global search bar in TopBar

  - [ ]* 14.4 Write property tests for history and filters
    - Property 12: Inspection History Ordering
    - Property 13: Filter Correctness

- [x] 15. Checkpoint - Ensure all features integrate correctly

- [ ] 16. Authentication and validation property tests
  - [ ]* 16.1 Write property tests for authentication and session
    - Property 1: RBAC Enforcement
    - Property 2: Session Lifecycle
    - Property 3: Session Inactivity Timeout

  - [ ]* 16.2 Write property test for required field validation
    - Property 17: Required Field Validation

- [x] 17. Error handling and validation utilities
  - [x] 17.1 Implement centralized error handling
    - Create `src/utils/error-mapper.ts`
    - Create `src/hooks/useErrorHandler.ts`
    - Handle all error categories

  - [x] 17.2 Implement client-side validation with Zod
    - Create `src/utils/validation.ts` with shared Zod schemas
    - Implement inline field error display with scroll-to-first-error

- [x] 18. Routing, navigation, and final wiring
  - [x] 18.1 Configure application routing
    - Set up React Router with all routes
    - Implement lazy loading with React.lazy + Suspense
    - Configure breadcrumb generation
    - Wrap routes in AuthGuard

  - [x] 18.2 Wire all components together in App entry point
    - Create `src/App.tsx` with ThemeProvider, QueryClientProvider, AuthGuard, Layout, RouterOutlet
    - Configure React Query client
    - Set up Supabase auth state listener
    - Wire toast notifications and confirm dialog providers

- [x] 19. Deployment configuration
  - [x] 19.1 Configure Vercel deployment
    - Finalize `vercel.json`
    - Document required environment variables
    - Configure Vercel project settings
    - Set up custom domain instructions in README

  - [x] 19.2 Configure Supabase production deployment
    - Document Supabase project creation
    - Create script for applying migrations
    - Document storage bucket creation and Edge Function deployment
    - Configure CORS settings

- [x] 20. Final checkpoint - Ensure all tests pass and application is complete