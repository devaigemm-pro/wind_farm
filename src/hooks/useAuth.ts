import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import { SESSION_TIMEOUT_MS } from '@/types';
import type { UserRole } from '@/types';

export function useAuth() {
  const store = useAuthStore();
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    store.updateActivity();

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    if (store.isAuthenticated) {
      inactivityTimerRef.current = setTimeout(() => {
        void authService.logout();
        store.clearAuth();
      }, SESSION_TIMEOUT_MS);
    }
  }, [store]);

  // Subscribe to auth state changes on mount
  useEffect(() => {
    store.setLoading(true);

    // Get initial session
    void authService.getSession().then(async (session) => {
      store.setSession(session);
      if (session?.user) {
        const profile = await authService.getUserProfile(session.user.id);
        store.setUser(profile);
      }
      store.setLoading(false);
    });

    // Listen for auth changes
    const subscription = authService.onAuthStateChange(
      async (event, session) => {
        store.setSession(session);
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          const profile = await authService.getUserProfile(session.user.id);
          store.setUser(profile);
        }
        if (event === 'SIGNED_OUT') {
          store.clearAuth();
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inactivity timer: listen to user activity events
  useEffect(() => {
    if (!store.isAuthenticated) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      return;
    }

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();

    events.forEach((event) => window.addEventListener(event, handleActivity));
    // Start the timer immediately
    resetInactivityTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [store.isAuthenticated, resetInactivityTimer]);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    return result;
  };

  const logout = async () => {
    await authService.logout();
    store.clearAuth();
  };

  const role: UserRole | null = store.user?.role ?? null;

  return {
    user: store.user,
    session: store.session,
    isLoading: store.isLoading,
    isAuthenticated: store.isAuthenticated,
    login,
    logout,
    role,
  };
}
