import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Dashboard Aggregate Edge Function
 *
 * Provides pre-computed chart data for the dashboard.
 * Supports: inspection-pipeline, defects-spread, inspection-operations, subassets-status
 */

interface RequestBody {
  chart: string
  filters?: {
    types?: string[]
    farms?: string[]
    severity?: number
  }
}

serve(async (req) => {
  try {
    // Verify JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create user client to verify the token
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create admin client for aggregation queries
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Parse request body
    const body: RequestBody = await req.json()
    const { chart, filters } = body

    if (!chart) {
      return new Response(JSON.stringify({ error: 'chart parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let data: unknown

    switch (chart) {
      case 'inspection-pipeline':
        data = await getInspectionPipeline(supabaseAdmin, filters)
        break
      case 'defects-spread':
        data = await getDefectsSpread(supabaseAdmin, filters)
        break
      case 'inspection-operations':
        data = await getInspectionOperations(supabaseAdmin, filters)
        break
      case 'subassets-status':
        data = await getSubassetsStatus(supabaseAdmin, filters)
        break
      default:
        return new Response(JSON.stringify({ error: `Unknown chart: ${chart}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// ─── Aggregation Handlers ─────────────────────────────────────────────────────

/**
 * inspection-pipeline: Count inspections grouped by stage (6 stages in fixed order).
 * Returns: { stages: { stage: string, count: number }[] }
 */
async function getInspectionPipeline(
  supabase: ReturnType<typeof createClient>,
  filters?: RequestBody['filters']
) {
  const stages = ['to_plan', 'planned', 'uploaded', 'annotated', 'analyzed', 'finalized']

  let query = supabase.from('inspection').select('stage, blade_id')

  // Apply farm filter by joining through blade -> turbine -> wind_farm
  if (filters?.farms && filters.farms.length > 0) {
    // Get blade IDs belonging to the filtered farms
    const { data: blades } = await supabase
      .from('blade')
      .select('id, turbine!inner(wind_farm_id)')
      .in('turbine.wind_farm_id', filters.farms)

    if (blades && blades.length > 0) {
      const bladeIds = blades.map((b: { id: string }) => b.id)
      query = query.in('blade_id', bladeIds)
    } else {
      // No blades match — return empty counts
      return { stages: stages.map(stage => ({ stage, count: 0 })) }
    }
  }

  const { data: inspections, error } = await query

  if (error) {
    throw new Error(`inspection-pipeline query failed: ${error.message}`)
  }

  // Count by stage
  const counts: Record<string, number> = {}
  for (const stage of stages) {
    counts[stage] = 0
  }
  for (const insp of inspections || []) {
    if (counts[insp.stage] !== undefined) {
      counts[insp.stage]++
    }
  }

  return { stages: stages.map(stage => ({ stage, count: counts[stage] })) }
}

/**
 * defects-spread: Count defects grouped by type and severity.
 * Returns: { items: { type: string, severity: number, count: number }[] }
 */
async function getDefectsSpread(
  supabase: ReturnType<typeof createClient>,
  filters?: RequestBody['filters']
) {
  let query = supabase.from('defect').select('type, severity, inspection_id')

  // Apply severity filter
  if (filters?.severity) {
    query = query.eq('severity', filters.severity)
  }

  // Apply type filter
  if (filters?.types && filters.types.length > 0) {
    query = query.in('type', filters.types)
  }

  // Apply farm filter
  if (filters?.farms && filters.farms.length > 0) {
    const { data: blades } = await supabase
      .from('blade')
      .select('id, turbine!inner(wind_farm_id)')
      .in('turbine.wind_farm_id', filters.farms)

    if (blades && blades.length > 0) {
      const bladeIds = blades.map((b: { id: string }) => b.id)
      const { data: inspections } = await supabase
        .from('inspection')
        .select('id')
        .in('blade_id', bladeIds)

      if (inspections && inspections.length > 0) {
        const inspectionIds = inspections.map((i: { id: string }) => i.id)
        query = query.in('inspection_id', inspectionIds)
      } else {
        return { items: [] }
      }
    } else {
      return { items: [] }
    }
  }

  const { data: defects, error } = await query

  if (error) {
    throw new Error(`defects-spread query failed: ${error.message}`)
  }

  // Group by type + severity
  const grouped: Record<string, number> = {}
  for (const d of defects || []) {
    const key = `${d.type}|${d.severity}`
    grouped[key] = (grouped[key] || 0) + 1
  }

  const items = Object.entries(grouped).map(([key, count]) => {
    const [type, severity] = key.split('|')
    return { type, severity: Number(severity), count }
  })

  return { items }
}

/**
 * inspection-operations: Count inspections grouped by month (current year),
 * split into planned/done/toPlan.
 * Returns: { months: { month: string, planned: number, done: number, toPlan: number }[] }
 */
async function getInspectionOperations(
  supabase: ReturnType<typeof createClient>,
  filters?: RequestBody['filters']
) {
  const currentYear = new Date().getFullYear()
  const startOfYear = `${currentYear}-01-01`
  const endOfYear = `${currentYear}-12-31`

  let query = supabase
    .from('inspection')
    .select('scheduled_date, status, stage, blade_id')
    .gte('scheduled_date', startOfYear)
    .lte('scheduled_date', endOfYear)

  // Apply farm filter
  if (filters?.farms && filters.farms.length > 0) {
    const { data: blades } = await supabase
      .from('blade')
      .select('id, turbine!inner(wind_farm_id)')
      .in('turbine.wind_farm_id', filters.farms)

    if (blades && blades.length > 0) {
      const bladeIds = blades.map((b: { id: string }) => b.id)
      query = query.in('blade_id', bladeIds)
    } else {
      return { months: buildEmptyMonths() }
    }
  }

  const { data: inspections, error } = await query

  if (error) {
    throw new Error(`inspection-operations query failed: ${error.message}`)
  }

  // Initialize months
  const months: Record<string, { planned: number; done: number; toPlan: number }> = {}
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  for (const m of monthNames) {
    months[m] = { planned: 0, done: 0, toPlan: 0 }
  }

  // Categorize inspections
  for (const insp of inspections || []) {
    const monthIdx = new Date(insp.scheduled_date).getMonth()
    const monthName = monthNames[monthIdx]

    if (insp.status === 'completed' || insp.status === 'approved') {
      months[monthName].done++
    } else if (insp.stage === 'to_plan') {
      months[monthName].toPlan++
    } else {
      months[monthName].planned++
    }
  }

  return {
    months: monthNames.map(month => ({
      month,
      planned: months[month].planned,
      done: months[month].done,
      toPlan: months[month].toPlan,
    })),
  }
}

/**
 * subassets-status: Classify blades by time since last inspection.
 * Categories: < 3 months, 3-6 months, > 6 months (no inspection counts as > 6mo)
 * Returns: { segments: { label: string, count: number }[] }
 */
async function getSubassetsStatus(
  supabase: ReturnType<typeof createClient>,
  filters?: RequestBody['filters']
) {
  // Get all blades with optional farm filter
  let bladeQuery = supabase.from('blade').select('id, turbine!inner(wind_farm_id)')

  if (filters?.farms && filters.farms.length > 0) {
    bladeQuery = bladeQuery.in('turbine.wind_farm_id', filters.farms)
  }

  const { data: blades, error: bladeError } = await bladeQuery

  if (bladeError) {
    throw new Error(`subassets-status blade query failed: ${bladeError.message}`)
  }

  if (!blades || blades.length === 0) {
    return { segments: [
      { label: '< 3 months', count: 0 },
      { label: '3-6 months', count: 0 },
      { label: '> 6 months', count: 0 },
    ] }
  }

  const bladeIds = blades.map((b: { id: string }) => b.id)

  // Get the latest inspection date per blade
  const { data: inspections, error: inspError } = await supabase
    .from('inspection')
    .select('blade_id, scheduled_date')
    .in('blade_id', bladeIds)
    .order('scheduled_date', { ascending: false })

  if (inspError) {
    throw new Error(`subassets-status inspection query failed: ${inspError.message}`)
  }

  // Find latest inspection date per blade
  const latestByBlade: Record<string, string> = {}
  for (const insp of inspections || []) {
    if (!latestByBlade[insp.blade_id]) {
      latestByBlade[insp.blade_id] = insp.scheduled_date
    }
  }

  // Classify blades
  const now = new Date()
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(now.getMonth() - 3)
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(now.getMonth() - 6)

  let recent = 0 // < 3 months
  let medium = 0 // 3-6 months
  let old = 0    // > 6 months

  for (const bladeId of bladeIds) {
    const lastDate = latestByBlade[bladeId]
    if (!lastDate) {
      old++ // No inspection = overdue
    } else {
      const inspDate = new Date(lastDate)
      if (inspDate >= threeMonthsAgo) {
        recent++
      } else if (inspDate >= sixMonthsAgo) {
        medium++
      } else {
        old++
      }
    }
  }

  return {
    segments: [
      { label: '< 3 months', count: recent },
      { label: '3-6 months', count: medium },
      { label: '> 6 months', count: old },
    ],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmptyMonths() {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return monthNames.map(month => ({ month, planned: 0, done: 0, toPlan: 0 }))
}
