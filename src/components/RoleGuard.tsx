import { type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}

/**
 * RoleGuard conditionally renders content based on the user's role.
 * If the user's role is not in `allowedRoles`, shows the fallback or a default
 * access denied message.
 */
export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { role } = useAuth();

  if (!role || !allowedRoles.includes(role)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          gap: '0.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Access Denied</h2>
        <p style={{ color: '#6b7280' }}>
          Your role does not have access to this content.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
