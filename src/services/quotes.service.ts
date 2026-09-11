import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { DEFECT_TYPE_DISPLAY_LABELS, BLADE_POSITION_LABELS } from '@/types';
import { buildCampaignAnnotationCodeMap, isUuid } from './defectNumbering';
import type {
  Quote,
  QuoteItem,
  QuoteMaterial,
  QuotableDefect,
  QuoteCurrency,
  TraceabilityRow,
  TraceabilitySummary,
  RepairCampaign,
} from '@/types';

// ─── Custom Error ───────────────────────────────────────────────────────────

export class QuoteServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'QuoteServiceError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(type: string): string {
  return DEFECT_TYPE_DISPLAY_LABELS[type] ?? type;
}

function bladeLabelFromPosition(position: number | null | undefined): string {
  const pos = Number(position) || 0;
  return BLADE_POSITION_LABELS[pos] ?? (pos ? String(pos) : '');
}

/**
 * Resolve the set of inspection IDs for a turbine (both blade path and
 * direct turbine_id path), mirroring the pattern used across the app.
 */
async function getTurbineInspectionIds(turbineId: string): Promise<string[]> {
  const { data: blades } = await supabase.from('blade').select('id').eq('turbine_id', turbineId);
  const bladeIds = (blades ?? []).map((b: { id: string }) => b.id);

  const { data: bladeInsps } = bladeIds.length > 0
    ? await supabase.from('inspection').select('id').in('blade_id', bladeIds)
    : { data: [] };
  const { data: directInsps } = await supabase
    .from('inspection')
    .select('id')
    .in('turbine_id', [turbineId]);

  const idSet = new Set<string>();
  for (const i of (bladeInsps ?? [])) idSet.add((i as { id: string }).id);
  for (const i of (directInsps ?? [])) idSet.add((i as { id: string }).id);
  return Array.from(idSet);
}

/**
 * Map a raw defect row (with nested inspection/blade) to a QuotableDefect.
 */
function mapDefectRow(row: Record<string, unknown>): QuotableDefect {
  const inspection = row.inspection as Record<string, unknown> | null;
  const blade = inspection?.blade as Record<string, unknown> | null;
  const bladePos = Number(blade?.position) || 0;
  return {
    id: row.id as string,
    type: row.type as string,
    typeLabel: typeLabel(row.type as string),
    severity: Number(row.severity) || 0,
    side: (row.side as string) ?? '',
    bladePosition: bladeLabelFromPosition(bladePos),
    // Persisted campaign-wide correlative (source of truth). Runtime numbering
    // below only fills the gaps for defects not yet recomputed (null column).
    defectNumber: (row.defect_number as string) ?? null,
    distanceFromRoot: Number(row.distance_from_root) || 0,
    widthCm: row.width_cm != null ? Number(row.width_cm) : null,
    heightCm: row.height_cm != null ? Number(row.height_cm) : null,
    description: (row.description as string) ?? null,
  };
}

// ─── Service ────────────────────────────────────────────────────────────────

