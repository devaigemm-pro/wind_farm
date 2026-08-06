import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { ThemeProvider } from '@/components/design-system';
import { AuthGuard } from '@/components/AuthGuard';
import { Layout } from '@/components/organisms';
import { ToastContainer } from '@/components/organisms';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSplash } from '@/components/atoms/LoadingSplash';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const AssetsPage = lazy(() =>
  import('@/pages/Assets').then((m) => ({ default: m.Assets })),
);
const InspectionsPage = lazy(() =>
  import('@/pages/Inspections').then((m) => ({ default: m.Inspections })),
);
const InspectionDetailPage = lazy(() =>
  import('@/pages/InspectionDetail').then((m) => ({ default: m.InspectionDetail })),
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
const TurbineDetailPage = lazy(() =>
  import('@/pages/TurbineDetail').then((m) => ({ default: m.TurbineDetail })),
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
const OngoingInspectionsPage = lazy(() =>
  import('@/pages/OngoingInspections').then((m) => ({ default: m.OngoingInspections })),
);
const ProfilePage = lazy(() =>
  import('@/pages/Profile').then((m) => ({ default: m.Profile })),
);
const SharedResultsPage = lazy(() =>
  import('@/pages/SharedResults').then((m) => ({ default: m.SharedResults })),
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
        <Route path="/inspections/upload" element={<InspectionsPage />} />
        <Route path="/inspections/ongoing" element={<OngoingInspectionsPage />} />
        <Route path="/inspections/reports" element={<ReportsPage />} />
        <Route path="/inspections/:id/workflow" element={<InspectionWorkflowPage />} />
        <Route path="/inspections/:id" element={<InspectionDetailPage />} />

        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/assets-wind" element={<WindFarmsDashboardPage />} />
        <Route path="/assets-wind/:id" element={<WindFarmDetailPage />} />
        <Route path="/assets-wind/:windFarmId/turbine/:turbineId" element={<TurbineDetailPage />} />
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
        <BrowserRouter>
          <Suspense fallback={<LoadingSplash />}>
            <AppRoutes />
          </Suspense>
          <ToastContainer />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
