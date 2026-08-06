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

  // Bootstrap auth on mount.
  //
  // We do NOT call supabase.auth.getSession() here. That path hangs in some
  // browsers (navigator.locks contention, storage lock contention). Instead
  // we rely on onAuthStateChange, which supabase-js fires with an
  // `INITIAL_SESSION` event as soon as the client finishes hydrating from
  // storage. That event is deterministic and does not depend on the lock
  // path that has been hanging.
  //
  // A safety timeout still guarantees setLoading(false) even if the SDK
  // never fires INITIAL_SESSION for any reason.
  useEffect(() => {
    let cancelled = false;
    let sawInitialSession = false;

    async function loadProfile(userId: string, tag: string) {
      try {
        const profile = await authService.getUserProfile(userId);
        if (!cancelled) setUser(profile);
      } catch {
        // Profile fetch failed — user remains authenticated but without profile data
      }
    }

    const subscription = authService.onAuthStateChange(
      async (event, newSession) => {
        if (cancelled) return;
        setSession(newSession);

        if (event === 'INITIAL_SESSION') {
          sawInitialSession = true;
          // Mark loading complete immediately once we know auth state.
          // Profile loads in background — UI can render with session info
          // while profile hydrates (prevents long spinner wait).
          setLoading(false);
          if (newSession?.user) {
            void loadProfile(newSession.user.id, event);
          }
          return;
        }

        if (
          newSession?.user &&
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
        ) {
          await loadProfile(newSession.user.id, event);
        }
        if (event === 'SIGNED_OUT') {
          clearAuth();
        }
      },
    );

    // Safety net: if INITIAL_SESSION never arrives (SDK bug, storage lock,
    // browser extension interference), drop the spinner after 2s so the
    // user still lands on /login instead of an infinite loading screen.
    const safetyTimer = setTimeout(() => {
      if (!cancelled && !sawInitialSession) {
        setLoading(false);
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
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
