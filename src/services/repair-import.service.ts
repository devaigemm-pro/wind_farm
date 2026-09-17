import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────

/** A parsed row from the repair campaign Excel (1-based columns). */
export interface RepairImportRow {
  /** Excel row number (1-based, header excluded) — for error reporting. */
  fila: number;
  /** Wind farm name (wind_farm.name) — used with `turbina` to resolve the exact turbine. */
  parque: string;
  turbina: string;
  /** External identifier from the Excel (e.g. "DAÑO 1"), stored in defect.defect_identifier. */
  defectIdentifier: string;
  serialPala: string;
  lado: string;
  tipoEspanol: string;
}

export interface RepairImportRowError {
  fila: number;
  motivo: string;
}

export interface RepairImportCampaignInfo {
  turbina: string;
  campaignId: string;
  nombre: string;
}

export interface RepairImportSummary {
  total: number;
  ok: number;
  errores: RepairImportRowError[];
  campanias: RepairImportCampaignInfo[];
}

// ─── Defect type mapping (ES → enum) ─────────────────────────────────────────
// Mirrors DEFECT_TYPE_LABELS in RepairWorkflow.tsx. Keys are normalized
// (lowercase, no accents) so both "delaminación" and "delaminacion" match.

const DEFECT_TYPE_ES_MAP: Record<string, string> = {
  delaminacion: 'delamination',
  grieta: 'crack',
  'erosion le': 'le_erosion',
  'danos de pintura': 'paint_defect',
  'dano por rayo': 'lightning_damage',
  vortex: 'vortex',
  otros: 'other',
};

/** Lowercase + strip diacritics, collapse whitespace. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function mapDefectType(tipoEspanol: string): string {
  return DEFECT_TYPE_ES_MAP[normalize(tipoEspanol)] ?? 'other';
}

// ─── Row parsing from a File (first worksheet) ───────────────────────────────

/**
 * Parse the first worksheet of an .xlsx File into RepairImportRow[].
 * Uses the dynamic-import ExcelJS pattern (same as ExportPanel.tsx).
 * Column order (row 1 = header):
 *   1 Parque | 2 Turbina | 3 Identificador Defecto | 4 Pala(serial) | 5 Lado | 6 Tipo
 */
export async function parseRepairRows(file: File): Promise<RepairImportRow[]> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  // Normalize an ExcelJS cell value to a trimmed string (handles rich text,
  // formula results, and hyperlinks).
  const cellText = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if ('text' in obj) return String(obj.text ?? '').trim();
      if ('result' in obj) return String(obj.result ?? '').trim();
      if ('richText' in obj && Array.isArray(obj.richText)) {
        return (obj.richText as { text?: string }[]).map((r) => r.text ?? '').join('').trim();
      }
    }
    return String(value).trim();
  };

  const rows: RepairImportRow[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return; // header
    const parque = cellText(row.getCell(1).value);
    const turbina = cellText(row.getCell(2).value);
    const defectIdentifier = cellText(row.getCell(3).value);
    const serialPala = cellText(row.getCell(4).value);
    const lado = cellText(row.getCell(5).value);
    const tipoEspanol = cellText(row.getCell(6).value);
    // Skip fully empty rows.
    if (!parque && !turbina && !defectIdentifier && !serialPala && !lado && !tipoEspanol) return;
    rows.push({ fila: n, parque, turbina, defectIdentifier, serialPala, lado, tipoEspanol });
  });
  return rows;
}

// ─── Repair campaign per turbine (cache within a run) ────────────────────────

interface CampaignRef {
  campaignId: string;
  quoteId: string;
  nombre: string;
}

/**
 * Get (reuse) or create the repair campaign + quote for a turbine. Cached per
 * run in the provided map so a single campaign/quote is created per turbine.
 */
