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
      (t) => (t.match(/\d/g) ?? []).length >= 4 && t.length <= 14 && !/^(19|20)\d{2}$/.test(t),
    ) ?? null;

  // Year of manufacture: 19xx/20xx after "Baujahr" / "year".
  const year = /(?:baujahr|year)[^0-9]{0,30}((?:19|20)\d{2})/i.exec(flat)?.[1] ?? null;

  return { manufacturer, model, serialNumber, year };
}

/** How many fields a parse found (used to pick the best photo rotation). */
export function hoistLabelScore(d: HoistLabelData): number {
  return [d.manufacturer, d.model, d.serialNumber, d.year].filter(Boolean).length;
}

/**
 * OCR the hoist label photos IN THE BROWSER (tesseract.js, dynamic import so it
 * stays out of the initial bundle — same as the coating method on repairs).
 * Label photos are often taken sideways, so each photo is tried at 0°, 90° and
 * 270° (scaled to 2000 px, the size that read best on real labels) and the
 * reading with the most fields wins. Never throws: returns null fields.
 */
export async function readHoistLabel(imageUrls: string | string[]): Promise<HoistLabelData> {
  const empty: HoistLabelData = { manufacturer: null, model: null, serialNumber: null, year: null };
  const urls = (Array.isArray(imageUrls) ? imageUrls : [imageUrls]).filter(Boolean);
  if (urls.length === 0) return empty;
  let best = empty;
  try {
    const mod = await import('tesseract.js');
    const Tesseract = (mod as unknown as { default?: typeof import('tesseract.js') }).default ?? mod;
    const worker = await Tesseract.createWorker('eng');
    try {
      for (const url of urls) {
        let img: HTMLImageElement;
        try {
          img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.crossOrigin = 'anonymous';
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('image load failed'));
            i.src = url;
          });
        } catch {
          continue;
        }
        const MAX = 2000;
        const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        for (const deg of [0, 90, 270]) {
          const canvas = document.createElement('canvas');
          const sideways = deg % 180 !== 0;
          canvas.width = sideways ? h : w;
          canvas.height = sideways ? w : h;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((deg * Math.PI) / 180);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          const { data } = await worker.recognize(canvas);
          const parsed = parseHoistLabel(data?.text ?? '');
          if (hoistLabelScore(parsed) > hoistLabelScore(best)) best = parsed;
          if (hoistLabelScore(best) === 4) return best;
        }
      }
    } finally {
      await worker.terminate();
    }
    return best;
  } catch {
    return best;
  }
}
