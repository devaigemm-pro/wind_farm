import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import { SESSION_TIMEOUT_MS } from '@/types';
import type { UserRole } from '@/types';

export function useAuth() {
  // State: subscribe only to the slices this hook actually reads. Consuming
  // the whole store via `useAuthStore()` re-renders on every `lastActivity`
  // update, which combined with `updateActivity()` inside an effect creates
  // an infinite render loop (React error #185).
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Actions: Zustand action functions are stable references across renders,
  // so pulling them via selectors here does not itself cause re-renders.
  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const updateActivity = useAuthStore((s) => s.updateActivity);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    updateActivity();

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // The enclosing effect only wires this up while authenticated, and
    // clears the timer on cleanup, so we do not need an inner guard.
    inactivityTimerRef.current = setTimeout(() => {
      void authService.logout();
      clearAuth();
    }, SESSION_TIMEOUT_MS);
  }, [updateActivity, clearAuth]);

  // Bootstrap auth on mount. Guaranteed to end with setLoading(false) so
  // the AuthGuard spinner cannot get stuck if any auth call hangs or throws.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      try {
        // Race getSession against a 5s timeout. Some browsers/extensions
        // can leave navigator.locks pending and make this call hang. The
        // supabase client is also configured with a passthrough lock, but
        // this timeout is a second line of defence.
        const initialSession = await Promise.race([
          authService.getSession(),
          new Promise<null>((resolve) =>
            setTimeout(() => {
              console.warn('[useAuth] getSession timed out after 5s');
              resolve(null);
            }, 5000),
          ),
        ]);
        if (cancelled) return;
        setSession(initialSession);

        if (initialSession?.user) {
          try {
            const profile = await authService.getUserProfile(
              initialSession.user.id,
            );
            if (!cancelled) setUser(profile);
          } catch (profileErr) {
            console.error('[useAuth] getUserProfile failed', profileErr);
          }
        }
      } catch (err) {
        console.error('[useAuth] bootstrap failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();

    const subscription = authService.onAuthStateChange(
      async (event, newSession) => {
        if (cancelled) return;
        setSession(newSession);
        if (
          newSession?.user &&
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
        ) {
          try {
            const profile = await authService.getUserProfile(newSession.user.id);
            if (!cancelled) setUser(profile);
          } catch (err) {
            console.error(
              '[useAuth] onAuthStateChange getUserProfile failed',
              err,
            );
          }
        }
        if (event === 'SIGNED_OUT') {
          clearAuth();
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // Actions are stable Zustand references; run this exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inactivity timer: listen to user activity events
  useEffect(() => {
    if (!isAuthenticated) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      return;
    }

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'keydown',
      'mousedown',
      'touchstart',
    ];
    const handleActivity = () => resetInactivityTimer();

    events.forEach((event) => window.addEventListener(event, handleActivity));
    resetInactivityTimer();

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, handleActivity),
      );
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isAuthenticated, resetInactivityTimer]);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    return result;
  };

  const logout = async () => {
    await authService.logout();
    clearAuth();
  };

  const role: UserRole | null = user?.role ?? null;

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    login,
    logout,
    role,
  };
}
