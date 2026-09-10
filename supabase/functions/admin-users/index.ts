import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withCors } from '../_shared/cors.ts'

// admin-users: CRUD over auth.users for the admin-only user maintainer.
// Mirrors the approve-inspection function pattern:
//   - supabaseAdmin: service-role client for privileged operations
//   - supabaseUser:  anon client + Authorization header to verify the caller
//   - the caller must be an authenticated user whose profile.role === 'admin'
//
// Actions (via JSON body `{ action, ... }`):
//   listFarms  -> { farms: [{ id, name, location }] }  (service role sees all)
//   create     -> { email, password, name, last_name, rut, role, windFarmIds }
//   update     -> { userId, name?, last_name?, rut?, role?, password?, windFarmIds? }
//   delete     -> { userId }

const jsonHeaders = { 'Content-Type': 'application/json' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

serve(withCors(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    // Verify the caller.
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Invalid or expired token' }, 401)
    }

    // Only admins may use this function.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return json({ error: 'User profile not found' }, 403)
    }
    if (profile.role !== 'admin') {
      return json({ error: 'Only admins can manage users' }, 403)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body.action !== 'string') {
      return json({ error: 'action is required' }, 400)
    }

    const { action } = body

    // ─── listFarms ─────────────────────────────────────────────────────────
    // Uses the service role so an admin without farm assignments still sees the
    // full catalog to assign from.
    if (action === 'listFarms') {
      const { data: farms, error } = await supabaseAdmin
        .from('wind_farm')
        .select('id, name, location')
        .order('name')
      if (error) return json({ error: 'Failed to list wind farms' }, 500)
      return json({ farms: farms ?? [] }, 200)
    }

    // ─── create ──────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { email, password, name, last_name, rut, role, windFarmIds } = body
      if (!email || !password) {
        return json({ error: 'email and password are required' }, 400)
      }

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: name ?? null,
          last_name: last_name ?? null,
          rut: rut ?? null,
          role: role ?? 'inspector',
        },
      })

      if (createError || !created?.user) {
        return json({ error: createError?.message ?? 'Failed to create user' }, 400)
      }

      const newId = created.user.id

      // The handle_new_user() trigger inserts the profile. Upsert explicitly so
      // every column is guaranteed to reflect the provided values.
      const { error: profileUpsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newId,
          email,
          name: name ?? email.split('@')[0],
          last_name: last_name ?? null,
          rut: rut ?? null,
          role: role ?? 'inspector',
        })
      if (profileUpsertError) {
        return json({ error: 'User created but profile update failed' }, 500)
      }

      const ids: string[] = Array.isArray(windFarmIds) ? windFarmIds : []
      if (ids.length > 0) {
        const rows = ids.map((wid) => ({ wind_farm_id: wid, user_id: newId }))
        const { error: assignError } = await supabaseAdmin.from('wind_farm_user').insert(rows)
        if (assignError) {
          return json({ error: 'User created but farm assignment failed' }, 500)
        }
      }

      return json({ user: { id: newId, email } }, 201)
    }

    // ─── update ────────────────────────────────────────────────────────────
    if (action === 'update') {
      const { userId, name, last_name, rut, role, password, windFarmIds } = body
      if (!userId) {
        return json({ error: 'userId is required' }, 400)
      }

      // Build profile update from provided fields only.
      const profileUpdate: Record<string, unknown> = {}
      if (name !== undefined) profileUpdate.name = name
      if (last_name !== undefined) profileUpdate.last_name = last_name
      if (rut !== undefined) profileUpdate.rut = rut
      if (role !== undefined) profileUpdate.role = role

      if (Object.keys(profileUpdate).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update(profileUpdate)
          .eq('id', userId)
        if (updateError) {
          return json({ error: 'Failed to update profile' }, 500)
        }
      }

      // Replace farm assignments when provided.
      if (Array.isArray(windFarmIds)) {
        const { error: deleteError } = await supabaseAdmin
          .from('wind_farm_user')
          .delete()
          .eq('user_id', userId)
        if (deleteError) {
          return json({ error: 'Failed to clear farm assignments' }, 500)
        }
        if (windFarmIds.length > 0) {
          const rows = windFarmIds.map((wid: string) => ({ wind_farm_id: wid, user_id: userId }))
          const { error: insertError } = await supabaseAdmin.from('wind_farm_user').insert(rows)
          if (insertError) {
            return json({ error: 'Failed to set farm assignments' }, 500)
          }
        }
      }

      // Optional password change.
      if (password) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
        if (pwError) {
          return json({ error: 'Failed to update password' }, 500)
        }
      }

      return json({ user: { id: userId } }, 200)
    }

    // ─── delete ────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { userId } = body
      if (!userId) {
        return json({ error: 'userId is required' }, 400)
      }
      // The auth.users → profiles → wind_farm_user cascade handles cleanup.
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (deleteError) {
        return json({ error: deleteError.message ?? 'Failed to delete user' }, 500)
      }
      return json({ success: true }, 200)
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (_err) {
    return json({ error: 'Internal server error' }, 500)
  }
}))
