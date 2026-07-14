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

  // Subscribe to auth state changes on mount
  useEffect(() => {
    setLoading(true);

    // Get initial session
    void authService.getSession().then(async (initialSession) => {
      setSession(initialSession);
      if (initialSession?.user) {
        const profile = await authService.getUserProfile(initialSession.user.id);
        setUser(profile);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const subscription = authService.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        if (
          newSession?.user &&
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
        ) {
          const profile = await authService.getUserProfile(newSession.user.id);
          setUser(profile);
        }
        if (event === 'SIGNED_OUT') {
          clearAuth();
        }
      },
    );

    return () => {
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
