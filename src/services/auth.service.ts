import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export const authService = {
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) {
    const { data } = supabase.auth.onAuthStateChange(callback);
    return data.subscription;
  },

  async getUserProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw error;
    }
    if (!data) return null;

    // Multi-role: compose the roles array from user_roles. Fall back to the
    // legacy profiles.role if the join returns nothing (backwards compat).
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const roles = (roleRows ?? [])
      .map((r) => r.role as UserRole)
      .filter((r): r is UserRole => !!r);

    const legacyRole = (data as { role?: UserRole }).role;
    const finalRoles = roles.length > 0 ? roles : legacyRole ? [legacyRole] : [];

    return {
      ...(data as Omit<Profile, 'roles' | 'role'>),
      roles: finalRoles,
      role: finalRoles[0],
    } as Profile;
  },
};
