import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { ThemeProvider, LanguageProvider } from '@/components/design-system';
import { AuthGuard } from '@/components/AuthGuard';
import { Layout } from '@/components/organisms';
import { ToastContainer } from '@/components/organisms';
import { useAuth } from '@/hooks/useAuth';
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { LoadingSplash } from '@/components/atoms/LoadingSplash';

const Login = lazy(() => import('@/pages/LoginV2'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const AssetsPage = lazy(() =>
  import('@/pages/Assets').then((m) => ({ default: m.Assets })),
);
const InspectionsPage = lazy(() =>
  import('@/pages/Inspections').then((m) => ({ default: m.Inspections })),
);
const NewInspectionPage = lazy(() =>
  import('@/pages/NewInspection').then((m) => ({ default: m.NewInspection })),
);
const InspectionWorkflowPage = lazy(() =>
  import('@/pages/InspectionWorkflow').then((m) => ({ default: m.InspectionWorkflow })),
);
const ReportsPage = lazy(() =>
  import('@/pages/Reports').then((m) => ({ default: m.Reports })),
);
const WindFarmsDashboardPage = lazy(() =>
  import('@/pages/WindFarmsDashboard').then((m) => ({ default: m.WindFarmsDashboard })),
);
const WindFarmDetailPage = lazy(() =>
  import('@/pages/WindFarmDetail').then((m) => ({ default: m.WindFarmDetail })),
);
const SubassetDetailPage = lazy(() =>
  import('@/pages/SubassetDetail').then((m) => ({ default: m.SubassetDetail })),
);
const CampaignResultsPage = lazy(() =>
  import('@/pages/CampaignResults').then((m) => ({ default: m.CampaignResults })),
);
const CampaignUploadStatusPage = lazy(() =>
  import('@/pages/CampaignUploadStatus').then((m) => ({ default: m.CampaignUploadStatus })),
);
const UploadsPage = lazy(() =>
  import('@/pages/UploadsPage').then((m) => ({ default: m.UploadsPage })),
);
const OngoingInspectionsPage = lazy(() =>
  import('@/pages/OngoingInspections').then((m) => ({ default: m.OngoingInspections })),
);
const ProfilePage = lazy(() =>
  import('@/pages/Profile').then((m) => ({ default: m.Profile })),
);
const SharedResultsPage = lazy(() =>
  import('@/pages/SharedResults').then((m) => ({ default: m.SharedResults })),
);
const ComparePageLazy = lazy(() =>
  import('@/pages/ComparePage').then((m) => ({ default: m.ComparePage })),
);
const QuotesPage = lazy(() =>
  import('@/pages/QuotesPage').then((m) => ({ default: m.QuotesPage })),
);
const NewQuotePage = lazy(() =>
  import('@/pages/NewQuotePage').then((m) => ({ default: m.NewQuotePage })),
);
const QuoteDetailPage = lazy(() =>
  import('@/pages/QuoteDetailPage').then((m) => ({ default: m.QuoteDetailPage })),
);
const TraceabilityPage = lazy(() =>
  import('@/pages/TraceabilityPage').then((m) => ({ default: m.TraceabilityPage })),
);
const RepairWorkflowPage = lazy(() =>
  import('@/pages/RepairWorkflow').then((m) => ({ default: m.RepairWorkflow })),
);
const UsersAdminPage = lazy(() =>
  import('@/pages/UsersAdmin').then((m) => ({ default: m.UsersAdmin })),
);
const AssetsAdminPage = lazy(() =>
  import('@/pages/AssetsAdmin').then((m) => ({ default: m.AssetsAdmin })),
);



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 min — data changes infrequently
      gcTime: 30 * 60 * 1000, // 30 min — keep in cache long after unmount
      retry: 1,
      // Keep previous data visible during refetches to prevent layout flicker.
      placeholderData: (previousData: unknown) => previousData,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

/**
 * Authenticated layout shell. Renders once for all protected routes,
 * so Layout never unmounts/remounts between route transitions.
 */
function AuthenticatedShell() {
  const { user, logout } = useAuth();

  return (
    <Layout user={user} onLogout={logout}>
      <Suspense fallback={<LoadingSplash />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

/**
 * Legacy redirect: /assets-wind/:wf/turbine/:t?inspectionId=X → /inspections/X/workflow?step=4
 * Falls back to subasset detail if no inspectionId is provided.
 */
function TurbineRedirect() {
  const { windFarmId, turbineId } = useParams();
  const [searchParams] = useSearchParams();
  const inspectionId = searchParams.get('inspectionId');

  if (inspectionId) {
    return <Navigate to={`/inspections/${inspectionId}/workflow?step=4`} replace />;
  }
  // No inspectionId → go to subasset detail
  return <Navigate to={`/assets-wind/${windFarmId}/subasset/${turbineId}`} replace />;
}

/**
 * Runs the global auth side effects exactly once for the whole app:
 * the onAuthStateChange subscription (+ INITIAL_SESSION safety timer) and the
 * activity listeners + inactivity timeout. Mounted a single time here so the
 * ~30 components consuming `useAuth()` only read the store — they no longer
 * each open their own subscription or register global window listeners.
 * Renders nothing.
 */
function AuthBootstrap() {
  useAuthBootstrap();
  return null;
}

/**
 * Single AuthGuard wrapping all protected routes prevents
 * multiple independent useAuth subscriptions and eliminates
 * the staggered loading sequence that causes flickering.
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Public routes - outside AuthGuard */}
      <Route path="/login" element={<Login />} />
      <Route path="/shared/:windFarmId/:turbineId" element={<SharedResultsPage />} />
      <Route path="/compare" element={<ComparePageLazy />} />

      {/* All protected routes share one AuthGuard + Layout instance */}
      <Route
        element={
          <AuthGuard>
            <AuthenticatedShell />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/inspections" element={<InspectionsPage />} />
        <Route path="/inspections/new" element={<NewInspectionPage />} />
        <Route path="/inspections/upload" element={<UploadsPage />} />
        <Route path="/inspections/ongoing" element={<OngoingInspectionsPage />} />
        <Route path="/inspections/reports" element={<ReportsPage />} />
        <Route path="/inspections/:id/workflow" element={<InspectionWorkflowPage />} />

        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/assets-wind" element={<WindFarmsDashboardPage />} />
        <Route path="/assets-wind/:id" element={<WindFarmDetailPage />} />
        <Route path="/assets-wind/:windFarmId/turbine/:turbineId" element={<TurbineRedirect />} />
        <Route path="/assets-wind/:windFarmId/subasset/:turbineId" element={<SubassetDetailPage />} />
        <Route path="/campaigns/:id/results" element={<CampaignResultsPage />} />
        <Route path="/campaigns/:id/upload" element={<CampaignUploadStatusPage />} />

        {/* Quotes & Work Orders. `traceability` and `new` are declared before
            `/quotes/:id` so the router does not treat them as an id. */}
        <Route path="/quotes" element={<QuotesPage />} />
        <Route path="/quotes/new" element={<NewQuotePage />} />
        <Route path="/quotes/traceability" element={<TraceabilityPage />} />
        <Route path="/quotes/:id" element={<QuoteDetailPage />} />

        {/* Repair workflow — accessible to all authenticated roles.
            client can only generate/download reports; photo selection is
            disabled in the UI (and blocked by RLS). */}
        <Route path="/repairs/:campaignId" element={<RepairWorkflowPage />} />

        <Route path="/profile" element={<ProfilePage />} />

        {/* Admin-only user maintainer, guarded by its own role check */}
        <Route
          path="/admin/users"
          element={
            <AuthGuard requiredRoles={['admin']}>
              <UsersAdminPage />
            </AuthGuard>
          }
        />
        <Route
          path="/admin/assets"
          element={
            <AuthGuard requiredRoles={['admin']}>
              <AssetsAdminPage />
            </AuthGuard>
          }
        />
      </Route>

      {/* Catch-all redirects to dashboard (AuthGuard will handle if not logged in) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
        <BrowserRouter>
          <AuthBootstrap />
          <Suspense fallback={<LoadingSplash />}>
            <AppRoutes />
          </Suspense>
          <ToastContainer />
        </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
