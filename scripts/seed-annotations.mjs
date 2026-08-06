import { createClient } from '@supabase/supabase-js';

const client = createClient(
  'https://esphlzrzwmzeozjmyvqm.supabase.co',
  'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v'
);

const INSPECTION_ID = 'a0000000-0001-4000-8000-000000000001';

// Thumbnail mapping:
// t1-t4 = Blade A / LE
// t5-t6 = Blade A / SS
// t7-t9 = Blade B / LE
// t10-t12 = Blade B / SS
// t13-t15 = Blade C / LE
// t16-t18 = Blade C / SS

// Coordinates are in PERCENT (0-100) of the image viewer area
const annotations = [
  // Blade A - LE (thumbnails t1-t4)
  { thumbnail_id: 't1', x: 30, y: 20, w: 25, h: 18, angle: 0, type: 'LE EROSION', category: 3, note: 'Erosion moderada en BA', root_cause: 'Desgaste ambiental por partículas', next_step: 'Aplicar recubrimiento LEP' },
  { thumbnail_id: 't2', x: 35, y: 40, w: 20, h: 15, angle: 0, type: 'LE EROSION', category: 3, note: 'Erosion leve zona media', root_cause: 'Desgaste ambiental por partículas', next_step: 'Monitorear en próxima inspección' },
  { thumbnail_id: 't3', x: 25, y: 30, w: 30, h: 20, angle: 0, type: 'LE EROSION', category: 4, note: 'Erosion severa', root_cause: 'Exposición prolongada a condiciones severas', next_step: 'Reparación urgente en campo' },

  // Blade A - SS (thumbnails t5-t6)
  { thumbnail_id: 't5', x: 20, y: 25, w: 35, h: 22, angle: 0, type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Perdida de vortex generators', root_cause: 'Adhesivo degradado por exposición UV', next_step: 'Reemplazar paneles en próxima campaña' },

  // Blade B - LE (thumbnails t7-t9)
  { thumbnail_id: 't7', x: 15, y: 35, w: 45, h: 12, angle: 0, type: 'LE EROSION', category: 3, note: 'Erosion lineal extendida', root_cause: 'Desgaste ambiental por partículas', next_step: 'Aplicar recubrimiento LEP' },
  { thumbnail_id: 't8', x: 30, y: 45, w: 25, h: 14, angle: 0, type: 'LE EROSION', category: 3, note: 'Erosion moderada', root_cause: 'Desgaste ambiental por partículas', next_step: 'Aplicar recubrimiento LEP' },
  { thumbnail_id: 't9', x: 20, y: 50, w: 35, h: 10, angle: 0, type: 'LE EROSION', category: 3, note: 'Erosion en punta', root_cause: 'Desgaste ambiental por partículas', next_step: 'Monitorear en próxima inspección' },

  // Blade B - SS (thumbnails t10-t12)
  { thumbnail_id: 't10', x: 25, y: 20, w: 30, h: 25, angle: 0, type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Paneles vortex faltantes', root_cause: 'Adhesivo degradado por exposición UV', next_step: 'Reemplazar paneles en próxima campaña' },
  { thumbnail_id: 't11', x: 18, y: 30, w: 40, h: 20, angle: 0, type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Multiples paneles desprendidos', root_cause: 'Adhesivo degradado por exposición UV', next_step: 'Reemplazar paneles en próxima campaña' },
  { thumbnail_id: 't12', x: 30, y: 40, w: 22, h: 18, angle: 0, type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Panel individual faltante', root_cause: 'Adhesivo degradado por exposición UV', next_step: 'Reemplazar paneles en próxima campaña' },
  { thumbnail_id: 't12', x: 55, y: 25, w: 20, h: 30, angle: 0, type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Paneles faltantes zona tip', root_cause: 'Adhesivo degradado por exposición UV', next_step: 'Reemplazar paneles en próxima campaña' },

  // Blade C - LE (thumbnails t13-t15)
  { thumbnail_id: 't13', x: 10, y: 15, w: 18, h: 12, angle: 0, type: 'OTHER ADD-ONS MISSING', category: 4, note: 'Add-on de proteccion faltante', root_cause: 'Instalación deficiente original', next_step: 'Reinstalar componente' },
  { thumbnail_id: 't13', x: 35, y: 35, w: 30, h: 15, angle: 0, type: 'LE EROSION', category: 3, note: 'Daños cosmeticos por erosion en BA', root_cause: 'Desgaste ambiental por partículas', next_step: 'Aplicar recubrimiento LEP' },
  { thumbnail_id: 't14', x: 20, y: 25, w: 40, h: 16, angle: 0, type: 'LE EROSION', category: 3, note: 'Erosion profunda', root_cause: 'Desgaste ambiental por partículas', next_step: 'Aplicar recubrimiento LEP' },
  { thumbnail_id: 't15', x: 25, y: 40, w: 35, h: 14, angle: 0, type: 'LE EROSION', category: 3, note: 'Erosion extendida zona tip', root_cause: 'Desgaste ambiental por partículas', next_step: 'Monitorear en próxima inspección' },
  { thumbnail_id: 't15', x: 30, y: 60, w: 28, h: 12, angle: 0, type: 'LE EROSION', category: 4, note: 'Erosion severa', root_cause: 'Exposición prolongada a condiciones severas', next_step: 'Reparación urgente en campo' },

  // Blade C - SS (thumbnails t16-t18)
  { thumbnail_id: 't16', x: 22, y: 20, w: 32, h: 22, angle: 0, type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Vortex generators ausentes', root_cause: 'Adhesivo degradado por exposición UV', next_step: 'Reemplazar paneles en próxima campaña' },
  { thumbnail_id: 't17', x: 15, y: 30, w: 28, h: 20, angle: 0, type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Panel menor ausente', root_cause: 'Adhesivo degradado por exposición UV', next_step: 'Reemplazar paneles en próxima campaña' },
  { thumbnail_id: 't17', x: 50, y: 45, w: 25, h: 22, angle: 0, type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Multiples paneles faltantes', root_cause: 'Adhesivo degradado por exposición UV', next_step: 'Reemplazar paneles en próxima campaña' },
  { thumbnail_id: 't18', x: 30, y: 35, w: 20, h: 15, angle: 0, type: 'PAINT DAMAGES', category: 3, note: 'Daño de pintura localizado', root_cause: 'Impacto de objetos', next_step: 'Repintar zona afectada' },
  { thumbnail_id: 't18', x: 55, y: 55, w: 22, h: 14, angle: 0, type: 'LE EROSION', category: 3, note: 'Erosion moderada', root_cause: 'Desgaste ambiental por partículas', next_step: 'Aplicar recubrimiento LEP' },
  { thumbnail_id: 't18', x: 10, y: 65, w: 15, h: 18, angle: 0, type: 'BLADES WITH HYDRAULIC OIL', category: 4, note: 'Mancha de aceite hidraulico', root_cause: 'Fuga sistema hidráulico pitch', next_step: 'Limpiar y reparar fuga' },
];

async function run() {
  // Sign in as admin
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'admin@windfarm.dev',
    password: 'password123',
  });
  if (authError) {
    console.error('Auth Error:', authError.message);
    process.exit(1);
  }
  console.log('Signed in as:', authData.user.email);

  // Delete existing annotations for this inspection
  console.log('\n─── Cleaning existing annotations ───');
  const { error: delError } = await client
    .from('annotation')
    .delete()
    .eq('inspection_id', INSPECTION_ID);

  if (delError) {
    console.error('Delete error:', delError.message);
  } else {
    console.log('Cleaned existing annotations for inspection', INSPECTION_ID);
  }

  // Insert annotations
  console.log('\n─── Inserting annotations ───');
  const rows = annotations.map((a) => ({
    inspection_id: INSPECTION_ID,
    thumbnail_id: a.thumbnail_id,
    x: a.x,
    y: a.y,
    w: a.w,
    h: a.h,
    angle: a.angle,
    type: a.type,
    category: a.category,
    note: a.note,
    root_cause: a.root_cause,
    next_step: a.next_step,
  }));

  const { data, error } = await client
    .from('annotation')
    .insert(rows)
    .select('id, thumbnail_id, type, category');

  if (error) {
    console.error('Insert error:', error.message);
    process.exit(1);
  }

  console.log(`Inserted ${data.length} annotations:`);
  data.forEach((a) => {
    console.log(`  ${a.id} | ${a.thumbnail_id} | ${a.type} | cat ${a.category}`);
  });

  console.log('\n✓ Seed complete');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
