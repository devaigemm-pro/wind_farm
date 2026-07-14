import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { ThemeProvider } from '@/components/design-system';
import { AuthGuard } from '@/components/AuthGuard';
import { Layout } from '@/components/organisms';
import { ToastContainer } from '@/components/organisms';
import { useAuth } from '@/hooks/useAuth';

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
const ReportsPage = lazy(() =>
  import('@/pages/Reports').then((m) => ({ default: m.Reports })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <Layout user={user} onLogout={logout}>
      {children}
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <Navigate to="/dashboard" replace />
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/assets"
        element={
          <AuthGuard>
            <AppLayout>
              <AssetsPage />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inspections"
        element={
          <AuthGuard>
            <AppLayout>
              <InspectionsPage />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inspections/new"
        element={
          <AuthGuard>
            <AppLayout>
              <NewInspectionPage />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inspections/:id"
        element={
          <AuthGuard>
            <AppLayout>
              <InspectionDetailPage />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/reports"
        element={
          <AuthGuard>
            <AppLayout>
              <ReportsPage />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense
            fallback={
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100vh',
                }}
              >
                Loading...
              </div>
            }
          >
            <AppRoutes />
          </Suspense>
          <ToastContainer />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
