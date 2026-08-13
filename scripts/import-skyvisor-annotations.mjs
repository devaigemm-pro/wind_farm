/**
 * Import annotations from Skyvisor into our system.
 * Maps photoId → inspection_photo.id and creates annotation records.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';
const INSPECTION_ID = 'abe05885-3c6c-45f1-8550-5006b16118e2';
const CAMPAIGN_ID = '1118f958-4b94-452c-a215-63c37fd70a44';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Skyvisor annotations (36 total)
const skyvisorAnnotations = [
  {"photoId":"0014","x":51.73,"y":0.31,"width":2.04,"height":99.38,"angle":-0.03,"type":"VORTEX (MISSING PANELS)","severity":3,"note":"","hubDistance":39.6},
  {"photoId":"0015","x":56.31,"y":40.51,"width":0.69,"height":2.69,"angle":-0.01,"type":"OTHER CRACKS ON SURFACE","severity":3,"note":"Aparente grieta longitudinal en BA","hubDistance":38.1},
  {"photoId":"0018","x":50.47,"y":0.19,"width":2.03,"height":98.87,"angle":-0.02,"type":"VORTEX (MISSING PANELS)","severity":3,"note":"","hubDistance":35.39},
  {"photoId":"0020","x":48.16,"y":0.61,"width":1.88,"height":98.02,"angle":-0.03,"type":"VORTEX (MISSING PANELS)","severity":3,"note":"","hubDistance":30.78},
  {"photoId":"0021","x":55.73,"y":74.75,"width":1.85,"height":17.78,"angle":0,"type":"OTHER CRACKS ON SURFACE","severity":4,"note":"Aparente grieta longitudinal en BA","hubDistance":28.58},
  {"photoId":"0063","x":56.07,"y":56.2,"width":2.5,"height":42.84,"angle":-0.07,"type":"VORTEX (MISSING PANELS)","severity":3,"note":"","hubDistance":28.38},
  {"photoId":"0064","x":55.17,"y":-2.97,"width":2.15,"height":98.33,"angle":-0.07,"type":"VORTEX (MISSING PANELS)","severity":3,"note":"","hubDistance":30.61},
  {"photoId":"0065","x":56.45,"y":32.17,"width":2.44,"height":66.56,"angle":-0.05,"type":"VORTEX (MISSING PANELS)","severity":3,"note":"","hubDistance":35.17},
  {"photoId":"0066","x":56.24,"y":36.56,"width":2.36,"height":62.65,"angle":-0.05,"type":"VORTEX (MISSING PANELS)","severity":3,"note":"","hubDistance":38.69},
  {"photoId":"0067","x":46.01,"y":0.48,"width":12.87,"height":64.04,"angle":-0.02,"type":"BLADES WITH HYDRAULIC OIL","severity":4,"note":"Pala con aparente contaminacion de aceite en el interior de la pala","hubDistance":41.73},
  {"photoId":"0149","x":33.45,"y":33.08,"width":71.69,"height":3.25,"angle":-0.56,"type":"LE EROSION","severity":4,"note":"","hubDistance":41.59},
  {"photoId":"0152","x":35.99,"y":38.71,"width":55.34,"height":2.95,"angle":-0.56,"type":"LE EROSION","severity":3,"note":"","hubDistance":37.88},
  {"photoId":"0156","x":-2.1,"y":85.32,"width":32,"height":1.66,"angle":-0.54,"type":"LE EROSION","severity":3,"note":"","hubDistance":35.14},
  {"photoId":"0160","x":24.23,"y":69.2,"width":13.01,"height":1.94,"angle":-0.54,"type":"LONGITUDINAL CRACKS ON LE OR TE BOND LINES","severity":4,"note":"","hubDistance":28.62},
  {"photoId":"0170","x":8.41,"y":49.89,"width":78.02,"height":2.96,"angle":-0.52,"type":"OTHER CRACKS ON SURFACE","severity":4,"note":"","hubDistance":13.98},
  {"photoId":"0201","x":34.06,"y":53.08,"width":69.34,"height":4.2,"angle":0.51,"type":"LE EROSION","severity":3,"note":"","hubDistance":31.51},
  {"photoId":"0204","x":25.69,"y":53.97,"width":78.57,"height":2.72,"angle":0.52,"type":"LE EROSION","severity":3,"note":"","hubDistance":35.63},
  {"photoId":"0207","x":8.72,"y":49.52,"width":87.04,"height":2.33,"angle":0.53,"type":"LE EROSION","severity":4,"note":"","hubDistance":40.3},
  {"photoId":"0241","x":64.93,"y":54.08,"width":0.8,"height":3.26,"angle":0.19,"type":"OTHER ADD-ONS MISSING","severity":3,"note":"Tubo de drenaje faltante","hubDistance":2.18},
  {"photoId":"0266","x":67.33,"y":32.46,"width":1.59,"height":7.07,"angle":-0.02,"type":"PAINT DAMAGES","severity":3,"note":"Reparacion con malos acabados","hubDistance":31.79},
  {"photoId":"0273","x":62.02,"y":14.75,"width":0.44,"height":2.78,"angle":-0.06,"type":"LONGITUDINAL CRACKS ON LE OR TE BOND LINES","severity":3,"note":"Pequeñas quebraduras en BS","hubDistance":40.54},
  {"photoId":"0276","x":60.96,"y":33.26,"width":1.24,"height":9.59,"angle":-0.18,"type":"LONGITUDINAL CRACKS ON LE OR TE BOND LINES","severity":4,"note":"Borde de salida abierto y contaminacion por aceite.","hubDistance":42.74},
  {"photoId":"0296","x":53.89,"y":1.85,"width":2.18,"height":97.52,"angle":0.01,"type":"VORTEX (MISSING PANELS)","severity":3,"note":"","hubDistance":34.17},
  {"photoId":"0300","x":51.65,"y":0.22,"width":3.52,"height":44.92,"angle":0.04,"type":"PAINT DAMAGES","severity":3,"note":"Malos acabados de pintura","hubDistance":31.19},
  {"photoId":"0327","x":77.15,"y":72.96,"width":10.64,"height":10.4,"angle":0.06,"type":"OTHER CRACKS ON SURFACE","severity":4,"note":"Reparacion existente con malos acabados y procesos de refuerzo cuestionables.","hubDistance":2.51},
  {"photoId":"0363","x":46.5,"y":0.48,"width":3.98,"height":98.73,"angle":-0.01,"type":"PAINT DAMAGES","severity":3,"note":"Aplicacion y pintura deficiente","hubDistance":27.61},
  {"photoId":"0366","x":45.27,"y":19.6,"width":4,"height":47.11,"angle":-0.01,"type":"LE EROSION","severity":3,"note":"","hubDistance":30.28},
  {"photoId":"0371","x":45.01,"y":0.31,"width":2.19,"height":98.61,"angle":-0.01,"type":"LE EROSION","severity":3,"note":"","hubDistance":34.21},
  {"photoId":"0375","x":44.44,"y":75.96,"width":2.42,"height":21.43,"angle":-0.03,"type":"LE EROSION","severity":4,"note":"Erosion agresiva en BA con perdida de laminados y posible perforacion en linea de pegado","hubDistance":37.01},
  {"photoId":"0376","x":44.19,"y":1.06,"width":2.52,"height":95.44,"angle":-0.01,"type":"LE EROSION","severity":4,"note":"Erosion con perdida de laminados","hubDistance":39.45},
  {"photoId":"0378","x":47.15,"y":4.61,"width":2.28,"height":94.59,"angle":-0.01,"type":"LE EROSION","severity":4,"note":"Erosion agresiva en BA con perdida de laminados muy pronto a desarrollar perforaciones en linea de pegado","hubDistance":41.33},
  {"photoId":"0406","x":46.4,"y":23.9,"width":0.33,"height":2.58,"angle":-0.03,"type":"LONGITUDINAL CRACKS ON LE OR TE BOND LINES","severity":3,"note":"Pequeño daño en BS","hubDistance":33.92},
  {"photoId":"0410","x":41.2,"y":29.35,"width":2.82,"height":25.48,"angle":0.01,"type":"PAINT DAMAGES","severity":3,"note":"Malos acabados de pintura","hubDistance":29.1},
  {"photoId":"0430","x":10.06,"y":7.25,"width":15.18,"height":92.34,"angle":-0.04,"type":"PAINT DAMAGES","severity":3,"note":"Contaminacion en superficie por resina derramada.","hubDistance":8.85},
  {"photoId":"0435","x":6.9,"y":6.28,"width":24.64,"height":57.91,"angle":-0.24,"type":"OTHER CRACKS ON SURFACE","severity":4,"note":"Reparaciones con malos acabados y refuerzos cuestionables","hubDistance":4.57},
  {"photoId":"0436","x":19.4,"y":34.4,"width":18.92,"height":13.24,"angle":-0.23,"type":"OTHER CRACKS ON SURFACE","severity":4,"note":"Grieta en laminados","hubDistance":3.54},
];

// Map Skyvisor defect types to our system types
const typeMap = {
  'VORTEX (MISSING PANELS)': 'vortex',
  'OTHER CRACKS ON SURFACE': 'crack',
  'LE EROSION': 'le_erosion',
  'LONGITUDINAL CRACKS ON LE OR TE BOND LINES': 'crack',
  'BLADES WITH HYDRAULIC OIL': 'other',
  'OTHER ADD-ONS MISSING': 'other',
  'PAINT DAMAGES': 'paint_defect',
};

async function main() {
  console.log('═══ Import Skyvisor Annotations ═══\n');

  await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  console.log('✓ Authenticated\n');

  // Get photo mapping: DJI number → inspection_photo.id
  const { data: photos } = await supabase
    .from('inspection_photo')
    .select('id, filename')
    .eq('campaign_id', CAMPAIGN_ID);

  const photoMap = {};
  for (const p of photos) {
    const match = p.filename.match(/DJI_(\d+)/);
    if (match) photoMap[match[1]] = p.id;
  }
  console.log(`Photo map: ${Object.keys(photoMap).length} entries`);

  // Build annotation records
  const skipped = [];
  const annotations = skyvisorAnnotations.map(a => {
    const thumbnailId = photoMap[a.photoId];
    if (!thumbnailId) {
      skipped.push(a.photoId);
      return null;
    }
    return {
      inspection_id: INSPECTION_ID,
      thumbnail_id: thumbnailId,
      x: a.x / 100,        // Convert percentage to 0-1 fraction
      y: a.y / 100,
      w: a.width / 100,
      h: a.height / 100,
      angle: a.angle,
      type: typeMap[a.type] || 'other',
      category: a.severity,
      note: a.note || null,
      root_cause: null,
      next_step: null,
    };
  }).filter(Boolean);

  if (skipped.length > 0) {
    console.log(`⚠ Skipped ${skipped.length} annotations (no matching photo): ${skipped.join(', ')}`);
  }
  console.log(`Inserting ${annotations.length} annotations...\n`);

  const { data: inserted, error } = await supabase
    .from('annotation')
    .insert(annotations)
    .select('id');

  if (error) {
    console.error('✗ Insert failed:', error.message);
    process.exit(1);
  }

  console.log(`✓ ${inserted.length} annotations inserted`);

  // Update inspection stage to 'annotated'
  await supabase
    .from('inspection')
    .update({ stage: 'annotated' })
    .eq('id', INSPECTION_ID);

  console.log('✓ Inspection stage updated to "annotated"');
  console.log('\n═══ Done ═══');
}

main().catch(e => { console.error(e); process.exit(1); });
