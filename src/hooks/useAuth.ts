import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import type { UserRole } from '@/types';

/**
 * useAuth is a PURE store selector. It contains NO effects, no global
 * listeners, and no auth subscriptions — so the ~30 components that read auth
 * state do not each spin up their own onAuthStateChange subscription or
 * window activity listeners.
 *
 * The global auth side effects (onAuthStateChange, safety timer, inactivity
 * listeners + timeout) live in `useAuthBootstrap`, which is mounted exactly
 * once in the authenticated root (AuthGuard).
 */
export function useAuth() {
  // State: subscribe only to the slices this hook actually reads. Consuming
  // the whole store via `useAuthStore()` re-renders on every `lastActivity`
  // update, so we select the individual slices.
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Actions: Zustand action functions are stable references across renders.
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    return result;
  };

  const logout = async () => {
    await authService.logout();
    clearAuth();
  };

  // Multi-role: `roles` is the source of truth. `role` is kept (= roles[0])
  // for backwards compatibility with older callers.
  const roles: UserRole[] = user?.roles ?? [];
  const role: UserRole | null = roles[0] ?? user?.role ?? null;

  const hasRole = (r: UserRole): boolean => roles.includes(r);
  const hasAnyRole = (rs: UserRole[]): boolean => roles.some((r) => rs.includes(r));

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    login,
    logout,
    role,
    roles,
    hasRole,
    hasAnyRole,
  };
}
