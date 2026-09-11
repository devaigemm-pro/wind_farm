import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

/** A wind farm entry for the assignment selector (from the Edge Function). */
export interface AdminWindFarm {
  id: string;
  name: string;
  location: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  last_name: string;
  rut: string;
  roles: UserRole[];
  windFarmIds: string[];
}

export interface UpdateUserInput {
  userId: string;
  name?: string;
  last_name?: string;
  rut?: string;
  roles?: UserRole[];
  password?: string;
  windFarmIds?: string[];
}

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class UserServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserServiceError';
  }
}

// supabase.functions.invoke returns a generic "non-2xx status code" error for
// any 4xx/5xx and does NOT parse the JSON body, so our clear server messages
// (e.g. "user has history") get lost. This helper reads the real message from
// the response body when present, falling back to the generic message.
async function throwInvokeError(
  error: { message: string; context?: { json?: () => Promise<unknown> } },
  data: { error?: string } | null,
): Promise<never> {
  if (data?.error) throw new UserServiceError(data.error);
  try {
    const body = (await error.context?.json?.()) as { error?: string } | undefined;
    if (body?.error) throw new UserServiceError(body.error);
  } catch (e) {
    if (e instanceof UserServiceError) throw e;
    // ignore parse errors, fall through to the generic message
  }
  throw new UserServiceError(error.message);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const usersService = {
  /** All profiles, ordered by name. */
  async listUsers(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');
    if (error) throw error;
    return data as Profile[];
  },

  /** Roles assigned to a given user (multi-role). */
  async getUserRoles(userId: string): Promise<UserRole[]> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((r) => r.role as UserRole);
  },

  /** Wind farm ids assigned to a given user. */
  async getUserFarms(userId: string): Promise<string[]> {
    // wind_farm_user is admin-managed; typed via Database but read here with the
    // regular client (RLS lets a user read their own rows and admins read all).
    const { data, error } = await supabase
      .from('wind_farm_user')
      .select('wind_farm_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((r) => r.wind_farm_id);
  },

  /** Full wind farm catalog for the maintainer selector (via Edge Function). */
  async getAllWindFarmsForAdmin(): Promise<AdminWindFarm[]> {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'listFarms' },
    });
    if (error) await throwInvokeError(error, data);
    if (data?.error) throw new UserServiceError(data.error);
    return (data?.farms ?? []) as AdminWindFarm[];
  },

  async createUser(input: CreateUserInput): Promise<void> {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'create',
        email: input.email,
        password: input.password,
        name: input.name,
        last_name: input.last_name,
        rut: input.rut,
        roles: input.roles,
        windFarmIds: input.windFarmIds,
      },
    });
    if (error) await throwInvokeError(error, data);
    if (data?.error) throw new UserServiceError(data.error);
  },

  async updateUser(input: UpdateUserInput): Promise<void> {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'update',
        userId: input.userId,
        name: input.name,
        last_name: input.last_name,
        rut: input.rut,
        roles: input.roles,
        password: input.password,
        windFarmIds: input.windFarmIds,
      },
    });
    if (error) await throwInvokeError(error, data);
    if (data?.error) throw new UserServiceError(data.error);
  },

  async deleteUser(userId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'delete', userId },
    });
    if (error) await throwInvokeError(error, data);
    if (data?.error) throw new UserServiceError(data.error);
  },
};
