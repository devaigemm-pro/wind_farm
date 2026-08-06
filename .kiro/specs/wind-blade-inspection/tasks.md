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

- [x] 21. Wind Farms Dashboard — Módulo de Gestión de Parques Eólicos (Vista de Assets)
  - [x] 21.1 Create database migration for dashboard support
    - Add `powering_date` column (TIMESTAMPTZ) to `wind_farm` table if not exists
    - Add `power_kw` column (NUMERIC, DEFAULT 0) to `turbine` table if not exists
    - Create `get_wind_farms_dashboard()` RPC function that returns aggregated data (id, name, sub_assets_count, inspections_count, total_power, powering_date, oldest_inspection) using JOINs across wind_farm → turbine → blade → inspection
    - Apply migration with `supabase db push` or local CLI

  - [x] 21.2 Create TypeScript types and extend service layer
    - Add `WindFarmDashboardRow` interface to `src/types/index.ts` with fields: id, name, subAssetsCount, inspectionsCount, totalPower, poweringDate, oldestInspection
    - Add `getWindFarmsDashboard()` method to `src/services/assets.service.ts` using `supabase.rpc('get_wind_farms_dashboard')`
    - Map snake_case response to camelCase `WindFarmDashboardRow`

  - [x] 21.3 Create React Query hook for dashboard data
    - Create `src/hooks/useWindFarmsDashboard.ts` with `useQuery` and queryKey `['wind-farms-dashboard']`
    - Return typed `WindFarmDashboardRow[]` with loading and error states

  - [x] 21.4 Create TabBar molecule component
    - Create `src/components/molecules/TabBar.tsx` with props: `tabs` (array of {id, label}), `activeTab`, `onChange`
    - Implement active state with blue bottom border (`var(--color-primary-600)`) and bold text
    - Implement inactive state with gray text and transparent border
    - Add hover state transition
    - Export from `src/components/molecules/index.ts`

  - [x] 21.5 Create TablePagination molecule component
    - Create `src/components/molecules/TablePagination.tsx` with props: page, rowsPerPage, totalCount, rowsPerPageOptions, onPageChange, onRowsPerPageChange
    - Implement "Rows per page:" label with styled `<select>` dropdown (options: 5, 10, 25, 100)
    - Implement range indicator text "{from}-{to} of {total}"
    - Implement prev/next buttons with `ChevronLeft`/`ChevronRight` icons from Lucide
    - Disable buttons when on first/last page
    - Align to right with flexbox
    - Export from `src/components/molecules/index.ts`

  - [x] 21.6 Create WindFarmsTable organism component
    - Create `src/components/organisms/WindFarmsTable.tsx` with props: data, isLoading, sortField, sortDirection, onSort
    - Implement table header with 6 columns: Asset Name, SubAssets Count, # Inspections, Total Power, Powering Date, Oldest Inspection
    - Implement clickable column headers with sort arrow indicator (↑/↓)
    - Style headers: gray background, bold, uppercase, small font
    - Style rows: 1px border-bottom (#E5E7EB), hover highlight
    - Implement loading state with Skeleton rows (variant="rect", height="48px")
    - Format dates (Powering Date, Oldest Inspection) in locale format
    - Format Total Power with number formatting (commas)
    - Export from `src/components/organisms/index.ts`

  - [x] 21.7 Create WindFarmsDashboard page
    - Create `src/pages/WindFarmsDashboard.tsx` as the main page component
    - Implement page header with title "Wind Farms" (H1, color #111827, top-left aligned)
    - Integrate `SearchBar` molecule with placeholder "Search all and filter" and 300ms debounce
    - Integrate `TabBar` with tabs: Assets, Defects, Global Map (Assets active by default)
    - Implement local state: activeTab, searchQuery, sortField, sortDirection, page, rowsPerPage
    - Implement client-side filtering: case-insensitive search on `name` field
    - Implement client-side sorting by any column with asc/desc toggle
    - Implement client-side pagination using slice on filtered+sorted data
    - Reset page to 1 on search query change, sort change, or rows-per-page change
    - Integrate `WindFarmsTable` for Assets tab content
    - Integrate `TablePagination` below the table
    - Show `EmptyState` when no results after filtering
    - Defects and Global Map tabs render placeholder content ("Coming soon" or empty state)
    - Container: white background (#FFFFFF), rounded borders (8px), light shadow

  - [x] 21.8 Add route and navigation
    - Add lazy import for `WindFarmsDashboard` in `src/App.tsx`
    - Add `/assets-wind` route wrapped in `AuthGuard` + `AppLayout`
    - Add "Wind Farms" navigation item to `Sidebar` component linking to `/assets-wind`
    - Verify route works with direct URL access and SPA navigation

  - [x] 21.9 Integration verification and checkpoint
    - Verify the page loads with skeleton state during data fetch
    - Verify search filters data correctly with debounce
    - Verify all 6 columns sort correctly (asc/desc toggle)
    - Verify pagination controls (rows per page change, prev/next buttons, range indicator)
    - Verify tab switching renders correct content without page reload
    - Verify empty state displays when search returns no results
    - Verify the application compiles without TypeScript errors (`tsc -b`)


- [x] 22. Módulo de Gestión de Defectos — Vista de Defects (Wind Farms Dashboard)
  - [x] 22.1 Create database migration for defects dashboard support
    - Add new columns to `defect` table: `width_cm` (NUMERIC DEFAULT 0), `height_cm` (NUMERIC DEFAULT 0), `side` (VARCHAR(2) DEFAULT 'LE'), `action_text` (TEXT), `action_urgency` (VARCHAR(10) DEFAULT 'medium'), `next_step` (TEXT), `root_cause` (TEXT), `notes` (TEXT), `resolved` (BOOLEAN DEFAULT FALSE)
    - Add CHECK constraint `defect_side_check` for side IN ('LE', 'SS', 'TE', 'PS')
    - Add CHECK constraint `defect_action_urgency_check` for action_urgency IN ('high', 'medium', 'low')
    - Add `model` column (TEXT) to `turbine` table if not exists
    - Create `defect_comment` table with columns: id (UUID PK), defect_id (FK → defect CASCADE), author_id (FK → profiles), text (TEXT NOT NULL), created_at (TIMESTAMPTZ DEFAULT NOW())
    - Create index `idx_defect_comment_defect_id` on defect_comment(defect_id)
    - Enable RLS on `defect_comment` with SELECT policy for authenticated and INSERT policy with author_id = auth.uid()
    - Create `get_defects_dashboard` RPC function that JOINs defect → inspection → blade → turbine → wind_farm and returns paginated, sortable, searchable results with total_count window function
    - Update seed data to populate new defect columns with realistic values (width/height, side, action_text, urgency, next_step, root_cause, notes, resolved) and add sample defect_comments

  - [x] 22.2 Create TypeScript types for defects dashboard
    - Add `DefectDashboardRow` interface to `src/types/index.ts` with fields: id, assetName, turbineName, turbineModel, type, defectWidth, defectHeight, category, actionText, actionUrgency, nextStep, bladePosition, side, rootDistance, rootCause, notes, imageUrl, resolved, inspectionId, bladeId
    - Add `DefectComment` interface with fields: id, defectId, authorId, authorName, text, createdAt
    - Add `DefectSortField` type union covering all sortable columns
    - Add blade position mapping constant: `BLADE_POSITION_LABELS`: { 1: 'A', 2: 'B', 3: 'C' }
    - Add `DEFECT_TYPE_DISPLAY_LABELS` constant mapping internal types to display text (ej. 'le_erosion' → 'LE EROSION', 'vortex' → 'VORTEX (MISSING PANELS)')

  - [x] 22.3 Extend defects service layer with dashboard methods
    - Add `listDefectsDashboard(params)` method to `defectsService` calling `supabase.rpc('get_defects_dashboard')` with search, limit, offset, sortField, sortDir parameters
    - Implement snake_case to camelCase mapping function `mapToDefectDashboardRow`
    - Add `getDefectComments(defectId)` method querying `defect_comment` with author profile join
    - Add `addDefectComment(defectId, text)` method inserting into `defect_comment` with current user's auth.uid()
    - Add `toggleDefectResolved(id, resolved)` method updating the `resolved` field
    - Add `exportDefectsList(params)` method that fetches all matching rows and generates a CSV Blob
    - Implement `generateCSV(data: DefectDashboardRow[])` utility function with headers and ";" separator

  - [x] 22.4 Create React Query hooks for defects dashboard
    - Create `src/hooks/useDefectsDashboard.ts` with `useQuery` accepting search, page, rowsPerPage, sortField, sortDir; queryKey: ['defects-dashboard', params]; use `placeholderData` for smooth pagination transitions
    - Create `src/hooks/useDefectComments.ts` with `useQuery` for comments list (queryKey: ['defect-comments', defectId], enabled: !!defectId) and `useAddDefectComment` mutation with cache invalidation on success
    - Create `src/hooks/useDefectResolvedToggle.ts` with `useMutation` calling `toggleDefectResolved` and invalidating ['defects-dashboard'] queries on success

  - [x] 22.5 Create ExportButton atom component
    - Create `src/components/atoms/ExportButton.tsx` with props: onClick, loading (optional)
    - Style: background green (#27AE60), white text, rounded borders, Download icon from Lucide
    - Text: "EXPORT LIST" in uppercase
    - Hover state: darker green (#1E8449)
    - Loading state: spinner icon replacing download icon, disabled
    - Export from `src/components/atoms/index.ts`

  - [x] 22.6 Create DefectsTable organism component
    - Create `src/components/organisms/DefectsTable.tsx` with props: data, isLoading, sortField, sortDirection, onSort, selectedId, onSelect
    - Implement 11 sortable columns: Asset, Turbine, Model, Type, Defect size (cm), Category, Action, Next step, Blade, Side, Root distance (m)
    - Style table with dark background (#0A1929) for rows, white/light gray text
    - Implement clickable rows with selected state highlight (rgba(0, 163, 224, 0.15) background)
    - Category column: render Badge with orange (#F2994A) for severity 3, dark orange (#E06300) for severity 4, red for 5, with white text
    - Action column: render colored vertical bar (orange for high urgency, yellow for medium) left of action text
    - Defect size column: format as "W x H" from defectWidth and defectHeight
    - Blade column: map position number to letter (1→A, 2→B, 3→C)
    - Implement skeleton loading state with Skeleton variant="rect" rows
    - Header style: sortable with arrow indicators, uppercase text, dark header background
    - Export from `src/components/organisms/index.ts`

  - [x] 22.7 Create DefectComments molecule component
    - Create `src/components/molecules/DefectComments.tsx` with prop: defectId
    - Use `useDefectComments` hook to fetch comment list
    - Display section header "Comments (N)" with comment count
    - Render each comment: author name (bold), relative date (ej. "7/3/2024"), comment text
    - Add input field with placeholder "New comment" and send button (arrow icon) on the right
    - On submit: call `useAddDefectComment` mutation, clear input
    - Style: white background, compact spacing, scroll if many comments
    - Export from `src/components/molecules/index.ts`

  - [x] 22.8 Create DefectImageViewer organism component
    - Create `src/components/organisms/DefectImageViewer.tsx` with props: imageUrl, zoomLevel, onZoomIn, onZoomOut, onCompare
    - Render image container with `overflow: hidden` and fixed aspect ratio
    - Apply `transform: scale(zoomLevel)` with `transform-origin: center` to image
    - Add zoom buttons (+/-) in bottom-right corner of viewer with current scale display (ej. "x1.00")
    - Add mouse wheel handler for zoom (deltaY → zoom in/out by 0.25 steps)
    - Enforce zoom bounds: min 0.5, max 4.0
    - Add "COMPARE" button below the image viewer (blue outline style)
    - Show placeholder/empty state when imageUrl is null
    - Export from `src/components/organisms/index.ts`

  - [x] 22.9 Create BladeDiagram organism component
    - Create `src/components/organisms/BladeDiagram.tsx` with props: side, rootDistance, bladeLength (default 45)
    - Render inline SVG with stylized blade profile showing both sides (SS left, PS right)
    - Calculate position of defect indicator: `(rootDistance / bladeLength) * svgHeight`
    - Render yellow circle (#FFD700) at calculated position on the correct side
    - Add "SS" and "PS" labels at the top of each blade section
    - Background: light gray; blade silhouette: green/teal fill
    - SVG should be responsive (viewBox based, scales with container)
    - Export from `src/components/organisms/index.ts`

  - [x] 22.10 Create DefectDetailSidebar organism component
    - Create `src/components/organisms/DefectDetailSidebar.tsx` with props: defect (DefectDashboardRow | null), onResolvedToggle, zoomLevel, onZoomChange
    - Implement scroll-independent panel with `overflow-y: auto` and fixed width (~30%)
    - Header section: defect type name (H3, bold) + external link icon + Category badge + Status toggle switch
    - Metadata section: "Defect size:" formatted as "W x H", "Blade Side:" value
    - Info section: "Root Cause:", "Next Step:", "Notes:" as labeled read-only text blocks
    - Integrate `DefectComments` component passing defectId
    - Integrate `DefectImageViewer` with zoom state
    - Integrate `BladeDiagram` with side and rootDistance from selected defect
    - White background (#FFFFFF), border-left separator, padding consistent with design tokens
    - Show empty/placeholder state when defect is null
    - Export from `src/components/organisms/index.ts`

  - [x] 22.11 Create DefectsWindFarmsView organism (layout orchestrator)
    - Create `src/components/organisms/DefectsWindFarmsView.tsx` as the main container for the Defects tab
    - Implement split layout: left panel (DefectsTable ~70%) + right panel (DefectDetailSidebar ~30%) using CSS flexbox
    - Manage local state: selectedDefectId, zoomLevel
    - On data load, auto-select first defect row
    - On row click, update selectedDefectId → sidebar re-renders with new data
    - If no defects exist, show EmptyState full-width (no sidebar)
    - Both panels have independent `overflow-y: auto` with `height: calc(100vh - header)`
    - Smooth CSS transition on sidebar open/close
    - Export from `src/components/organisms/index.ts`

  - [x] 22.12 Integrate Defects tab into WindFarmsDashboard page
    - Import `DefectsWindFarmsView` and `ExportButton` in `src/pages/WindFarmsDashboard.tsx`
    - Replace the existing defects tab placeholder with `DefectsWindFarmsView` component
    - Add `ExportButton` next to the tab bar when defects tab is active
    - Add state management for defects tab: searchQuery (shared with assets), sortField, sortDirection, page, rowsPerPage
    - Wire search bar to filter defects when defects tab is active (debounce 300ms, server-side search)
    - Pass all state and handlers down to `DefectsWindFarmsView`
    - Ensure tab switching preserves each tab's state independently
    - Handle error states with toast notifications via existing error handler

  - [x] 22.13 Implement CSV export functionality
    - Create `src/utils/csv-export.ts` with `generateCSV(data: DefectDashboardRow[])` function
    - Generate CSV with headers: Asset, Turbine, Model, Type, Defect Size (cm), Category, Action, Next Step, Blade, Side, Root Distance (m)
    - Use ";" as separator for international compatibility
    - Create `downloadBlob(blob: Blob, filename: string)` utility using temporary `<a>` element with `URL.createObjectURL`
    - Wire ExportButton onClick: call `defectsService.exportDefectsList` with current search filters → `downloadBlob` with filename `defects-export-{date}.csv`
    - Show loading state on button during export, toast on success/error

  - [x] 22.14 Integration verification and checkpoint
    - Verify the Defects tab loads with skeleton during data fetch from `get_defects_dashboard` RPC
    - Verify all 11 columns render correctly with proper formatting (size "WxH", blade position A/B/C, category badges, action urgency bars)
    - Verify row selection highlights the row and updates the sidebar panel
    - Verify first row is auto-selected on initial load
    - Verify sorting works for all columns (click header → toggle asc/desc, reset page to 1)
    - Verify pagination with 25 rows per page default, range indicator, prev/next buttons
    - Verify search filters defects server-side with 300ms debounce
    - Verify the detail panel shows: type, category badge, status toggle, defect size, blade side, root cause, next step, notes
    - Verify comments section loads and allows adding new comments
    - Verify image viewer zoom controls (+/-, wheel, scale indicator)
    - Verify blade diagram SVG renders with correct defect position indicator
    - Verify EXPORT LIST button downloads CSV with filtered data
    - Verify toggle resolved updates the defect and refreshes the table
    - Verify independent scroll on table and sidebar panels
    - Verify the application compiles without TypeScript errors (`tsc -b`)


- [x] 23. Módulo de Ficha del Parque Eólico (Asset Detail View) — Design Section 17
  - [x] 23.1 Create database migration for Asset Detail support
    - Create `scripts/migrate-asset-detail.sql` with:
      - `campaign` table (id, name, wind_farm_id FK, created_by FK, created_at, updated_at)
      - `asset_document` table (id, wind_farm_id FK, file_name, file_path, file_size, mime_type, uploaded_by, created_at)
      - Add `campaign_id` (UUID FK nullable) to `inspection` table
      - Add `serial_number`, `tower_serial_number`, `anticlockwise`, `powering_date` to `turbine`
      - Add `serial_number` to `blade`
      - Add `inspection_type`, `photos_count`, `viewed_percent`, `notes` to `inspection`
      - RLS policies for `campaign` (authenticated SELECT, supervisor/admin ALL)
      - RLS policies for `asset_document` (authenticated SELECT, supervisor/admin ALL)
      - Index on `campaign(wind_farm_id)`, `inspection(campaign_id)`, `asset_document(wind_farm_id)`
      - `updated_at` trigger for `campaign`
    - Create RPC function `get_wind_farm_detail(p_wind_farm_id UUID)` returning aggregated park data
    - Create RPC function `get_wind_farm_subassets(p_wind_farm_id UUID)` returning turbines with inspection counts

  - [x] 23.2 Create TypeScript types for Asset Detail
    - Add `WindFarmDetail` interface to `src/types/index.ts`
    - Add `TurbineSubassetRow` interface
    - Add `Campaign` interface
    - Add `CampaignInspection` interface
    - Add `AssetDocument` interface
    - Add `TurbineSerialNumbers` interface
    - Add `CampaignTurbineResult` interface

  - [x] 23.3 Create Asset Detail service layer
    - Create `src/services/asset-detail.service.ts` with `AssetDetailServiceError` class
    - Implement `getWindFarmDetail(windFarmId)` using `supabase.rpc('get_wind_farm_detail')`
    - Implement `getSubassets(windFarmId)` using `supabase.rpc('get_wind_farm_subassets')`
    - Implement `getCampaigns(windFarmId)` querying `campaign` table
    - Implement `createCampaign(windFarmId, name)` with current user as `created_by`
    - Implement `updateCampaign(campaignId, name)` and `deleteCampaign(campaignId)`
    - Implement `assignInspectionsToCampaign(campaignId, inspectionIds)`
    - Implement `getCampaignInspections(campaignId)` with nested joins (blade → turbine)
    - Implement `getWindFarmInspections(windFarmId)` for campaign assignment modal
    - Implement `getSerialNumbers(windFarmId)` joining turbine + blades
    - Implement `updateSerialNumbers(serials[])` updating turbine and blade serial fields
    - Implement `getDocuments(windFarmId)`, `uploadDocument(windFarmId, file)`, `deleteDocument(id, path)`, `getDocumentUrl(path)`

  - [x] 23.4 Create React Query hooks for Asset Detail
    - Create `src/hooks/useWindFarmDetail.ts` with hooks:
      - `useWindFarmDetail(windFarmId)` — query wind farm aggregated data
      - `useSubassets(windFarmId)` — query turbines list
      - `useCampaigns(windFarmId)` — query campaigns
      - `useCampaignInspections(campaignId)` — query inspections of a campaign
      - `useWindFarmInspections(windFarmId)` — query all inspections for assignment modal
      - `useCreateCampaign()` — mutation with invalidation of ['campaigns']
      - `useUpdateCampaign()` — mutation
      - `useDeleteCampaign()` — mutation
      - `useAssignInspectionsToCampaign()` — mutation
      - `useSerialNumbers(windFarmId)` — query serial numbers
      - `useUpdateSerialNumbers()` — mutation
      - `useAssetDocuments(windFarmId)` — query documents
      - `useUploadDocument()` — mutation
      - `useDeleteDocument()` — mutation

  - [x] 23.5 Create DetailsBlock organism component
    - Create `src/components/organisms/DetailsBlock.tsx`
    - Display 4 calculated metrics in 2×2 grid: Oldest inspection, Powering date, Total power (kW), Number of sub-assets
    - Labels in gray (text-xs), values in bold dark (text-sm)
    - "Plan a New Inspection" button (primary, full width, Plus icon)
    - Loading state with Skeleton
    - Accept `WindFarmDetail` data and `onPlanInspection` callback

  - [x] 23.6 Create SubassetsTable organism component
    - Create `src/components/organisms/SubassetsTable.tsx`
    - Table with 5 sortable columns: Name, Model, Last Inspection, Powering Date, # Inspections
    - Header with gray background, bold uppercase text
    - Rows with 1px border bottom, hover highlight
    - Integrate `TablePagination` molecule (options: 5, 10, 25, 100)
    - "Turbines Serial Numbers" button below pagination (blue outline)
    - Row click navigates to turbine detail
    - Loading state with Skeleton rows

  - [x] 23.7 Create DocumentDropbox organism component
    - Create `src/components/organisms/DocumentDropbox.tsx`
    - Section header "Documents dropbox" + "Add Document" button (green, Upload icon)
    - File picker accepting PDF, DOCX, XLSX, PNG, JPG
    - List uploaded documents with: FileText icon, name, size, Download/Delete buttons
    - Upload to `asset-documents` Supabase bucket
    - Role-based: only supervisor/admin can upload/delete
    - Placeholder text when empty

  - [x] 23.8 Create CampaignsPanel organism component
    - Create `src/components/organisms/CampaignsPanel.tsx`
    - Header: "Campaigns" title + "Manage Campaigns" button (outline, right-aligned)
    - Render list of `CampaignAccordion` components
    - Loading state

  - [x] 23.9 Create CampaignAccordion organism component
    - Create `src/components/organisms/CampaignAccordion.tsx`
    - Collapsible header: chevron + campaign name + "(N)" count + "View Results" button (primary) + "..." menu
    - Menu items: Rename, Delete (danger color)
    - Expanded state: table with 9 columns (Inspection Date, Subasset name, Status, Type, Photos uploaded, Viewed %, Defects, Notes, PDF report)
    - Status badges: green "Report", blue "Annotate", gray "Pending"
    - PDF download button with Download icon
    - Lazy-load inspections on expand using `useCampaignInspections`

  - [x] 23.10 Create TurbineSerialNumbersModal organism component
    - Create `src/components/organisms/TurbineSerialNumbersModal.tsx`
    - Modal overlay + centered dialog (90% width, max 900px)
    - Title "Turbines serial numbers" in primary color
    - Editable table: Name (readonly), Turbine, Blade A, Blade B, Blade C, Tower, Anticlockwise (checkbox)
    - Inputs: border gray, bg neutral-50
    - Footer: Cancel (secondary) + Update (primary, loading state)
    - Uses `useSerialNumbers` and `useUpdateSerialNumbers` hooks
    - Only supervisor/admin can save

  - [x] 23.11 Create CreateCampaignModal organism component
    - Create `src/components/organisms/CreateCampaignModal.tsx`
    - Modal overlay + centered dialog
    - Title "Create campaign" in primary color
    - Name text input (full-width, required)
    - Table of available inspections with checkbox selection
    - Columns: ☐, Inspection Date↕, Subasset, Status (badge), Notes, Campaign (current)
    - Footer: Cancel + Save (disabled if no name, loading state)
    - Uses `useWindFarmInspections`, `useCreateCampaign`, `useAssignInspectionsToCampaign`

  - [x] 23.12 Create WindFarmDetail page component
    - Create `src/pages/WindFarmDetail.tsx`
    - Read `windFarmId` from route params (`useParams`)
    - Tab navigation: General | Defects (reuse `TabBar` molecule)
    - General tab: two-column layout (flex 35/65)
      - Left column: DetailsBlock + SubassetsTable + DocumentDropbox
      - Right column: CampaignsPanel
    - Defects tab: DefectsWindFarmsView filtered by `windFarmId`
    - Header: wind farm name (from detail data) + breadcrumbs
    - Orchestrate all modals (serial numbers, create campaign)
    - Handle responsive layout (<1024px: single column vertical)

  - [x] 23.13 Add routing and navigation for Asset Detail
    - Add lazy import for `WindFarmDetail` in `src/App.tsx`
    - Add route `/assets-wind/:id` wrapped in AuthGuard + AppLayout
    - Make `WindFarmsTable` rows clickable → navigate to `/assets-wind/{id}` on row click
    - Ensure direct URL access works (SPA routing)

  - [x] 23.14 Integration verification and checkpoint
    - Verify the page loads at `/assets-wind/:id` with skeleton states
    - Verify DetailsBlock shows correct aggregated metrics
    - Verify SubassetsTable loads, sorts, and paginates correctly
    - Verify CampaignsPanel shows campaigns as collapsible accordions
    - Verify expanding a campaign lazy-loads its inspections table
    - Verify TurbineSerialNumbersModal opens, edits, and saves
    - Verify CreateCampaignModal opens, creates campaign, assigns inspections
    - Verify DocumentDropbox uploads/downloads/deletes documents
    - Verify "View Results" button navigates correctly
    - Verify "Plan a New Inspection" navigates to `/inspections/new?windFarm={id}`
    - Verify responsive layout at <1024px
    - Verify the application compiles without TypeScript errors (`tsc -b`)

- [x] 24. Reporte Global de Campaña (Campaign Results View) — Design Section 18
  - [x] 24.1 Create campaign results service methods
    - Extend `src/services/asset-detail.service.ts` with:
      - `getCampaignResults(campaignId)` returning campaign metadata, wind farm info, total defects, resolved count, defectsByCat breakdown, and turbineResults array
      - `getCampaignDefectImages(campaignId)` returning defect images grouped by category
      - `exportCampaignCSV(campaignId)` generating CSV blob of all defects in campaign

  - [x] 24.2 Create React Query hooks for Campaign Results
    - Create `src/hooks/useCampaignResults.ts` with:
      - `useCampaignResults(campaignId)` — queryKey: ['campaign-results', id]
      - `useCampaignDefectImages(campaignId)` — queryKey: ['campaign-defect-images', id]

  - [x] 24.3 Create CategoryBadgesBar molecule component
    - Create `src/components/molecules/CategoryBadgesBar.tsx`
    - 5 badges horizontal (Cat 5 → Cat 1) with numeric count
    - Colors: Cat5=red(#E53E3E), Cat4=orange(#E06300), Cat3=yellow(#F2994A), Cat2=blue(#3182CE), Cat1=gray/green
    - Right panel: green card with "X resolved" / "Y defects"

  - [x] 24.4 Create TurbineResultsList organism component
    - Create `src/components/organisms/TurbineResultsList.tsx`
    - Accordion list of turbines with: checkbox, name, category badges, "X / Y resolved", action icons (download, copy, open)
    - Expandable to show blade breakdown (BLADE A, B, C) with individual badges and resolved counts
    - "Select all" checkbox at the top

  - [x] 24.5 Create DefectSummaryPanel organism component
    - Create `src/components/organisms/DefectSummaryPanel.tsx`
    - Integrates CategoryBadgesBar (top) + TurbineResultsList (below)
    - Scrollable panel, handles empty state

  - [x] 24.6 Create TurbineMapPanel organism component
    - Create `src/components/organisms/TurbineMapPanel.tsx`
    - Placeholder satellite map (static image or Leaflet integration)
    - Markers for each turbine with name labels
    - Polyline routes (orange with arrows) representing drone flight paths
    - Zoom controls (+/-) and fullscreen button
    - "Select all" checkbox

  - [x] 24.7 Create CampaignChartsPanel organism component
    - Create `src/components/organisms/CampaignChartsPanel.tsx`
    - Two Recharts StackedBarChart side by side:
      - "Turbine defect category repartition" (X: turbine names, stacks: cat1-cat5 colors)
      - "Turbine defect type repartition" (X: turbine names, stacks: defect types)
    - Consistent color coding with category badges
    - Responsive: stack vertically on narrow screens

  - [x] 24.8 Create DefectImageGallery organism component
    - Create `src/components/organisms/DefectImageGallery.tsx`
    - Group images by category with colored title (ej. "Category 4" in orange)
    - Grid layout (4-5 thumbnails per row)
    - Category-colored border on each image
    - Click opens lightbox (reuse or create simple modal viewer)
    - Empty state when no images

  - [x] 24.9 Create CampaignResults page component
    - Create `src/pages/CampaignResults.tsx`
    - Read `campaignId` from route params
    - Breadcrumb: "[Asset Name] > Global report of campaign [Campaign Name]"
    - Subtitle: "Campaign of [date]"
    - Top-right actions: "Export CSV for All Turbines" (green button) + "Share" button
    - 2×2 grid layout:
      - Top-left: TurbineMapPanel
      - Top-right: DefectSummaryPanel
      - Bottom-left: CampaignChartsPanel
      - Bottom-right: DefectImageGallery
    - Uses `useCampaignResults` and `useCampaignDefectImages` hooks
    - Export CSV button calls `exportCampaignCSV` service method
    - Handle loading/error states per panel

  - [x] 24.10 Add routing for Campaign Results
    - Add lazy import for `CampaignResults` in `src/App.tsx`
    - Add route `/campaigns/:id/results` wrapped in AuthGuard + AppLayout
    - Wire "View Results" buttons in CampaignAccordion to navigate to this route

  - [x] 24.11 Integration verification and checkpoint
    - Verify page loads at `/campaigns/:id/results` with breadcrumb and subtitle
    - Verify CategoryBadgesBar renders correct totals per category
    - Verify TurbineResultsList renders all turbines with expandable blade breakdown
    - Verify TurbineMapPanel renders (placeholder or interactive)
    - Verify CampaignChartsPanel renders two stacked bar charts with correct data
    - Verify DefectImageGallery groups images by category with thumbnails
    - Verify Export CSV downloads correct data
    - Verify responsive behavior (panels stack on narrow screens)
    - Verify the application compiles without TypeScript errors (`tsc -b`)


- [x] 25. Inspección Detallada — Flujo de 4 Pasos (Inspection Workflow) — Design Section 19
  - [x] 25.1 Create TypeScript types for Inspection Workflow
    - Add `InspectionWorkflowData` interface to `src/types/index.ts`
    - Add `WorkflowEvidence` interface (id, url, thumbnailUrl, status, blade/side/distance, exifData)
    - Add `WorkflowDefect` interface (id, type, category, blade, side, rootDistance, defectSize, note, rootCause, nextStep, resolved, imageUrls)
    - Add `AcquisitionData` interface (dateTime, photosCount, taggedPhotos, inspectionDuration, rtkStatus)

  - [x] 25.2 Create Inspection Workflow service methods
    - Extend `src/services/inspections.service.ts` or create `src/services/inspection-workflow.service.ts` with:
      - `getInspectionWorkflow(inspectionId)` returning full context (inspection, wind farm, turbine, blades, defects, evidence, acquisition)
      - `updateInspectionNotes(inspectionId, notes)` updating notes field
      - `markImageReviewed(evidenceId, status)` updating evidence status
      - `saveWorkflowDefect(inspectionId, defect)` creating or updating a defect with all fields
      - `deleteWorkflowDefect(defectId)` removing a defect
      - `toggleDefectResolved(defectId, resolved)` toggling resolved status

  - [x] 25.3 Create React Query hooks for Inspection Workflow
    - Create `src/hooks/useInspectionWorkflow.ts` with:
      - `useInspectionWorkflow(inspectionId)` — queryKey: ['inspection-workflow', id]
      - `useUpdateInspectionNotes()` — mutation
      - `useMarkImageReviewed()` — mutation → invalidates workflow
      - `useSaveWorkflowDefect()` — mutation → invalidates workflow
      - `useDeleteWorkflowDefect()` — mutation → invalidates workflow
      - `useResolveWorkflowDefect()` — mutation → invalidates workflow

  - [x] 25.4 Create WorkflowStepper molecule component
    - Create `src/components/molecules/WorkflowStepper.tsx`
    - 4 horizontal steps connected by lines
    - Active step: blue solid background, white text
    - Completed step: green checkmark, clickable
    - Future step: gray, not clickable
    - Labels: "1. INSPECT", "2. ANNOTATE", "3. ANALYZE", "4. RESULTS"
    - Props: currentStep, completedSteps (Set), onStepClick callback

  - [x] 25.5 Create InspectStep organism component
    - Create `src/components/organisms/InspectStep.tsx`
    - Left panel: InspectionDetailsCard (readonly fields: Asset Name, Inspection type, Turbine number, Model, Date with edit icon, Notes with edit icon, Legislation (red), Weather)
    - Left panel: DocumentDropbox (reuse existing) + satellite map with turbine marker
    - Right panel: progress bar (2 green checkpoints "Complete")
    - Right panel: Acquisition table (date/time, photos, tagged, duration, RTK status)
    - Right panel: Photo upload table (uploaded count, pending count)

  - [x] 25.6 Create AnnotateStep organism component
    - Create `src/components/organisms/AnnotateStep.tsx`
    - Left panel: Thumbnail grid (6×N) with selection border, blade/side tabs, position indicator
    - Left panel: Counters — UNSEEN (orange), TAGGED (blue), ANNOT (green)
    - Center panel: Full image viewer with navigation arrows, zoom, "Fast forward mode" toggle
    - Center panel: Info bar (Blade, Side, Root distance, Distance to blade) + EXIT button
    - Center panel: "Review progress: X%" progress bar
    - Center panel: Action buttons (mark defect blue, delete red, contrast toggle)
    - Right panel: Comparison checkboxes, EXIF metadata display, Turbine info
    - Right panel: Change vertical blade selector + clockwise/anticlockwise diagram + Save

  - [x] 25.7 Create AnalyzeStep organism component
    - Create `src/components/organisms/AnalyzeStep.tsx`
    - Left panel: BLADE A/B/C tabs with annotation count badges
    - Left panel: List of pending annotations, "All processed" message when empty
    - Center panel — Defect Editor: image with distance/side overlay, < > navigation
    - Center panel — Form: Type dropdown, Category (1-5 visual selector), Root distance input, Blade face dropdown
    - Center panel — "Automatic category suggestions" collapsable section
    - Center panel — Note, Root cause, Next step textareas with clear (X) buttons
    - Center panel — Buttons: Clear + "Save as Defect"
    - Right panel — Summary: Blade accordions with defect count, summary table (#, Type, Face, Category, Root, Copy)
    - Right panel — Click defect row loads it in editor
    - Right panel — Blade notes + SubAsset total + SubAsset notes

  - [x] 25.8 Create ResultsStep organism component
    - Create `src/components/organisms/ResultsStep.tsx`
    - Left panel — Blades Diagram: 3 blade silhouettes (A, B, C) with serial numbers
    - Left panel — Vertical scale 0-43m, orange dots at defect positions, red badges for high severity
    - Left panel — Counters: "[X] defects" + "[Y] resolved"
    - Left panel — Conclusion section (editable text per turbine/blade)
    - Left panel — "Plan Next Inspection" button (primary, full-width)
    - Right panel — Tab "Statistics": Donut charts per blade, Category breakdown badges, Type bar chart, Defect overview table (types × categories with totals)
    - Right panel — Tab "Details": Filterable table (Id, Type, Category, Blade, Side, Root distance, Defect size, Edit, Resolved toggle)
    - Right panel — Selected defect detail: Note, Root cause, Next step, Comments, Image viewer with zoom

  - [x] 25.9 Create InspectionWorkflow page component
    - Create `src/pages/InspectionWorkflow.tsx`
    - Read `inspectionId` from route params
    - Breadcrumb: "[Asset] > Turbine [WTxx] > [Date]"
    - Integrate WorkflowStepper at top
    - Manage state: currentStep, completedSteps, selectedBladeTab, selectedSide, selectedImageIndex, selectedDefectId, reviewProgress, resultsTab
    - Render appropriate step component based on currentStep
    - Auto-save pending data on step change
    - Keyboard shortcuts: arrows for image navigation, Enter for save, Esc for cancel
    - Handle responsive layout (steps stack vertically on mobile)

  - [x] 25.10 Add routing for Inspection Workflow
    - Add lazy import for `InspectionWorkflow` in `src/App.tsx`
    - Add route `/inspections/:id/workflow` wrapped in AuthGuard + AppLayout
    - Wire navigation from inspection detail page and campaign inspection table to workflow route
    - Ensure direct URL access works

  - [x] 25.11 Integration verification and checkpoint
    - Verify page loads at `/inspections/:id/workflow` with stepper and Step 1 active
    - Verify InspectStep displays inspection details, acquisition data, and photo upload status
    - Verify AnnotateStep shows thumbnail grid, image viewer with navigation, and metadata panel
    - Verify AnalyzeStep Defect Editor saves defects with all fields
    - Verify ResultsStep shows blade diagram with defect positions and statistics charts
    - Verify stepper navigation (completed steps clickable, future steps disabled)
    - Verify "Plan Next Inspection" button navigates correctly
    - Verify responsive layout
    - Verify the application compiles without TypeScript errors (`tsc -b`)


- [ ] 26. Módulo de Planificación y Registro de Nueva Inspección (RF-002) — Design Section 20
  - [ ] 26.1 Create database migration for geolocation support
    - Create `scripts/migrate-new-inspection.sql` with:
      - `ALTER TABLE wind_farm ADD COLUMN IF NOT EXISTS latitude NUMERIC;`
      - `ALTER TABLE wind_farm ADD COLUMN IF NOT EXISTS longitude NUMERIC;`
      - `UPDATE wind_farm SET latitude = 10.7089, longitude = -85.2528 WHERE name ILIKE '%mogote%' OR name ILIKE '%fila%';`
    - Create `scripts/apply-migration-new-inspection.mjs` script to apply the migration via Supabase SDK
    - Verify migration applies cleanly on existing schema (no conflicts with section 17 migration)

  - [ ] 26.2 Create TypeScript types for New Inspection form
    - Add `InspectionType` type (`'blades' | 'tower'`) to `src/types/index.ts`
    - Add `InspectionMethod` type (`'skyvisor' | 'external'`) to `src/types/index.ts`
    - Add `SubassetSelectionRow` interface with fields: id, name, model, lastInspectionDate, lastDefectsCount, selected
    - Add `CreateCampaignInspectionInput` interface with fields: windFarmId, campaignName, inspectionType, inspectionMethod, scheduledDate, notes, subscribeNotifications, selectedTurbineIds
    - Add `WindFarmCoordinates` interface with fields: latitude, longitude
    - Export all new types from `src/types/index.ts`

  - [ ] 26.3 Create New Inspection service layer
    - Create `src/services/new-inspection.service.ts` with `NewInspectionServiceError` class
    - Implement `getSubassetsForSelection(windFarmId)`:
      - Query turbines of the wind farm with blades → inspections → defects joins
      - For each turbine, compute: last inspection date (relative time, e.g. "1 months"), last defects count from most recent inspection
      - Return `SubassetSelectionRow[]` sorted by turbine name
    - Implement `getWindFarmCoordinates(windFarmId)`:
      - Query `wind_farm` table for `latitude` and `longitude` columns
      - Return `WindFarmCoordinates | null` (null if no coordinates set)
    - Implement `createCampaignWithInspections(input: CreateCampaignInspectionInput)`:
      - Step 1: Create campaign via `supabase.from('campaign').insert({ name, wind_farm_id, created_by })`
      - Step 2: For each turbineId in selectedTurbineIds, get first blade (position=1), then insert inspection with: blade_id, inspector_id (current user), campaign_id, inspection_type, scheduled_date, notes, status='in_progress', stage='planned'
      - Step 3: Return `{ campaign, inspectionIds }`
      - Handle errors with appropriate error messages for each step

  - [ ] 26.4 Create React Query hooks for New Inspection
    - Create `src/hooks/useNewInspection.ts` with:
      - `useWindFarmsList()` — queryKey: ['wind-farms-list'], fetches all wind farms (id, name) using existing `assetsService` or direct query
      - `useSubassetsForSelection(windFarmId)` — queryKey: ['subassets-selection', windFarmId], enabled only when windFarmId is truthy
      - `useWindFarmCoordinates(windFarmId)` — queryKey: ['wind-farm-coordinates', windFarmId], enabled only when windFarmId is truthy
      - `useCreateCampaignInspections()` — useMutation wrapping `newInspectionService.createCampaignWithInspections`, invalidates ['inspections'] and ['campaigns'] on success

  - [ ] 26.5 Create Zod validation schema for New Inspection form
    - Add `newCampaignInspectionSchema` to `src/utils/validation.ts`:
      - `windFarmId`: z.string().uuid()
      - `campaignName`: z.string().min(1, 'Campaign name is required')
      - `inspectionType`: z.enum(['blades', 'tower'])
      - `inspectionMethod`: z.enum(['skyvisor', 'external'])
      - `scheduledDate`: z.string().min(1, 'Inspection date is required')
      - `notes`: z.string().optional().default('')
      - `subscribeNotifications`: z.boolean().default(true)
      - `selectedTurbineIds`: z.array(z.string().uuid()).min(1, 'At least one turbine must be selected')
    - Export `NewCampaignInspectionFormData` type inferred from schema

  - [ ] 26.6 Create SegmentedControl molecule component
    - Create `src/components/molecules/SegmentedControl.tsx`
    - Props: options (array of {value, label}), value, onChange, name, disabled
    - Render as inline-flex container with rounded borders
    - Active option: background #00A3E0, text white, font-weight 600
    - Inactive option: background var(--color-neutral-50), text var(--color-neutral-700)
    - Hover on inactive: background var(--color-neutral-100)
    - Transition: 150ms ease on background and color
    - Each option rendered as `<button type="button">` with `role="radio"` and `aria-checked`
    - Container has `role="radiogroup"` with `aria-label={name}`
    - Export from `src/components/molecules/index.ts`

  - [ ] 26.7 Create DatePickerField molecule component
    - Create `src/components/molecules/DatePickerField.tsx`
    - Props: label, value (DD/MM/YYYY string), onChange, error, required
    - Render label + input container with Calendar icon (Lucide) on right
    - Input uses `type="date"` under the hood with display formatting to DD/MM/YYYY
    - Icon click focuses the native date input
    - Border: 1px solid var(--color-neutral-200); focus: border-color var(--color-primary-500)
    - Error state: red border + error message below
    - Default value: current date formatted as DD/MM/YYYY
    - Export from `src/components/molecules/index.ts`

  - [ ] 26.8 Create AssetSelector molecule component
    - Create `src/components/molecules/AssetSelector.tsx`
    - Props: windFarms (array of {id, name}), value, onChange, isLoading, disabled
    - Render as styled `<select>` with chevron-down icon
    - Placeholder option: "Seleccionar parque..." when no value
    - Options populated from windFarms array
    - Loading state: skeleton or disabled with "Loading..." text
    - Border gray, focus ring blue, background white, rounded corners
    - Full width within its container
    - Export from `src/components/molecules/index.ts`

  - [ ] 26.9 Create NotificationToggle atom component
    - Create `src/components/atoms/NotificationToggle.tsx`
    - Props: checked, onChange, label (default: "Subscribe to email notifications for new inspections")
    - Render toggle switch (44px wide, 24px tall) + label text to the right
    - Active: green background (#4CAF50), circle button slides right
    - Inactive: gray background (#CCC), circle button on left
    - Transition: 200ms ease on background and transform
    - Accessible: `role="switch"`, `aria-checked`, `aria-label`
    - Dot indicator (green circle) before label text when active
    - Export from `src/components/atoms/index.ts`

  - [ ] 26.10 Create SubassetsSelectionPanel organism component
    - Create `src/components/organisms/SubassetsSelectionPanel.tsx`
    - Props: data (SubassetSelectionRow[]), isLoading, selectedIds, onSelectionChange, onSelectAll, onDeselectAll
    - Header row with master checkbox (checked/unchecked/indeterminate based on selection state)
    - Table columns: Checkbox | Turbine icon (Wind lucide icon) | Name | Model | Last inspection | Last defects detected
    - Each row is clickable (toggles checkbox)
    - Checkbox styling: blue (#00A3E0) when checked with white checkmark
    - Skeleton loading state: 7 rows of Skeleton variant="rect" height="44px"
    - Empty state when data is empty array and not loading
    - No outer border on table; thin horizontal separators (1px #E5E7EB)
    - Export from `src/components/organisms/index.ts`

  - [ ] 26.11 Create WeatherMapPanel organism component
    - Create `src/components/organisms/WeatherMapPanel.tsx`
    - Props: latitude (number|null), longitude (number|null), isLoading
    - When coordinates available: render `<iframe>` with Windy embed URL
      - URL format: `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=m/s&lat={lat}&lon={lon}&zoom=10&level=surface&overlay=wind&product=ecmwf&message=true&calendar=now&detail=true&detailLat={lat}&detailLon={lon}`
      - Iframe: `width="100%"`, `height="100%"`, `frameBorder="0"`, `allow="geolocation"`
    - When no coordinates: placeholder box with gray background and text "Seleccione un parque para ver el pronóstico meteorológico"
    - Container: rounded corners (var(--radius-lg)), overflow hidden, full height of parent
    - Loading state: Skeleton covering full panel area
    - Export from `src/components/organisms/index.ts`

  - [ ] 26.12 Create InspectionConfigForm organism component
    - Create `src/components/organisms/InspectionConfigForm.tsx`
    - Props: windFarms, selectedWindFarmId, inspectionType, inspectionMethod, scheduledDate, campaignName, notes, subscribeNotifications, errors, isLoadingFarms, onChange (callback for each field change)
    - Compose vertically:
      1. AssetSelector (label "Asset")
      2. SegmentedControl for Type (label "Type", options: [{value:'blades', label:'BLADES'}, {value:'tower', label:'TOWER'}])
      3. SegmentedControl for Method (label "Method", options: [{value:'skyvisor', label:'SKYVISOR'}, {value:'external', label:'External >'}])
      4. DatePickerField (label "Inspection Date")
      5. FormField (existing molecule, label "Campaign name *", required)
      6. Native `<textarea>` (label "Notes", placeholder empty, optional)
      7. NotificationToggle
    - Each field section has label in gray (font-size xs, font-weight 500) above the control
    - Error messages shown inline below each field when present in errors object
    - Vertical gap between fields: var(--space-4)
    - Export from `src/components/organisms/index.ts`

  - [ ] 26.13 Rewrite NewInspection page component
    - Rewrite `src/pages/NewInspection.tsx` with the new 3-column layout
    - Page header: "Create new inspection" (H1, color #111827, bold) + optional SearchBar
    - Read URL param `?windFarm={id}` via `useSearchParams()` to pre-select asset
    - Initialize state:
      - `windFarmId`: from URL param or first available wind farm
      - `inspectionType`: 'blades'
      - `inspectionMethod`: 'skyvisor'
      - `scheduledDate`: current date in YYYY-MM-DD format
      - `campaignName`: `new Date().toLocaleString('en', { month: 'long', year: 'numeric' })` (e.g. "July 2026")
      - `notes`: ''
      - `subscribeNotifications`: true
      - `selectedTurbineIds`: all turbine IDs once loaded
      - `errors`: {}
    - Use hooks: `useWindFarmsList()`, `useSubassetsForSelection(windFarmId)`, `useWindFarmCoordinates(windFarmId)`, `useCreateCampaignInspections()`
    - When windFarmId changes: reset selectedTurbineIds to all turbine IDs from new data
    - Layout: CSS Grid with 3 columns (`grid-template-columns: 1fr 1.4fr 1.6fr; gap: var(--space-4);`)
    - Left column: `<InspectionConfigForm />`
    - Center column: `<SubassetsSelectionPanel />` + CREATE button at bottom-right
    - Right column: `<WeatherMapPanel />`
    - CREATE button logic:
      - Disabled when: campaignName is empty OR selectedTurbineIds is empty
      - On click: validate with `newCampaignInspectionSchema.safeParse()`
      - If invalid: set errors, scroll to first error
      - If valid: call `createCampaignInspections.mutateAsync(input)`
      - On success: toast success + navigate to `/assets-wind/${windFarmId}` or `/inspections`
      - On error: toast error
    - Responsive breakpoints:
      - `@media (max-width: 1280px)`: 2 columns (left+center in one row, right below)
      - `@media (max-width: 768px)`: single column stacked

  - [ ] 26.14 Integration verification and checkpoint
    - Verify the page loads at `/inspections/new` with 3-column layout
    - Verify AssetSelector populates with available wind farms
    - Verify changing asset updates turbines table (with skeleton during load)
    - Verify changing asset updates Windy iframe with new coordinates
    - Verify SegmentedControl toggles correctly for Type and Method
    - Verify DatePicker defaults to today's date and allows selection
    - Verify Campaign name defaults to "[Month] [Year]" and is editable
    - Verify master checkbox toggles all turbines
    - Verify individual row click toggles that turbine's selection
    - Verify CREATE button is disabled when campaign name is empty
    - Verify CREATE button is disabled when no turbines are selected
    - Verify CREATE button submits and creates campaign + inspections
    - Verify success toast and navigation after creation
    - Verify URL param `?windFarm=` pre-selects the correct park
    - Verify responsive layout at 1280px and 768px breakpoints
    - Verify the application compiles without TypeScript errors (`tsc -b`)
