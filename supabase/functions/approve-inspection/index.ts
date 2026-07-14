import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withCors } from '../_shared/cors.ts'

serve(withCors(async (req) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Create user client to verify the token
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check user role is supervisor or admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (profile.role !== 'supervisor' && profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only supervisors and admins can approve inspections' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse the request body
    const { inspectionId } = await req.json()
    if (!inspectionId) {
      return new Response(JSON.stringify({ error: 'inspectionId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get the inspection
    const { data: inspection, error: fetchError } = await supabaseAdmin
      .from('inspection')
      .select('*')
      .eq('id', inspectionId)
      .single()

    if (fetchError || !inspection) {
      return new Response(JSON.stringify({ error: 'Inspection not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify current status is completed
    if (inspection.status !== 'completed') {
      return new Response(JSON.stringify({ error: `Cannot approve: inspection is currently "${inspection.status}", must be "completed"` }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Transition to approved
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('inspection')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', inspectionId)
      .select()
      .single()

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to update inspection' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ inspection: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}))
