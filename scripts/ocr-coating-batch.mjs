// One-off batch: OCR the "Coating Method" off every repair's label photo
// (stage 'etiqueta', image 1) and persist it to repair.blade_color.
//
// Runs tesseract.js in NODE. Many Vestas labels are photographed ROTATED
// (90/180/270°) and tinted, so a single pass fails. For each image we:
//   1. fetch the bytes,
//   2. preprocess with sharp (grayscale + normalize + upscale) at each of the
//      4 orientations (0/90/180/270),
//   3. OCR each orientation and keep the first one that yields a "Coating
//      Method" line.
// Reads /tmp/etiquetas.json ([{repair_id, storage_path}]); writes
// /tmp/ocr-results.json ([{repair_id, coating}]) for a follow-up SQL UPDATE.
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public/inspection-photos/`;

function parseCoatingMethod(text) {
  if (!text) return null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/coating\s*method\s*[:：]?\s*(.+)$/i);
    if (m && m[1]) {
      const v = m[1].trim();
      if (v && /[A-Za-z0-9]/.test(v)) return v;
    }
  }
  // Fallback: a RAL code anywhere in the text (e.g. "RAL-7035-2009").
  const ral = text.match(/RAL[\s-]?\d{3,4}[\s-]?\d{0,4}/i);
  return ral ? ral[0].trim() : null;
}

async function preprocess(buf, rotation) {
  // Grayscale + normalize (contrast) + upscale small labels, then rotate.
  return sharp(buf)
    .rotate(rotation)
    .grayscale()
    .normalize()
    .resize({ width: 1600, withoutEnlargement: false })
    .toBuffer();
}

const rows = JSON.parse(readFileSync('/tmp/etiquetas.json', 'utf8'));
console.log(`Pending labels: ${rows.length}`);

const worker = await createWorker('eng');
const results = [];
let i = 0;
for (const { repair_id, storage_path } of rows) {
  i++;
  const url = PUBLIC_BASE + storage_path;
  let coating = null;
  try {
    const resp = await fetch(url);
    const buf = Buffer.from(await resp.arrayBuffer());
    for (const rot of [0, 90, 180, 270]) {
      const pre = await preprocess(buf, rot);
      const { data } = await worker.recognize(pre);
      coating = parseCoatingMethod(data?.text ?? '');
      if (coating) {
        console.log(`[${i}/${rows.length}] ${repair_id} -> ${coating}  (rot ${rot})`);
        break;
      }
    }
    if (!coating) console.log(`[${i}/${rows.length}] ${repair_id} -> (none)`);
  } catch (e) {
    console.log(`[${i}/${rows.length}] ${repair_id} -> ERROR ${e?.message ?? e}`);
  }
  results.push({ repair_id, coating });
}
await worker.terminate();

writeFileSync('/tmp/ocr-results.json', JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.coating).length;
console.log(`\nDone. ${ok}/${results.length} coating methods extracted. Results in /tmp/ocr-results.json`);
