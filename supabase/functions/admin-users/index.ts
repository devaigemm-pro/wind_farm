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

    // Only admins may use this function. Authorization is now sourced from
    // user_roles (multi-role): the caller must have the 'admin' role among theirs.
    const { data: callerRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (rolesError) {
      return json({ error: 'Failed to resolve caller roles' }, 403)
    }
    if (!callerRoles?.some((r) => r.role === 'admin')) {
      return json({ error: 'Only admins can manage users' }, 403)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body.action !== 'string') {
      return json({ error: 'action is required' }, 400)
    }

    const { action } = body

    // Normalise a roles input that may arrive as `roles: string[]` or, for
    // backwards compatibility, as a single `role: string`.
    const resolveRoles = (raw: unknown, singular: unknown): string[] => {
      if (Array.isArray(raw)) return raw.filter((r) => typeof r === 'string' && r.length > 0)
      if (typeof singular === 'string' && singular.length > 0) return [singular]
      return []
    }

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
      const { email, password, name, windFarmIds } = body
      // Normalise empty strings to null so the partial unique index on
      // profiles.rut (WHERE rut IS NOT NULL) does not treat multiple blank
      // ruts as colliding values.
      const last_name = body.last_name?.trim() ? body.last_name.trim() : null
      const rut = body.rut?.trim() ? body.rut.trim() : null
      if (!email || !password) {
        return json({ error: 'email and password are required' }, 400)
      }

      // Multi-role: accept `roles: string[]` (or legacy `role: string`).
      const roles = resolveRoles(body.roles, body.role)
      const rolesToAssign = roles.length > 0 ? roles : ['inspector']
      const primaryRole = rolesToAssign[0]

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: name ?? null,
          last_name,
          rut,
          role: primaryRole,
          roles: rolesToAssign,
        },
      })

      if (createError || !created?.user) {
        return json({ error: createError?.message ?? 'Failed to create user' }, 400)
      }

      const newId = created.user.id

      // The handle_new_user() trigger inserts the profile. Upsert explicitly so
      // every column is guaranteed to reflect the provided values. profiles.role
      // keeps the primary role for compat/display.
      const { error: profileUpsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newId,
          email,
          name: name ?? email.split('@')[0],
          last_name,
          rut,
          role: primaryRole,
        })
      if (profileUpsertError) {
        // Roll back the auth user so a failed profile write does not leave an
        // orphan account that blocks recreating the same email.
        await supabaseAdmin.auth.admin.deleteUser(newId)
        return json({ error: profileUpsertError.message ?? 'User created but profile update failed' }, 400)
      }

      // Replace user_roles with exactly the requested set. The trigger already
      // seeded the primary role; delete+insert guarantees the full set.
      await supabaseAdmin.from('user_roles').delete().eq('user_id', newId)
      const roleRows = rolesToAssign.map((r) => ({ user_id: newId, role: r }))
      const { error: rolesInsertError } = await supabaseAdmin.from('user_roles').insert(roleRows)
      if (rolesInsertError) {
        await supabaseAdmin.auth.admin.deleteUser(newId)
        return json({ error: 'User created but role assignment failed' }, 500)
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
      const { userId, name, last_name, rut, password, windFarmIds } = body
      if (!userId) {
        return json({ error: 'userId is required' }, 400)
      }

      // Multi-role: `roles?: string[]` (or legacy `role?: string`). Only touch
      // roles when provided.
      const rolesProvided = body.roles !== undefined || body.role !== undefined
      const roles = resolveRoles(body.roles, body.role)

      // Build profile update from provided fields only. Empty strings for
      // last_name/rut are stored as null (see create note on the unique index).
      const profileUpdate: Record<string, unknown> = {}
      if (name !== undefined) profileUpdate.name = name
      if (last_name !== undefined) profileUpdate.last_name = last_name?.trim() ? last_name.trim() : null
      if (rut !== undefined) profileUpdate.rut = rut?.trim() ? rut.trim() : null
      // profiles.role keeps the primary role for compat/display.
      if (rolesProvided && roles.length > 0) profileUpdate.role = roles[0]

      if (Object.keys(profileUpdate).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update(profileUpdate)
          .eq('id', userId)
        if (updateError) {
          return json({ error: updateError.message ?? 'Failed to update profile' }, 400)
        }
      }

      // Replace user_roles when roles were provided.
      if (rolesProvided && roles.length > 0) {
        const { error: deleteRolesError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
        if (deleteRolesError) {
          return json({ error: 'Failed to clear roles' }, 500)
        }
        const roleRows = roles.map((r) => ({ user_id: userId, role: r }))
        const { error: rolesInsertError } = await supabaseAdmin.from('user_roles').insert(roleRows)
        if (rolesInsertError) {
          return json({ error: 'Failed to set roles' }, 500)
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

      // A user with historical records (inspections, reports, comments, etc.)
      // cannot be deleted because those FKs are ON DELETE NO ACTION — deleting
      // would orphan audit history. Detect this up front and return a clear,
      // actionable message instead of a cryptic FK violation.
      const historyChecks: { table: string; column: string }[] = [
        { table: 'inspection', column: 'inspector_id' },
        { table: 'inspection', column: 'approved_by' },
        { table: 'report', column: 'generated_by' },
        { table: 'campaign', column: 'created_by' },
        { table: 'asset_document', column: 'uploaded_by' },
        { table: 'defect_comment', column: 'author_id' },
        { table: 'repair', column: 'technician_id' },
      ]
      for (const check of historyChecks) {
        const { count, error: countError } = await supabaseAdmin
          .from(check.table)
          .select('*', { count: 'exact', head: true })
          .eq(check.column, userId)
        if (countError) continue // table may not exist in some envs; skip
        if ((count ?? 0) > 0) {
          return json(
            {
              error:
                'No se puede eliminar: el usuario tiene registros históricos asociados (inspecciones, reportes u otros). Preserva la trazabilidad manteniendo el usuario.',
              code: 'HAS_HISTORY',
            },
            409,
          )
        }
      }

      // The auth.users → profiles → wind_farm_user / user_roles cascade handles cleanup.
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
