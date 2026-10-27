import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * A parsed row from the turbine bulk-import Excel (1-based columns). Each row
 * describes a single turbine with its 3 blades. Column order (row 1 = header):
 *   1 nombre | 2 fabricante | 3 modelo | 4 potencia (kw) | 5 numero de serie
 *   6 numero serie pala 1 | 7 longitud pala 1
 *   8 numero serie pala 2 | 9 longitud pala 2
 *   10 numero serie pala 3 | 11 longitud pala 3
 *
 * The wind farm is NOT read from the spreadsheet — the operator picks it in the
 * Turbines tab combobox and it applies to EVERY row of the file.
 */
export interface TurbineImportRow {
  /** Excel row number (1-based, header excluded) — for error reporting. */
  fila: number;
  name: string;
  manufacturer: string;
  model: string;
  /** Raw "potencia (kw)" cell (number as string); parsed on insert. */
  powerKw: string;
  serialNumber: string;
  /** Blade 1 */
  blade1Serial: string;
  blade1Length: string;
  /** Blade 2 */
  blade2Serial: string;
  blade2Length: string;
  /** Blade 3 */
  blade3Serial: string;
  blade3Length: string;
}

export interface TurbineImportSummary {
  created: number;
  failed: number;
  errors: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a numeric Excel cell (handles comma decimals). Null when empty/invalid. */
function parseNumber(value: string): number | null {
  const v = (value ?? '').toString().trim().replace(',', '.');
  if (!v) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ─── Row parsing from a File (first worksheet) ───────────────────────────────

/**
 * Parse the first worksheet of an .xlsx File into TurbineImportRow[].
 * Uses the dynamic-import ExcelJS pattern (same as parseRepairRows).
 */
export async function parseTurbineRows(file: File): Promise<TurbineImportRow[]> {
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

  const rows: TurbineImportRow[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return; // header
    const name = cellText(row.getCell(1).value);
    const manufacturer = cellText(row.getCell(2).value);
    const model = cellText(row.getCell(3).value);
    const powerKw = cellText(row.getCell(4).value);
    const serialNumber = cellText(row.getCell(5).value);
    const blade1Serial = cellText(row.getCell(6).value);
    const blade1Length = cellText(row.getCell(7).value);
    const blade2Serial = cellText(row.getCell(8).value);
    const blade2Length = cellText(row.getCell(9).value);
    const blade3Serial = cellText(row.getCell(10).value);
    const blade3Length = cellText(row.getCell(11).value);

    // Skip fully empty rows.
    if (
      !name && !manufacturer && !model && !powerKw && !serialNumber &&
      !blade1Serial && !blade1Length && !blade2Serial && !blade2Length &&
      !blade3Serial && !blade3Length
    ) {
      return;
    }

    rows.push({
      fila: n,
      name,
      manufacturer,
      model,
      powerKw,
      serialNumber,
      blade1Serial,
      blade1Length,
      blade2Serial,
      blade2Length,
      blade3Serial,
      blade3Length,
    });
  });
  return rows;
}

/**
 * Build and download an .xlsx template with ONLY the header row of the turbine
 * bulk-import format. Uses the dynamic-import ExcelJS pattern (same as
 * downloadDefectTemplate) — no external binary.
 */
export async function downloadTurbineTemplate(): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Turbinas');
  sheet.addRow([
    'nombre',
    'fabricante',
    'modelo',
    'potencia (kw)',
    'numero de serie',
    'numero serie pala 1',
    'longitud pala 1',
    'numero serie pala 2',
    'longitud pala 2',
    'numero serie pala 3',
    'longitud pala 3',
  ]);
  sheet.getRow(1).font = { bold: true };

  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-carga-turbinas.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Insert turbines from a parsed set of Excel rows. Each row is processed
 * independently (try/catch) so a single failure does not abort the whole run.
 * The wind farm comes from the Turbines tab combobox (shared by every row).
 *
 * IMPORTANT (RLS / DB trigger): inserting into `turbine` fires the AFTER INSERT
 * trigger `on_turbine_created` (SECURITY DEFINER fn `create_blades_for_turbine`)
 * which auto-creates the 3 blades (position 1/2/3, serial/length null). The
 * `blade` table has RLS with NO INSERT policy, so we must NOT insert blades
 * from the client — it would be rejected and fail the whole row. Instead, after
 * the turbine insert we UPDATE the already-created blades (UPDATE is allowed for
 * admin/supervisor by the existing policy) to set serial_number / length_meters.
 */
export async function importTurbines(
  rows: TurbineImportRow[],
  windFarmId: string,
): Promise<TurbineImportSummary> {
  if (!windFarmId) throw new Error('Parque no seleccionado');

  const errors: string[] = [];
  let created = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const name = row.name.trim();
      if (!name) throw new Error('Nombre de turbina vacío');

      // 1. Insert turbine (wind_farm_id from the selected combobox).
      const { data: turbine, error: turbineErr } = await db
        .from('turbine')
        .insert({
          wind_farm_id: windFarmId,
          name,
          manufacturer: row.manufacturer.trim() || null,
          model: row.model.trim() || null,
          power_kw: parseNumber(row.powerKw),
          serial_number: row.serialNumber.trim() || null,
        })
        .select('id')
        .single();
      if (turbineErr) throw new Error(turbineErr.message);
      const turbineId = turbine.id as string;

      // 2. Update the 3 blades auto-created by the `on_turbine_created` trigger.
      //    We do NOT insert blades (RLS has no INSERT policy on `blade`). For
      //    each position we only UPDATE when the row carries a serial or a
      //    length; otherwise the blade is left as the trigger created it.
      const bladeDefs = [
        { position: 1, serial: row.blade1Serial.trim(), length: row.blade1Length },
        { position: 2, serial: row.blade2Serial.trim(), length: row.blade2Length },
        { position: 3, serial: row.blade3Serial.trim(), length: row.blade3Length },
      ];

      for (const b of bladeDefs) {
        const length = parseNumber(b.length);
        if (!b.serial && length == null) continue; // nothing to set for this blade

        const { error: bladeErr } = await db
          .from('blade')
          .update({
            serial_number: b.serial || null,
            length_meters: length,
          })
          .eq('turbine_id', turbineId)
          .eq('position', b.position);

        // The turbine already exists; a blade UPDATE failure should not discard
        // the row. Record the reason but keep the turbine counted as created.
        if (bladeErr) {
          errors.push(`Fila ${row.fila} (pala ${b.position}): ${bladeErr.message}`);
        }
      }

      created += 1;
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      errors.push(`Fila ${row.fila}: ${motivo}`);
      failed += 1;
    }
  }

  return { created, failed, errors };
}

export const turbineImportService = {
  /** Convenience wrapper: parse the File then import. */
  async importFromFile(file: File, windFarmId: string): Promise<TurbineImportSummary> {
    const rows = await parseTurbineRows(file);
    return importTurbines(rows, windFarmId);
  },
};
