/**
 * Creates a complete inspection for ADD-T02 with 3 blades, 60 photos, 15 annotations, 15 defects.
 */
const TOKEN = 'REDACTED';
const PROJECT = 'esphlzrzwmzeozjmyvqm';

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) { console.log('ERROR', res.status, (await res.text()).slice(0, 200)); return null; }
  return await res.json();
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Creating complete inspection for ADD-T02...\n');

  // Campaign
  await sleep(1000);
  const r1 = await query("INSERT INTO campaign (wind_farm_id, name, status) VALUES ('f0000000-0003-4000-8000-000000000003', 'July 2026 - ADD-T02 Full', 'completed') RETURNING id");
  if (!r1) return;
  const cid = r1[0].id;
  console.log('Campaign:', cid);

  // Blades + Inspector
  await sleep(1000);
  const blades = await query("SELECT id, position FROM blade WHERE turbine_id = '10000000-0014-4000-8000-000000000014' ORDER BY position");
  const insp0 = await query('SELECT id FROM profiles LIMIT 1');
  const iid = insp0[0].id;
  console.log('Blades:', blades.length, '| Inspector:', iid.slice(0, 8));

  // Inspections
  const inspIds = [];
  for (const b of blades) {
    await sleep(800);
    const r = await query(`INSERT INTO inspection (blade_id, campaign_id, inspector_id, scheduled_date, completed_at, stage, status, photos_count, viewed_percent, inspection_type) VALUES ('${b.id}', '${cid}', '${iid}', '2026-07-15', NOW(), 'finalized', 'completed', 20, 100, 'blades') RETURNING id`);
    inspIds.push({ id: r[0].id, bladeId: b.id, pos: b.position });
    console.log(`  Inspection blade ${b.position}: ${r[0].id}`);
  }

  // Photos (batch per blade)
  const faces = ['leading_edge', 'trailing_edge', 'suction_side', 'pressure_side'];
  for (const { bladeId } of inspIds) {
    await sleep(1000);
    const values = [];
    let ord = 1;
    for (const face of faces) {
      for (let p = 1; p <= 5; p++) {
        values.push(`('${cid}', '${bladeId}', '${face}', ${(p / 5.0).toFixed(2)}, ${ord}, '${cid}/${bladeId}/${face}/${String(ord).padStart(2, '0')}.jpg', '${String(ord).padStart(2, '0')}.jpg', true, '{"seeded":true}'::jsonb)`);
        ord++;
      }
    }
    await query(`INSERT INTO inspection_photo (campaign_id, blade_id, face, radial_position, flight_plan_order, storage_path, filename, analyzed, metadata) VALUES ${values.join(',')}`);
  }
  console.log('✓ 60 photos created');

  // Annotations + Defects
  const types = ['LE EROSION', 'VORTEX (MISSING PANELS)', 'PAINT DAMAGES', 'CRACK', 'OTHER ADD-ONS MISSING'];
  const dbTypes = ['le_erosion', 'vortex', 'paint_defect', 'crack', 'other'];
  const allSides = ['LE', 'SS', 'PS', 'TE', 'LE'];
  const allCats = [3, 3, 4, 3, 4];
  const allRoots = [5.2, 14.8, 22.3, 31.2, 39.7];
  const allNotes = ['Erosion moderada en borde de ataque', 'Vortex ausentes zona media', 'Grieta en trailing edge', 'Add-on proteccion faltante', 'Erosion severa en tip'];

  for (const { id: inspId, bladeId, pos } of inspIds) {
    await sleep(1000);
    const photos = await query(`SELECT id FROM inspection_photo WHERE campaign_id='${cid}' AND blade_id='${bladeId}' ORDER BY flight_plan_order LIMIT 5`);

    for (let i = 0; i < 5; i++) {
      const photoId = photos[i].id;
      const t = types[i];
      const dt = dbTypes[i];
      const s = allSides[i];
      const c = allCats[i];
      const r = allRoots[i];
      const bladeLetter = pos === 1 ? 'A' : pos === 2 ? 'B' : 'C';
      const n = `${allNotes[i]} (Blade ${bladeLetter})`;

      await sleep(500);
      await query(`INSERT INTO annotation (inspection_id, thumbnail_id, x, y, w, h, angle, type, category, note, root_cause, next_step, side) VALUES ('${inspId}', '${photoId}', ${10 + i * 15}, ${(r / 0.43).toFixed(1)}, ${12 + i * 3}, ${10 + i * 2}, 0, '${t}', ${c}, '${n}', 'Causa por inspeccion visual', 'Reparar en proxima parada', '${s}')`);
      await query(`INSERT INTO defect (inspection_id, type, severity, distance_from_root, description, side, width_cm, height_cm) VALUES ('${inspId}', '${dt}', ${c}, ${r}, '${n}', '${s}', ${12 + i * 3}, ${10 + i * 2})`);
    }
    console.log(`  ✓ Blade ${pos}: 5 annotations + 5 defects`);
  }

  console.log('\n✅ Complete inspection created for ADD-T02');
  console.log(`   Campaign: ${cid}`);
  console.log(`   Inspections: ${inspIds.map(i => i.id.slice(0, 8)).join(', ')}`);
  console.log('   15 annotations + 15 defects + 60 photos');
  console.log('   Status: finalized (Report)');
}

main().catch(e => console.error(e));
