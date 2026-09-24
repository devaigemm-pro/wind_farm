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
  /** Raw "Ubicacion del daño" cell from the Excel (number as string, e.g. "43000"); parsed on insert. */
  ubicacionDanio: string;
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
  /** Id of the persisted defect_import batch (null if history persistence failed). */
  importId?: string | null;
}

// ─── Import history (persistent) ─────────────────────────────────────────────

/** A persisted defect-import batch, as shown in the Defects tab history list. */
export interface DefectImport {
  id: string;
  uploadedByName: string | null;
  fileName: string | null;
  total: number;
  okCount: number;
  errorCount: number;
  createdAt: string;
}

/** A persisted snapshot row of a defect-import batch. */
export interface DefectImportRow {
  id: string;
  importId: string;
  fila: number | null;
  parque: string | null;
  turbina: string | null;
  ubicacionDanio: string | null;
  defectIdentifier: string | null;
  serialPala: string | null;
  lado: string | null;
  tipo: string | null;
  status: string;
  motivo: string | null;
  createdAt: string;
}

// ─── Defect type mapping (Excel "Tipo" → annotation_type.name) ───────────────
// The source of truth for defect types is the `annotation_type` table (names in
// UPPERCASE ENGLISH, e.g. "CRACK", "LE EROSION", "SHELL DELAMINATION"). The Excel
// "Tipo" column already comes in English with those same names. We resolve each
// row's type against a normalized map built once per import run.

/** Lowercase + strip diacritics, collapse whitespace. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Load all active annotation types and build a map from the NORMALIZED name to
 * the original `annotation_type.name` (stored verbatim in defect.type). Loaded
 * once per import run — never per row.
 */
async function loadDefectTypeMap(): Promise<Map<string, string>> {
  const { data, error } = await db
    .from('annotation_type')
    .select('name')
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { name: string }[]) {
    if (row?.name) map.set(normalize(row.name), row.name);
  }
  return map;
}

/**
 * Resolve the Excel "Tipo" value to an annotation_type.name using the prebuilt
 * map. Throws (strict validation) when the type is not recognized.
 */
function mapDefectType(tipoEspanol: string, typeMap: Map<string, string>): string {
  const match = typeMap.get(normalize(tipoEspanol));
  if (!match) throw new Error(`Tipo de daño no reconocido: "${tipoEspanol}"`);
  return match;
}

