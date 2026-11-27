/**
 * Read the data plate ("etiqueta") of a chain hoist from OCR text: manufacturer,
 * model, serial number and year of manufacture. Same approach as the coating
 * method on repairs (utils/coatingMethod.ts): tesseract.js in the browser, the
 * result cached in the DB, the report only reads it.
 *
 * OCR of a phone photo is noisy, so every field is best-effort and may come back
 * null; the certification screen shows them in editable boxes.
 */
export interface HoistLabelData {
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  year: string | null;
}

/** Known hoist brands → the name printed in the report. */
const BRANDS: Array<[RegExp, string]> = [
  [/l?i[fl]t\s*ket/i, 'LIFTKET'],
  [/\bGIS\s*AG\b|\bGIS\b/, 'GIS'],
  [/demag/i, 'DEMAG'],
  [/stahl/i, 'STAHL'],
  [/konecranes/i, 'KONECRANES'],
  [/verlinde/i, 'VERLINDE'],
  [/\byale\b/i, 'YALE'],
  [/\bkito\b/i, 'KITO'],
  [/hitachi/i, 'HITACHI'],
  [/\babus\b/i, 'ABUS'],
  [/columbus\s*mckinnon|\bCM\s*lodestar/i, 'COLUMBUS MCKINNON'],
  [/donati/i, 'DONATI'],
  [/elephant/i, 'ELEPHANT'],
];

/** A token that looks like a code (has a digit, 3+ chars, letters/digits/ / . -). */
const CODE = /^[A-Z0-9][A-Z0-9/.\-]{2,}$/i;

function tokensAfter(text: string, keyword: RegExp, maxChars = 80): string[] {
  const m = keyword.exec(text);
  if (!m) return [];
  return text
    .slice(m.index + m[0].length, m.index + m[0].length + maxChars)
    .split(/[\s|:;,_]+/)
    .map((t) => t.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/gi, ''))
    .filter(Boolean);
}

export function parseHoistLabel(text: string): HoistLabelData {
  const flat = (text ?? '').replace(/\r?\n/g, ' | ');

  const manufacturer = BRANDS.find(([re]) => re.test(flat))?.[1] ?? null;

  // Model: first code after "Typ/Type" (also "Bauart/Type"; OCR often reads "Tiplype").
  const model =
    tokensAfter(flat, /(?:bauart|ti[pl]+ype|typ)\s*\/?\s*(?:type)?\s*\.?/i).find(
      (t) => CODE.test(t) && /\d/.test(t) && !/^(19|20)\d{2}$/.test(t),
    ) ?? null;

  // Serial: first mostly-numeric token after "serial no" / "Ser.No." / "Fabrik-Nr".
  const serialNumber =
    tokensAfter(flat, /(?:serial\s*n[o0]|ser\.?\s*n[o0]\.?|fabrik-?\s*nr)\.?/i, 90).find(
      (t) => (t.match(/\d/g) ?? []).length >= 4 && t.length <= 14,
    ) ?? null;

  // Year of manufacture: 19xx/20xx after "Baujahr" / "year".
  const year = /(?:baujahr|year)[^0-9]{0,30}((?:19|20)\d{2})/i.exec(flat)?.[1] ?? null;

  return { manufacturer, model, serialNumber, year };
}

/** How many fields a parse found (used to pick the best photo rotation). */
export function hoistLabelScore(d: HoistLabelData): number {
  return [d.manufacturer, d.model, d.serialNumber, d.year].filter(Boolean).length;
}