export const quotesService = {
  /**
   * List the unresolved defects of a turbine, available to be quoted.
   * Grouped by category is done in the UI; here we return a flat list.
   */
  async listQuotableDefects(turbineId: string): Promise<QuotableDefect[]> {
    const inspectionIds = await getTurbineInspectionIds(turbineId);
    if (inspectionIds.length === 0) return [];

    const { data, error } = await supabase
      .from('defect')
      .select(`
        id,
        type,
        severity,
        distance_from_root,
        description,
        width_cm,
        height_cm,
        side,
        resolved,
        created_at,
        defect_number,
        inspection_id,
        inspection:inspection!inner(
          blade:blade(position)
        )
      `)
      .in('inspection_id', inspectionIds)
      .eq('resolved', false)
      .order('severity', { ascending: false });

    if (error) throw new QuoteServiceError(error.message, error.code);

    const rows = ((data as unknown[]) ?? []).map((r) => r as Record<string, unknown>);
    const defects = rows.map((r) => mapDefectRow(r));

    // Exclude defects that are already quoted (with a live quote) or in repair.
    // A defect stays AVAILABLE only if it was never quoted or its quote was
    // REJECTED. If it has a live quote (status requested/quoted/approved) or an
    // active work_order (not cancelled), it must NOT appear.
    const defectIds = defects.map((d) => d.id);
    if (defectIds.length === 0) return [];

    // Defectos con una cotización viva (no rechazada): requested/quoted/approved.
    const { data: quotedRows } = await db
      .from('quote_item')
      .select('defect_id, quote:quote!inner(status)')
      .in('defect_id', defectIds)
      .neq('quote.status', 'rejected');

    // Defectos con work_order activo (en reparación) — refuerzo defensivo.
    const { data: woRows } = await db
      .from('work_order')
      .select('defect_id')
      .in('defect_id', defectIds)
      .neq('status', 'cancelled');

    const blocked = new Set<string>();
    for (const r of (quotedRows ?? [])) {
      const id = (r as { defect_id: string | null }).defect_id;
      if (id) blocked.add(id);
    }
    for (const r of (woRows ?? [])) {
      const id = (r as { defect_id: string | null }).defect_id;
      if (id) blocked.add(id);
    }

    const available = defects.filter((d) => !blocked.has(d.id));

    // Derive the per-blade defect code (A1, A34, B4, ...) reproducing EXACTLY
    // the numbering that the Analyze step performs. Analyze numbers over ALL
    // annotations of the whole CAMPAIGN (not just this turbine), ordered by
    // created_at ASC, keeping a per-blade counter. The defect ↔ annotation link
    // is `defect.description` = annotation.id (a 36-char UUID).
    //
    // SOURCE OF TRUTH: defect.defect_number (persisted by the recompute RPC).
    // The runtime map is only computed as a FALLBACK for defects whose column
    // is still null (older defects not yet recomputed), so nothing breaks while
    // we migrate softly. We still use the annotation blade map to keep the
    // grouping/label prefix consistent with the code (e.g. "C13" → blade C).
    const { codeMap, bladeMap } = await buildCampaignAnnotationCodeMap(inspectionIds);
    for (const d of available) {
      const annId = d.description ?? '';
      if (isUuid(annId)) {
        // Prefer the persisted number; fall back to runtime when column is null.
        if (!d.defectNumber) d.defectNumber = codeMap.get(annId) ?? null;
        const bl = bladeMap.get(annId);
        // Override the fallback bladePosition (inspection.blade.position) with
        // the REAL blade of the annotation's photo, so grouping/label match the
        // code prefix (e.g. "C13" → blade C).
        if (bl) d.bladePosition = bl;
      }
    }

    return available;
  },

  /**
   * Create a quote request in status 'requested' plus a quote_item per defect.
   */
  async createQuote(
    turbineId: string,
    windFarmId: string,
    defectIds: string[],
  ): Promise<Quote> {
    if (defectIds.length === 0) {
      throw new QuoteServiceError('At least one defect is required to request a quote');
    }

    const user = (await db.auth.getUser()).data.user;

    const { data: quote, error: quoteErr } = await db
      .from('quote')
      .insert({
        turbine_id: turbineId || null,
        wind_farm_id: windFarmId || null,
        requested_by: user?.id ?? null,
        status: 'requested',
        currency: 'CLP',
        total_amount: 0,
      })
      .select()
      .single();

    if (quoteErr) throw new QuoteServiceError(quoteErr.message, quoteErr.code);

    const items = defectIds.map((defectId) => ({
      quote_id: quote.id,
      defect_id: defectId,
      labor_hours: 0,
      hourly_rate: 0,
      labor_subtotal: 0,
      materials: [],
      materials_subtotal: 0,
      item_total: 0,
    }));

    const { error: itemsErr } = await db.from('quote_item').insert(items);
    if (itemsErr) throw new QuoteServiceError(itemsErr.message, itemsErr.code);

    return quote as Quote;
  },

  /**
   * List quotes with role-aware filtering.
   * - client: only quotes they requested.
   * - admin/supervisor: all quotes (they need to see requested ones to quote).
   */
  async listQuotes(params: {
    roles: string[];
    userId: string | null;
  }): Promise<Quote[]> {
    let query = db
      .from('quote')
      .select(`
        *,
        turbine:turbine(name),
        wind_farm:wind_farm(name),
        requester:profiles!quote_requested_by_fkey(name),
        items:quote_item(id)
      `)
      .order('created_at', { ascending: false });

    // Multi-role: a user who is a client but NOT also admin/supervisor only
    // sees the quotes they requested. Admins/supervisors see all quotes.
    const roles = params.roles ?? [];
    const isClientOnly =
      roles.includes('client') && !roles.some((r) => r === 'admin' || r === 'supervisor');
    if (isClientOnly && params.userId) {
      query = query.eq('requested_by', params.userId);
    }

    const { data, error } = await query;
    if (error) throw new QuoteServiceError(error.message, error.code);

    return ((data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const turbine = r.turbine as Record<string, unknown> | null;
      const windFarm = r.wind_farm as Record<string, unknown> | null;
      const requester = r.requester as Record<string, unknown> | null;
      const items = (r.items as unknown[]) ?? [];
      return {
        ...(r as unknown as Quote),
        turbineName: (turbine?.name as string) ?? '',
        windFarmName: (windFarm?.name as string) ?? '',
        requestedByName: (requester?.name as string) ?? '',
        itemsCount: items.length,
      } as Quote;
    });
  },

  /**
   * Get a single quote with its items (enriched with defect info + materials).
   */
  async getQuote(id: string): Promise<Quote> {
    const { data: quoteRow, error: quoteErr } = await db
      .from('quote')
      .select(`
        *,
        turbine:turbine(name),
        wind_farm:wind_farm(name),
        requester:profiles!quote_requested_by_fkey(name)
      `)
      .eq('id', id)
      .single();

    if (quoteErr) throw new QuoteServiceError(quoteErr.message, quoteErr.code);

    const { data: itemRows, error: itemsErr } = await db
      .from('quote_item')
      .select(`
        *,
        defect:defect(
          id, type, severity, side, distance_from_root, width_cm, height_cm, description, inspection_id,
          inspection:inspection(blade:blade(position))
        )
      `)
      .eq('quote_id', id)
      .order('created_at', { ascending: true });

    if (itemsErr) throw new QuoteServiceError(itemsErr.message, itemsErr.code);

    // Resolve the REAL blade per defect (from the annotation's photo) so the
    // detail matches the quotable-defects list. Same source as the code prefix.
    const quoteInspectionIds = Array.from(
      new Set(
        ((itemRows as unknown[]) ?? [])
          .map((row) => {
            const defect = (row as Record<string, unknown>).defect as Record<string, unknown> | null;
            return defect?.inspection_id as string | undefined;
          })
          .filter((v): v is string => !!v),
      ),
    );
    const { bladeMap: quoteBladeMap } =
      quoteInspectionIds.length > 0
        ? await buildCampaignAnnotationCodeMap(quoteInspectionIds)
        : { bladeMap: new Map<string, string>() };

    const items: QuoteItem[] = ((itemRows as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const defect = r.defect as Record<string, unknown> | null;
      const inspection = defect?.inspection as Record<string, unknown> | null;
      const blade = inspection?.blade as Record<string, unknown> | null;
      // Fallback blade from inspection.blade.position; overridden below when the
      // defect's annotation photo resolves a real blade letter.
      let bladePosition = bladeLabelFromPosition(Number(blade?.position) || 0);
      const annId = (defect?.description as string) ?? '';
      if (isUuid(annId)) {
        const bl = quoteBladeMap.get(annId);
        if (bl) bladePosition = bl;
      }
      const materials = Array.isArray(r.materials)
        ? (r.materials as QuoteMaterial[])
        : [];
      return {
        id: r.id as string,
        quote_id: r.quote_id as string,
        defect_id: (r.defect_id as string) ?? null,
        labor_hours: Number(r.labor_hours) || 0,
        technicians: Number(r.technicians) || 1,
        hourly_rate: Number(r.hourly_rate) || 0,
        labor_subtotal: Number(r.labor_subtotal) || 0,
        materials,
        materials_subtotal: Number(r.materials_subtotal) || 0,
        item_total: Number(r.item_total) || 0,
        created_at: r.created_at as string,
        defect: defect
          ? {
              id: defect.id as string,
              type: defect.type as string,
              typeLabel: typeLabel(defect.type as string),
              severity: Number(defect.severity) || 0,
              side: (defect.side as string) ?? '',
              distanceFromRoot: Number(defect.distance_from_root) || 0,
              widthCm: defect.width_cm != null ? Number(defect.width_cm) : null,
              heightCm: defect.height_cm != null ? Number(defect.height_cm) : null,
              bladePosition,
              description: (defect.description as string) ?? null,
            }
          : null,
      };
    });

    const r = quoteRow as Record<string, unknown>;
    const turbine = r.turbine as Record<string, unknown> | null;
    const windFarm = r.wind_farm as Record<string, unknown> | null;
    const requester = r.requester as Record<string, unknown> | null;

    return {
      ...(r as unknown as Quote),
      turbineName: (turbine?.name as string) ?? '',
      windFarmName: (windFarm?.name as string) ?? '',
      requestedByName: (requester?.name as string) ?? '',
      items,
    } as Quote;
  },

  /**
   * Save the technical team's response: per-item labor + materials, currency,
   * computed subtotals/total, and move the quote to status 'quoted'.
   */
  async submitQuoteResponse(
    quoteId: string,
    items: {
      id: string;
      labor_hours: number;
      technicians: number;
      hourly_rate: number;
      materials: QuoteMaterial[];
    }[],
    currency: QuoteCurrency,
  ): Promise<void> {
    const user = (await db.auth.getUser()).data.user;

    let total = 0;
    for (const item of items) {
      const laborHours = Number(item.labor_hours) || 0;
      const technicians = Number(item.technicians) || 1;
      const hourlyRate = Number(item.hourly_rate) || 0;
      const laborSubtotal = laborHours * technicians * hourlyRate;
      const materials = (item.materials ?? []).map((m) => ({
        description: m.description ?? '',
        quantity: Number(m.quantity) || 0,
        unit_cost: Number(m.unit_cost) || 0,
        subtotal: (Number(m.quantity) || 0) * (Number(m.unit_cost) || 0),
      }));
      const materialsSubtotal = materials.reduce((sum, m) => sum + m.subtotal, 0);
      const itemTotal = laborSubtotal + materialsSubtotal;
      total += itemTotal;

      const { error } = await db
        .from('quote_item')
        .update({
          labor_hours: laborHours,
          technicians,
          hourly_rate: hourlyRate,
          labor_subtotal: laborSubtotal,
          materials,
          materials_subtotal: materialsSubtotal,
          item_total: itemTotal,
        })
        .eq('id', item.id);
      if (error) throw new QuoteServiceError(error.message, error.code);
    }

    const { error: quoteErr } = await db
      .from('quote')
      .update({
        status: 'quoted',
        currency,
        total_amount: total,
        quoted_by: user?.id ?? null,
        quoted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (quoteErr) throw new QuoteServiceError(quoteErr.message, quoteErr.code);
  },

  /**
   * Client approves the quote: create one work_order per defect item and move
   * the quote to status 'approved'.
   */
  async approveQuote(quoteId: string): Promise<void> {
    const user = (await db.auth.getUser()).data.user;

    const quote = await this.getQuote(quoteId);

    const workOrders = (quote.items ?? []).map((item) => ({
      quote_id: quote.id,
      quote_item_id: item.id,
      defect_id: item.defect_id,
      turbine_id: quote.turbine_id,
      wind_farm_id: quote.wind_farm_id,
      blade_side: item.defect?.side ?? null,
      cost_amount: item.item_total,
      currency: quote.currency,
      status: 'open',
    }));

    if (workOrders.length > 0) {
      const { error: woErr } = await db.from('work_order').insert(workOrders);
      if (woErr) throw new QuoteServiceError(woErr.message, woErr.code);
    }

    // Create a single repair campaign that groups all the work orders of this
    // approved quote, associated with the wind farm + turbine.
    await createRepairCampaign(quote, user?.id ?? null);

    const { error } = await db
      .from('quote')
      .update({
        status: 'approved',
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (error) throw new QuoteServiceError(error.message, error.code);
  },

  /**
   * Get the repair campaign that was created when the given quote was approved
   * (if any). Returns null when no repair campaign exists yet.
   */
  async getRepairCampaign(quoteId: string): Promise<RepairCampaign | null> {
    const { data, error } = await db
      .from('campaign')
      .select('*')
      .eq('quote_id', quoteId)
      .eq('type', 'repair')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return mapRepairCampaignRow(data as Record<string, unknown>);
  },

  /**
   * Client rejects the quote.
   */
  async rejectQuote(quoteId: string): Promise<void> {
    const user = (await db.auth.getUser()).data.user;
    const { error } = await db
      .from('quote')
      .update({
        status: 'rejected',
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);
    if (error) throw new QuoteServiceError(error.message, error.code);
  },

  /**
   * List work orders for a given quote (shown after approval).
   */
  async listWorkOrdersByQuote(quoteId: string): Promise<TraceabilityRow[]> {
    const { data, error } = await db
      .from('work_order')
      .select(`
        *,
        turbine:turbine(name),
        wind_farm:wind_farm(name),
        defect:defect(type)
      `)
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });

    if (error) throw new QuoteServiceError(error.message, error.code);
    return ((data as unknown[]) ?? []).map((row) => mapWorkOrderRow(row as Record<string, unknown>));
  },

  /**
   * Cost & repair traceability across time, optionally filtered by turbine or
   * wind farm. Aggregates work orders and computes per-turbine and per-farm
   * cost totals.
   */
  async getTraceability(params: {
    windFarmId?: string;
    turbineId?: string;
  }): Promise<TraceabilitySummary> {
    let query = db
      .from('work_order')
      .select(`
        *,
        turbine:turbine(name),
        wind_farm:wind_farm(name),
        defect:defect(type)
      `)
      .order('created_at', { ascending: true });

    if (params.turbineId) query = query.eq('turbine_id', params.turbineId);
    if (params.windFarmId) query = query.eq('wind_farm_id', params.windFarmId);

    const { data, error } = await query;
    if (error) throw new QuoteServiceError(error.message, error.code);

    const rows = ((data as unknown[]) ?? []).map((row) =>
      mapWorkOrderRow(row as Record<string, unknown>),
    );

    // Aggregate by turbine and wind farm.
    const byTurbineMap = new Map<string, { turbineId: string; turbineName: string; total: number; count: number }>();
    const byWindFarmMap = new Map<string, { windFarmId: string; windFarmName: string; total: number; count: number }>();

    for (const row of rows) {
      const tKey = row.turbineId ?? '—';
      const existingT = byTurbineMap.get(tKey);
      if (existingT) {
        existingT.total += row.cost;
        existingT.count += 1;
      } else {
        byTurbineMap.set(tKey, {
          turbineId: row.turbineId ?? '',
          turbineName: row.turbineName,
          total: row.cost,
          count: 1,
        });
      }

      const wKey = row.windFarmId ?? '—';
      const existingW = byWindFarmMap.get(wKey);
      if (existingW) {
        existingW.total += row.cost;
        existingW.count += 1;
      } else {
        byWindFarmMap.set(wKey, {
          windFarmId: row.windFarmId ?? '',
          windFarmName: row.windFarmName,
          total: row.cost,
          count: 1,
        });
      }
    }

    const currency: QuoteCurrency = (rows[0]?.currency as QuoteCurrency) ?? 'CLP';

    return {
      byTurbine: Array.from(byTurbineMap.values()).sort((a, b) => b.total - a.total),
      byWindFarm: Array.from(byWindFarmMap.values()).sort((a, b) => b.total - a.total),
      rows,
      currency,
    };
  },
};

/**
 * Create a repair campaign for an approved quote. This groups all the work
 * orders of the quote into a single campaign associated with the wind farm and
 * turbine.
 *
 * Never throws: creating the campaign is a requirement, but a failure here must
 * not roll back the quote approval / work orders. Failures are logged (mirrors
 * the pattern used by transitionInspectionsToInspect in drone-upload.service).
 */
async function createRepairCampaign(quote: Quote, userId: string | null): Promise<void> {
  try {
    const turbineName = quote.turbineName?.trim()
      || (quote.turbine_id ? `turbina ${quote.turbine_id.slice(0, 8)}` : 'turbina');
    const dateLabel = new Date().toLocaleDateString('es-CL');
    const name = `Reparación - ${turbineName} - ${dateLabel}`;

    const { error } = await db.from('campaign').insert({
      type: 'repair',
      name,
      wind_farm_id: quote.wind_farm_id,
      turbine_id: quote.turbine_id,
      quote_id: quote.id,
      status: 'repair_open',
      created_by: userId,
    });

    if (error) {
      console.error('[quotes.service] Failed to create repair campaign:', error);
    }
  } catch (campaignError) {
    console.error('[quotes.service] Failed to create repair campaign:', campaignError);
  }
}

function mapRepairCampaignRow(row: Record<string, unknown>): RepairCampaign {
  return {
    id: row.id as string,
    name: row.name as string,
    windFarmId: row.wind_farm_id as string,
    turbineId: (row.turbine_id as string) ?? null,
    quoteId: (row.quote_id as string) ?? null,
    status: (row.status as RepairCampaign['status']) ?? 'repair_open',
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapWorkOrderRow(row: Record<string, unknown>): TraceabilityRow {
  const turbine = row.turbine as Record<string, unknown> | null;
  const windFarm = row.wind_farm as Record<string, unknown> | null;
  const defect = row.defect as Record<string, unknown> | null;
  return {
    key: row.id as string,
    windFarmId: (row.wind_farm_id as string) ?? null,
    windFarmName: (windFarm?.name as string) ?? '',
    turbineId: (row.turbine_id as string) ?? null,
    turbineName: (turbine?.name as string) ?? '',
    bladeSide: (row.blade_side as string) ?? '',
    defectType: typeLabel((defect?.type as string) ?? ''),
    status: (row.status as TraceabilityRow['status']) ?? 'open',
    cost: Number(row.cost_amount) || 0,
    currency: (row.currency as QuoteCurrency) ?? 'CLP',
    createdAt: row.created_at as string,
  };
}
