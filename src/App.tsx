import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { ThemeProvider, LanguageProvider } from '@/components/design-system';
import { AuthGuard } from '@/components/AuthGuard';
import { RoleGuard } from '@/components/RoleGuard';
import { Layout } from '@/components/organisms';
import { AppLayout } from '@/components/layout/app-layout';
import { getFeatureFlags } from '@/lib/feature-flags';
import { ToastContainer } from '@/components/organisms';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSplash } from '@/components/atoms/LoadingSplash';

const Login = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout ? import('@/pages/LoginV2') : import('@/pages/Login');
});
const Dashboard = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout ? import('@/pages/DashboardV2') : import('@/pages/Dashboard');
});
const AssetsPage = lazy(() =>
  import('@/pages/Assets').then((m) => ({ default: m.Assets })),
);
const InspectionsPage = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout
    ? import('@/pages/InspectionsV2').then((m) => ({ default: m.InspectionsV2 }))
    : import('@/pages/Inspections').then((m) => ({ default: m.Inspections }));
});
const NewInspectionPage = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout
    ? import('@/pages/NewInspectionV2').then((m) => ({ default: m.NewInspectionV2 }))
    : import('@/pages/NewInspection').then((m) => ({ default: m.NewInspection }));
});
const InspectionWorkflowPage = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout
    ? import('@/pages/InspectionWorkflowV2').then((m) => ({ default: m.InspectionWorkflowV2 }))
    : import('@/pages/InspectionWorkflow').then((m) => ({ default: m.InspectionWorkflow }));
});
const ReportsPage = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout
    ? import('@/pages/ReportsV2').then((m) => ({ default: m.ReportsV2 }))
    : import('@/pages/Reports').then((m) => ({ default: m.Reports }));
});
const WindFarmsDashboardPage = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout
    ? import('@/pages/WindFarmsDashboardV2').then((m) => ({ default: m.WindFarmsDashboardV2 }))
    : import('@/pages/WindFarmsDashboard').then((m) => ({ default: m.WindFarmsDashboard }));
});
const WindFarmDetailPage = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout
    ? import('@/pages/WindFarmDetailV2').then((m) => ({ default: m.WindFarmDetailV2 }))
    : import('@/pages/WindFarmDetail').then((m) => ({ default: m.WindFarmDetail }));
});
const SubassetDetailPage = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout
    ? import('@/pages/SubassetDetailV2').then((m) => ({ default: m.SubassetDetailV2 }))
    : import('@/pages/SubassetDetail').then((m) => ({ default: m.SubassetDetail }));
});
const CampaignResultsPage = lazy(() =>
  import('@/pages/CampaignResults').then((m) => ({ default: m.CampaignResults })),
);
const CampaignUploadStatusPage = lazy(() =>
  import('@/pages/CampaignUploadStatus').then((m) => ({ default: m.CampaignUploadStatus })),
);
const UploadsPage = lazy(() =>
  import('@/pages/UploadsPage').then((m) => ({ default: m.UploadsPage })),
);
const OngoingInspectionsPage = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout
    ? import('@/pages/OngoingInspectionsV2').then((m) => ({ default: m.OngoingInspectionsV2 }))
    : import('@/pages/OngoingInspections').then((m) => ({ default: m.OngoingInspections }));
});
const ProfilePage = lazy(() => {
  const { newLayout } = getFeatureFlags();
  return newLayout
    ? import('@/pages/ProfileV2').then((m) => ({ default: m.ProfileV2 }))
    : import('@/pages/Profile').then((m) => ({ default: m.Profile }));
});
const SharedResultsPage = lazy(() =>
  import('@/pages/SharedResults').then((m) => ({ default: m.SharedResults })),
);
const ComparePageLazy = lazy(() =>
  import('@/pages/ComparePage').then((m) => ({ default: m.ComparePage })),
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
  const { newLayout } = getFeatureFlags();

  if (newLayout) {
    return (
      <AppLayout user={user} onLogout={logout}>
        <Suspense fallback={<LoadingSplash />}>
          <Outlet />
        </Suspense>
      </AppLayout>
    );
  }

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
        <Route path="/profile" element={<ProfilePage />} />
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