async function getOrCreateRepairCampaign(
  cache: Map<string, CampaignRef>,
  turbineId: string,
  windFarmId: string | null,
  turbineName: string,
  userId: string | null,
): Promise<CampaignRef> {
  const cached = cache.get(turbineId);
  if (cached) return cached;

  // Try to reuse the latest existing repair campaign of the turbine.
  const { data: existing } = await db
    .from('campaign')
    .select('id, quote_id, name')
    .eq('type', 'repair')
    .eq('turbine_id', turbineId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id && existing?.quote_id) {
    const ref: CampaignRef = {
      campaignId: existing.id as string,
      quoteId: existing.quote_id as string,
      nombre: (existing.name as string) ?? '',
    };
    cache.set(turbineId, ref);
    return ref;
  }

  // Create a new quote + campaign (same shape as quotes.service).
  const now = new Date().toISOString();
  const { data: quote, error: quoteErr } = await db
    .from('quote')
    .insert({
      turbine_id: turbineId,
      wind_farm_id: windFarmId,
      requested_by: userId,
      status: 'approved',
      currency: 'CLP',
      quoted_by: userId,
      quoted_at: now,
      approved_by: userId,
      approved_at: now,
      total_amount: 0,
    })
    .select('id')
    .single();
  if (quoteErr) throw new Error(quoteErr.message);
  const quoteId = quote.id as string;

  // Campaign name: "CI### - <turbine> - dd-mm-yyyy" (same as quotes.service).
  const ci = `CI${Math.floor(100 + Math.random() * 900)}`;
  const nowDate = new Date();
  const dateLabel = `${String(nowDate.getDate()).padStart(2, '0')}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${nowDate.getFullYear()}`;
  const name = `${ci} - ${turbineName} - ${dateLabel}`;

  const { data: campaign, error: campaignErr } = await db
    .from('campaign')
    .insert({
      type: 'repair',
      name,
      wind_farm_id: windFarmId,
      turbine_id: turbineId,
      quote_id: quoteId,
      status: 'repair_open',
      created_by: userId,
    })
    .select('id')
    .single();
  if (campaignErr) throw new Error(campaignErr.message);

  const ref: CampaignRef = { campaignId: campaign.id as string, quoteId, nombre: name };
  cache.set(turbineId, ref);
  return ref;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const repairImportService = {
  /**
   * Import a repair campaign from a parsed set of Excel rows. Each row is
   * processed independently (try/catch) so a single failure does not abort the
   * whole run. Defects are associated to the LATEST repair campaign of their
   * turbine (created if missing), and linked into the repair tree
   * (quote → quote_item → work_order → repair) so they show up in the workflow.
   */
  async importFromRows(rows: RepairImportRow[]): Promise<RepairImportSummary> {
    const user = (await db.auth.getUser()).data.user;
    const userId = user?.id ?? null;

    const campaignCache = new Map<string, CampaignRef>();
    // Track the display name of the turbine per campaign for the summary.
    const campaignTurbineName = new Map<string, string>();
    const errores: RepairImportRowError[] = [];
    let ok = 0;

    for (const row of rows) {
      try {
        const parque = row.parque.trim();
        const turbina = row.turbina.trim();
        const serialPala = row.serialPala.trim();
        const lado = row.lado.trim().toUpperCase();

        if (!parque) throw new Error('Parque vacío');
        if (!turbina) throw new Error('Turbina vacía');
        if (!serialPala) throw new Error('Serial de pala vacío');

        // 1. Wind farm (by name) → resolves the exact turbine (park + turbine),
        //    since turbine names can repeat across parks.
        const { data: windFarm } = await db
          .from('wind_farm')
          .select('id')
          .eq('name', parque)
          .maybeSingle();
        if (!windFarm) throw new Error(`Parque "${parque}" no encontrado`);
        const windFarmId = windFarm.id as string;

        // 2. Turbine (by name WITHIN the wind farm).
        const { data: turbine } = await db
          .from('turbine')
          .select('id')
          .eq('name', turbina)
          .eq('wind_farm_id', windFarmId)
          .maybeSingle();
        if (!turbine) throw new Error(`Turbina "${turbina}" no encontrada en "${parque}"`);
        const turbineId = turbine.id as string;

        // 3. Blade (by serial within the turbine)
        const { data: blade } = await db
          .from('blade')
          .select('id, position')
          .eq('turbine_id', turbineId)
          .eq('serial_number', serialPala)
          .maybeSingle();
        if (!blade) throw new Error(`Pala ${serialPala} no encontrada en ${turbina}`);
        const bladeId = blade.id as string;

        // 4. Inspection of that blade (latest) or create one.
        let inspectionId: string;
        const { data: insp } = await db
          .from('inspection')
          .select('id')
          .eq('blade_id', bladeId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (insp?.id) {
          inspectionId = insp.id as string;
        } else {
          const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          const { data: newInsp, error: inspErr } = await db
            .from('inspection')
            .insert({
              blade_id: bladeId,
              turbine_id: turbineId,
              inspector_id: userId,
              status: 'in_progress',
              stage: 'planned',
              scheduled_date: today,
              campaign_id: null,
            })
            .select('id')
            .single();
          if (inspErr) throw new Error(inspErr.message);
          inspectionId = newInsp.id as string;
        }

        // 5. Defect type mapping
        const type = mapDefectType(row.tipoEspanol);

        // 6. Defect. The Excel no longer carries the root distance ("Ubicacion mm"
        //    was removed) — distance_from_root is computed later by the app from
        //    the technician's z1/z2 inputs, so it starts at 0. The external
        //    identifier ("DAÑO 1") is stored verbatim in defect_identifier.
        const { data: defect, error: defectErr } = await db
          .from('defect')
          .insert({
            inspection_id: inspectionId,
            type,
            severity: 3,
            distance_from_root: 0,
            side: lado || null,
            description: null,
            defect_identifier: row.defectIdentifier || null,
            width_cm: null,
            height_cm: null,
            resolved: false,
          })
          .select('id')
          .single();
        if (defectErr) throw new Error(defectErr.message);
        const defectId = defect.id as string;

        // 7. Repair campaign (one per turbine per run)
        const campaign = await getOrCreateRepairCampaign(
          campaignCache,
          turbineId,
          windFarmId,
          turbina,
          userId,
        );
        campaignTurbineName.set(campaign.campaignId, turbina);

        // 8. Link defect into the repair tree:
        //    quote_item → work_order → repair
        const now = new Date().toISOString();
        const { data: quoteItem, error: qiErr } = await db
          .from('quote_item')
          .insert({
            quote_id: campaign.quoteId,
            defect_id: defectId,
            labor_hours: 0,
            hourly_rate: 0,
            labor_subtotal: 0,
            materials: [],
            materials_subtotal: 0,
            item_total: 0,
          })
          .select('id')
          .single();
        if (qiErr) throw new Error(qiErr.message);

        const { data: workOrder, error: woErr } = await db
          .from('work_order')
          .insert({
            quote_id: campaign.quoteId,
            quote_item_id: quoteItem.id,
            defect_id: defectId,
            turbine_id: turbineId,
            wind_farm_id: windFarmId,
            blade_side: lado || null,
            cost_amount: 0,
            currency: 'CLP',
            status: 'open',
          })
          .select('id')
          .single();
        if (woErr) throw new Error(woErr.message);

        const { error: repairErr } = await db.from('repair').insert({
          work_order_id: workOrder.id,
          defect_id: defectId,
          turbine_id: turbineId,
          technician_id: userId,
          status: 'in_progress',
          current_stage: 'etiqueta',
          started_at: now,
        });
        if (repairErr) throw new Error(repairErr.message);

        ok += 1;
      } catch (err) {
        errores.push({
          fila: row.fila,
          motivo: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const campanias: RepairImportCampaignInfo[] = Array.from(campaignCache.values()).map(
      (ref) => ({
        turbina: campaignTurbineName.get(ref.campaignId) ?? '',
        campaignId: ref.campaignId,
        nombre: ref.nombre,
      }),
    );

    return { total: rows.length, ok, errores, campanias };
  },

  /** Convenience wrapper: parse the File then import. */
  async importFromFile(file: File): Promise<RepairImportSummary> {
    const rows = await parseRepairRows(file);
    return this.importFromRows(rows);
  },
};