/** Parse the "Ubicacion del daño" Excel cell to a number (mm). Null when empty/invalid. */
function parseUbicacion(value: string): number | null {
  const v = (value ?? '').toString().trim().replace(',', '.');
  if (!v) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ─── Row parsing from a File (first worksheet) ───────────────────────────────

/**
 * Parse the first worksheet of an .xlsx File into RepairImportRow[].
 * Uses the dynamic-import ExcelJS pattern (same as ExportPanel.tsx).
 * Column order (row 1 = header):
 *   1 Parque | 2 Turbina | 3 Ubicacion del daño (mm) | 4 Identificador Defecto | 5 Pala(serial) | 6 Lado | 7 Tipo
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
    const ubicacionDanio = cellText(row.getCell(3).value);
    const defectIdentifier = cellText(row.getCell(4).value);
    const serialPala = cellText(row.getCell(5).value);
    const lado = cellText(row.getCell(6).value);
    const tipoEspanol = cellText(row.getCell(7).value);
    // Skip fully empty rows.
    if (!parque && !turbina && !ubicacionDanio && !defectIdentifier && !serialPala && !lado && !tipoEspanol) return;
    rows.push({ fila: n, parque, turbina, ubicacionDanio, defectIdentifier, serialPala, lado, tipoEspanol });
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
  async importFromRows(
    rows: RepairImportRow[],
    fileName?: string,
  ): Promise<RepairImportSummary> {
    const user = (await db.auth.getUser()).data.user;
    const userId = user?.id ?? null;

    // Load defect types once per run (annotation_type is the source of truth).
    const typeMap = await loadDefectTypeMap();

    const campaignCache = new Map<string, CampaignRef>();
    // Track the display name of the turbine per campaign for the summary.
    const campaignTurbineName = new Map<string, string>();
    const errores: RepairImportRowError[] = [];
    // Per-row result (ok/error + reason) kept in Excel order for the snapshot.
    const rowResults: { row: RepairImportRow; status: 'ok' | 'error'; motivo: string | null }[] = [];
    let ok = 0;

    for (const row of rows) {
      try {
        const parque = row.parque.trim();
        const turbina = row.turbina.trim();
        const serialPala = row.serialPala.trim();
        const lado = row.lado.trim().toUpperCase();
        const defectIdentifier = row.defectIdentifier.trim();

        if (!parque) throw new Error('Parque vacío');
        if (!turbina) throw new Error('Turbina vacía');
        if (!serialPala) throw new Error('Serial de pala vacío');
        if (!defectIdentifier) throw new Error('Identificador de defecto vacío');

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

        // 5. Defect type mapping (against annotation_type; rejects unknown types)
        const type = mapDefectType(row.tipoEspanol, typeMap);

        // 6. Defect. distance_from_root now comes directly from the Excel
        //    ("Ubicacion del daño" column, in mm) via parseUbicacion. The external
        //    identifier ("DAÑO 1") is stored verbatim in defect_identifier.
        const { data: defect, error: defectErr } = await db
          .from('defect')
          .insert({
            inspection_id: inspectionId,
            type,
            severity: 3,
            distance_from_root: parseUbicacion(row.ubicacionDanio),
            side: lado || null,
            description: null,
            defect_identifier: defectIdentifier,
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
        rowResults.push({ row, status: 'ok', motivo: null });
      } catch (err) {
        const motivo = err instanceof Error ? err.message : String(err);
        errores.push({ fila: row.fila, motivo });
        rowResults.push({ row, status: 'error', motivo });
      }
    }

    const campanias: RepairImportCampaignInfo[] = Array.from(campaignCache.values()).map(
      (ref) => ({
        turbina: campaignTurbineName.get(ref.campaignId) ?? '',
        campaignId: ref.campaignId,
        nombre: ref.nombre,
      }),
    );

    // Persist the import history (batch + per-row snapshot). This is SECONDARY:
    // a failure here must never abort the import, so we log and continue.
    const importId = await persistImportHistory(
      userId,
      fileName ?? null,
      rows.length,
      ok,
      errores.length,
      rowResults,
    );

    return { total: rows.length, ok, errores, campanias, importId };
  },

  /** Convenience wrapper: parse the File then import (keeps the file name). */
  async importFromFile(file: File): Promise<RepairImportSummary> {
    const rows = await parseRepairRows(file);
    return this.importFromRows(rows, file.name);
  },

  /**
   * List every persisted defect-import batch (all users, newest first). The
   * uploader name is resolved via the profiles relationship. Not filtered by
   * user — the Defects tab shows imports from all users.
   */
  async getDefectImports(): Promise<DefectImport[]> {
    const { data, error } = await db
      .from('defect_import')
      .select('id, file_name, total, ok_count, error_count, created_at, profiles:uploaded_by(name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return ((data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const profile = r.profiles as { name?: string } | null;
      return {
        id: r.id as string,
        uploadedByName: profile?.name ?? null,
        fileName: (r.file_name as string) ?? null,
        total: Number(r.total ?? 0),
        okCount: Number(r.ok_count ?? 0),
        errorCount: Number(r.error_count ?? 0),
        createdAt: r.created_at as string,
      };
    });
  },

  /** Snapshot rows of a defect-import batch, in original Excel order. */
  async getDefectImportRows(importId: string): Promise<DefectImportRow[]> {
    const { data, error } = await db
      .from('defect_import_row')
      .select(
        'id, import_id, fila, parque, turbina, ubicacion_danio, defect_identifier, serial_pala, lado, tipo, status, motivo, created_at',
      )
      .eq('import_id', importId)
      .order('fila', { ascending: true });
    if (error) throw new Error(error.message);

    return ((data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        importId: r.import_id as string,
        fila: r.fila != null ? Number(r.fila) : null,
        parque: (r.parque as string) ?? null,
        turbina: (r.turbina as string) ?? null,
        ubicacionDanio: (r.ubicacion_danio as string) ?? null,
        defectIdentifier: (r.defect_identifier as string) ?? null,
        serialPala: (r.serial_pala as string) ?? null,
        lado: (r.lado as string) ?? null,
        tipo: (r.tipo as string) ?? null,
        status: (r.status as string) ?? 'ok',
        motivo: (r.motivo as string) ?? null,
        createdAt: r.created_at as string,
      };
    });
  },
};

/**
 * Persist the import batch (defect_import) and its per-row snapshot
 * (defect_import_row). Secondary to the import itself: any failure is logged and
 * swallowed, and the function returns null so the summary still resolves.
 */
async function persistImportHistory(
  userId: string | null,
  fileName: string | null,
  total: number,
  okCount: number,
  errorCount: number,
  rowResults: { row: RepairImportRow; status: 'ok' | 'error'; motivo: string | null }[],
): Promise<string | null> {
  try {
    const { data: batch, error: batchErr } = await db
      .from('defect_import')
      .insert({
        uploaded_by: userId,
        file_name: fileName,
        total,
        ok_count: okCount,
        error_count: errorCount,
      })
      .select('id')
      .single();
    if (batchErr) throw new Error(batchErr.message);
    const importId = batch.id as string;

    if (rowResults.length > 0) {
      const rowsPayload = rowResults.map(({ row, status, motivo }) => ({
        import_id: importId,
        fila: row.fila,
        parque: row.parque,
        turbina: row.turbina,
        ubicacion_danio: row.ubicacionDanio,
        defect_identifier: row.defectIdentifier,
        serial_pala: row.serialPala,
        lado: row.lado,
        tipo: row.tipoEspanol,
        status,
        motivo,
      }));
      const { error: rowsErr } = await db.from('defect_import_row').insert(rowsPayload);
      if (rowsErr) throw new Error(rowsErr.message);
    }

    return importId;
  } catch (err) {
    console.error('[repair-import.service] Failed to persist import history:', err);
    return null;
  }
}
