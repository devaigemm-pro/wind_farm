import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import { SESSION_TIMEOUT_MS } from '@/types';

/**
 * Throttle window for activity detection. `updateActivity` only feeds the
 * inactivity timeout, so millisecond precision is unnecessary. Without this,
 * every `mousemove` pixel triggered a Zustand `set()` which saturated the main
 * thread and eventually froze click handling.
 */
const ACTIVITY_THROTTLE_MS = 5000;

/**
 * useAuthBootstrap wires up the GLOBAL auth side effects that must run exactly
 * ONCE for the whole app, regardless of how many components read auth state:
 *
 *  1. The `onAuthStateChange` subscription + INITIAL_SESSION safety timer.
 *  2. The activity listeners + inactivity timeout that logs the user out.
 *
 * Mount this hook a single time in the authenticated root (AuthGuard). All
 * other components use `useAuth()`, which is now a pure store selector with no
 * effects — so there is only one subscription and one set of global listeners.
 */
export function useAuthBootstrap() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Zustand action references are stable across renders.
  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const updateActivity = useAuthStore((s) => s.updateActivity);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityWriteRef = useRef<number>(0);

  const resetInactivityTimer = useCallback(() => {
    // Throttle the store write: only record activity at most once per
    // ACTIVITY_THROTTLE_MS. This is what prevents mousemove from hammering
    // the store on every pixel of movement.
    const now = Date.now();
    if (now - lastActivityWriteRef.current >= ACTIVITY_THROTTLE_MS) {
      lastActivityWriteRef.current = now;
      updateActivity();
    }

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

    async function loadProfile(userId: string) {
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
          if (newSession?.user) {
            // Wait for profile before removing splash so the avatar
            // renders with the real initials (avoids "U" flash).
            await loadProfile(newSession.user.id);
          }
          setLoading(false);
          return;
        }

        if (
          newSession?.user &&
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
        ) {
          await loadProfile(newSession.user.id);
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
}
