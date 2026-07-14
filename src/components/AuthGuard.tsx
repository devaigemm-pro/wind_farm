import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

interface AuthGuardProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
}

/**
 * AuthGuard protects routes by requiring authentication.
 * - Shows a loading state while auth is resolving.
 * - Redirects to /login if the user is not authenticated.
 * - Optionally enforces role-based access via `requiredRoles`.
 */
export function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const { isLoading, isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
        aria-label="Loading"
      >
        <div
          style={{
            width: '2rem',
            height: '2rem',
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
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
