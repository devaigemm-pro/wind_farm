import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types';
import { SESSION_TIMEOUT_MS } from '@/types';

interface AuthState {
  user: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  lastActivity: number;
}

interface AuthActions {
  setUser: (user: Profile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
  updateActivity: () => void;
  checkInactivity: () => boolean;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  lastActivity: Date.now(),

  setUser: (user) => set({ user, isAuthenticated: user !== null }),

  setSession: (session) =>
    set({ session, isAuthenticated: session !== null }),

  setLoading: (isLoading) => set({ isLoading }),

  clearAuth: () =>
    set({
      user: null,
      session: null,
      isAuthenticated: false,
    }),

  updateActivity: () => set({ lastActivity: Date.now() }),

  checkInactivity: () => {
    const { lastActivity } = get();
    return Date.now() - lastActivity >= SESSION_TIMEOUT_MS;
  },
}));
