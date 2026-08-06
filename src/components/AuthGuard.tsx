import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSplash } from '@/components/atoms/LoadingSplash';
import type { UserRole } from '@/types';

interface AuthGuardProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
}

/**
 * AuthGuard protects routes by requiring authentication.
 * - Shows LoadingSplash while auth is resolving (same component used by Suspense).
 * - Redirects to /login if the user is not authenticated.
 * - Optionally enforces role-based access via `requiredRoles`.
 */
export function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const { isLoading, isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSplash />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!role || !requiredRoles.includes(role)) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '1rem',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Access Denied</h1>
          <p style={{ color: '#6b7280' }}>
            You do not have permission to access this page.
          </p>
        </div>
      );
    }
  }

  return <>{children}</>;
}
