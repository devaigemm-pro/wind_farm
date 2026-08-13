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

    // Parse the request body
    const { inspectionId } = await req.json()
    if (!inspectionId) {
      return new Response(JSON.stringify({ error: 'inspectionId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get inspection with full context
    const { data: inspection, error: inspError } = await supabaseAdmin
      .from('inspection')
      .select(`
        *,
        blade:blade!inspection_blade_id_fkey(
          id, position, serial_number,
          turbine:turbine!blade_turbine_id_fkey(
            id, name,
            wind_farm:wind_farm!turbine_wind_farm_id_fkey(id, name, location)
          )
        ),
        inspector:profiles!inspection_inspector_id_fkey(id, name, email),
        defects:defect(*),
        evidence(*)
      `)
      .eq('id', inspectionId)
      .single()

    if (inspError || !inspection) {
      return new Response(JSON.stringify({ error: 'Inspection not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Generate text-based report content
    const blade = inspection.blade
    const turbine = blade?.turbine
    const windFarm = turbine?.wind_farm
    const defects = inspection.defects || []
    const evidenceCount = inspection.evidence?.length || 0

    const reportLines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      '               WIND BLADE INSPECTION REPORT',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Report Generated: ${new Date().toISOString()}`,
      '',
      '───────────────────────────────────────────────────────────────',
      'INSPECTION DETAILS',
      '───────────────────────────────────────────────────────────────',
      `Inspection ID:    ${inspection.id}`,
      `Status:           ${inspection.status}`,
      `Stage:            ${inspection.stage}`,
      `Scheduled Date:   ${inspection.scheduled_date || 'N/A'}`,
      `Completed At:     ${inspection.completed_at || 'N/A'}`,
      `Inspector:        ${inspection.inspector?.name || 'Unknown'} (${inspection.inspector?.email || ''})`,
      '',
      '───────────────────────────────────────────────────────────────',
      'ASSET INFORMATION',
      '───────────────────────────────────────────────────────────────',
      `Wind Farm:        ${windFarm?.name || 'Unknown'} (${windFarm?.location || ''})`,
      `Turbine:          ${turbine?.name || 'Unknown'}`,
      `Blade:            Position ${blade?.position || 'Unknown'} (S/N: ${blade?.serial_number || 'N/A'})`,
      '',
      '───────────────────────────────────────────────────────────────',
      'EVIDENCE SUMMARY',
      '───────────────────────────────────────────────────────────────',
      `Total Evidence Files: ${evidenceCount}`,
      '',
      '───────────────────────────────────────────────────────────────',
      'DEFECTS SUMMARY',
      '───────────────────────────────────────────────────────────────',
      `Total Defects Found: ${defects.length}`,
      '',
    ]

    if (defects.length > 0) {
      defects.forEach((defect: Record<string, unknown>, index: number) => {
        reportLines.push(`  ${index + 1}. Type: ${defect.type}`)
        reportLines.push(`     Severity: ${defect.severity}/5`)
        reportLines.push(`     Distance from root: ${defect.distance_from_root ?? 'N/A'}m`)
        reportLines.push(`     Description: ${defect.description || 'No description'}`)
        reportLines.push('')
      })
    } else {
      reportLines.push('  No defects recorded for this inspection.')
      reportLines.push('')
    }

    reportLines.push('═══════════════════════════════════════════════════════════════')
    reportLines.push('                       END OF REPORT')
    reportLines.push('═══════════════════════════════════════════════════════════════')

    const reportContent = reportLines.join('\n')

    // Store report file in reports bucket
    const fileName = `inspection_${inspectionId}_${Date.now()}.txt`
    const storagePath = `inspections/${fileName}`

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('reports')
      .upload(storagePath, new TextEncoder().encode(reportContent), {
        contentType: 'text/plain',
        upsert: false,
      })

    if (uploadError) {
      return new Response(JSON.stringify({ error: 'Failed to store report file' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create report database record
    const reportFilename = `Inspection Report - ${windFarm?.name || 'Unknown'} / ${turbine?.name || 'Unknown'} / Blade ${blade?.position || '?'}`

    const { data: report, error: reportError } = await supabaseAdmin
      .from('report')
      .insert({
        type: 'inspection',
        reference_id: inspectionId,
        generated_by: user.id,
        storage_path: storagePath,
        filename: reportFilename,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (reportError) {
      // Attempt to clean up the uploaded file
      await supabaseAdmin.storage.from('reports').remove([storagePath])
      return new Response(JSON.stringify({ error: 'Failed to create report record' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Transition inspection stage to 'report' if this is the first report
    try {
      const { count } = await supabaseAdmin
        .from('report')
        .select('id', { count: 'exact', head: true })
        .eq('reference_id', inspectionId)

      if (count === 1) {
        await supabaseAdmin
          .from('inspection')
          .update({ stage: 'report' })
          .eq('id', inspectionId)
          .neq('stage', 'report')
      }
    } catch (stageError) {
      console.error('[generate-report] Failed to update inspection stage:', stageError)
    }

    return new Response(JSON.stringify({ report }), {
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
