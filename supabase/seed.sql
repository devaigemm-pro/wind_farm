-- ─────────────────────────────────────────────────────────────────────────────
-- LOCAL SEED — test data for development (Supabase local / Docker).
-- Runs after the prod schema is loaded. Safe to re-run: it clears and reinserts
-- the demo rows. NEVER run against production.
--
-- Creates: 1 wind farm + 1 turbine (3 blades) + 1 inspection with defects, and
-- one campaign of each type (repair / cleaning / hoist_certification) wired to
-- the turbine, each with a few photos / items so the workflows are usable.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_user     uuid;
  v_wf       uuid;
  v_turbine  uuid;
  v_blade_a  uuid;
  v_insp     uuid;
  v_def1     uuid;
  v_def2     uuid;
  -- repair chain
  v_quote_r  uuid;
  v_wo1      uuid;
  v_wo2      uuid;
  v_rep1     uuid;
  v_rep2     uuid;
  v_stage    uuid;
  -- campaigns
  v_camp_rep uuid;
  v_camp_cln uuid;
  v_camp_hoi uuid;
begin
  -- Clean previous demo rows (idempotent). Delete children before parents so we
  -- don't leave orphans if FKs aren't ON DELETE CASCADE.
  delete from cleaning_photo   where campaign_id in (select id from campaign where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local'));
  delete from hoist_cert_photo where campaign_id in (select id from campaign where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local'));
  delete from hoist_cert_item  where campaign_id in (select id from campaign where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local'));
  delete from repair_photo r   where r.repair_id in (select rp.id from repair rp join work_order wo on wo.id=rp.work_order_id where wo.wind_farm_id in (select id from wind_farm where name = 'PE Demo Local'));
  delete from repair_stage rs  where rs.repair_id in (select rp.id from repair rp join work_order wo on wo.id=rp.work_order_id where wo.wind_farm_id in (select id from wind_farm where name = 'PE Demo Local'));
  delete from repair          where work_order_id in (select id from work_order where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local'));
  delete from work_order      where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local');
  delete from campaign        where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local');
  delete from quote           where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local');
  delete from defect          where inspection_id in (select i.id from inspection i join blade b on b.id=i.blade_id join turbine t on t.id=b.turbine_id where t.wind_farm_id in (select id from wind_farm where name = 'PE Demo Local'));
  delete from inspection      where turbine_id in (select id from turbine where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local'));
  delete from blade           where turbine_id in (select id from turbine where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local'));
  delete from turbine         where wind_farm_id in (select id from wind_farm where name = 'PE Demo Local');
  delete from wind_farm       where name = 'PE Demo Local';

  -- Reuse an existing profile if any; otherwise leave user refs NULL (profiles.id
  -- has a FK to auth.users, so we can't fabricate one in a plain SQL seed).
  select id into v_user from profiles limit 1;  -- may be NULL

  -- Wind farm + turbine + blades.
  insert into wind_farm (name, location) values ('PE Demo Local', 'Región Demo, Chile')
    returning id into v_wf;
  insert into turbine (wind_farm_id, name, model, serial_number, power_kw, powering_date)
    values (v_wf, 'WTG-DEMO-01', 'Gamesa G114', 'SN-DEMO-01', 2000, now() - interval '3 years')
    returning id into v_turbine;
  -- Blades are auto-created by the trigger `on_turbine_created`
  -- (create_blades_for_turbine) when the turbine is inserted. Read blade A
  -- (position 1) instead of inserting it, and give it a demo serial.
  select id into v_blade_a from blade where turbine_id = v_turbine and position = 1;
  update blade set serial_number = 'BLADE-A-DEMO' where id = v_blade_a;
  update blade set serial_number = 'BLADE-B-DEMO' where turbine_id = v_turbine and position = 2;
  update blade set serial_number = 'BLADE-C-DEMO' where turbine_id = v_turbine and position = 3;

  -- Inspection (finalized) with 2 defects on blade A.
  insert into inspection (blade_id, inspector_id, status, stage, scheduled_date, completed_at,
                          inspection_type, turbine_id, vertical_blade, notes)
    values (v_blade_a, v_user, 'completed', 'report', current_date - 20, now() - interval '18 days',
            'blades', v_turbine, 'A', 'Inspección demo local')
    returning id into v_insp;

  insert into defect (inspection_id, type, severity, distance_from_root, side, width_cm, height_cm,
                      defect_number, defect_identifier, description)
    values (v_insp, 'crack', 3, 12.5, 'LE', 4.0, 2.0, 'A1', 'Daño 1', 'Grieta demo en LE')
    returning id into v_def1;
  insert into defect (inspection_id, type, severity, distance_from_root, side, width_cm, height_cm,
                      defect_number, defect_identifier, description)
    values (v_insp, 'le_erosion', 2, 25.0, 'TE', 6.0, 3.0, 'A2', 'Daño 2', 'Erosión demo en TE')
    returning id into v_def2;

  -- ── REPAIR campaign (quote → work_orders → repairs → stage → photos) ────────
  insert into quote (turbine_id, wind_farm_id, requested_by, status, currency,
                     quoted_by, quoted_at, approved_by, approved_at, total_amount)
    values (v_turbine, v_wf, v_user, 'approved', 'CLP', v_user, now(), v_user, now(), 0)
    returning id into v_quote_r;

  insert into campaign (name, wind_farm_id, turbine_id, quote_id, type, status, created_by)
    values ('CI-DEMO - WTG-DEMO-01 - Reparación', v_wf, v_turbine, v_quote_r,
            'repair', 'repair_in_progress', v_user)
    returning id into v_camp_rep;

  insert into work_order (quote_id, defect_id, turbine_id, wind_farm_id, blade_side, status)
    values (v_quote_r, v_def1, v_turbine, v_wf, 'LE', 'in_progress') returning id into v_wo1;
  insert into work_order (quote_id, defect_id, turbine_id, wind_farm_id, blade_side, status)
    values (v_quote_r, v_def2, v_turbine, v_wf, 'TE', 'in_progress') returning id into v_wo2;

  insert into repair (work_order_id, defect_id, turbine_id, status, start_category, progress_percent)
    values (v_wo1, v_def1, v_turbine, 'in_progress', 3, 40) returning id into v_rep1;
  insert into repair (work_order_id, defect_id, turbine_id, status, start_category, progress_percent)
    values (v_wo2, v_def2, v_turbine, 'completed', 2, 100) returning id into v_rep2;

  -- One stage + two photos on the first repair so the workflow shows content.
  insert into repair_stage (repair_id, stage_code, stage_label, sort_order, status, optional, enabled)
    values (v_rep1, 'etiqueta', 'Etiqueta', 1, 'completed', false, true) returning id into v_stage;
  insert into repair_photo (repair_id, repair_stage_id, stage_code, storage_path, filename, capture_order, metadata)
    values (v_rep1, v_stage, 'etiqueta', 'repairs/demo/etiqueta/IMG_0001.jpg', 'IMG_0001.jpg', 1, '{"selected_for_report": true}'::jsonb);
  insert into repair_photo (repair_id, repair_stage_id, stage_code, storage_path, filename, capture_order, metadata)
    values (v_rep1, v_stage, 'etiqueta', 'repairs/demo/etiqueta/IMG_0002.jpg', 'IMG_0002.jpg', 2, '{}'::jsonb);

  -- ── CLEANING campaign (zones + photos) ──────────────────────────────────────
  insert into campaign (name, wind_farm_id, turbine_id, type, status, created_by)
    values ('Limpieza Demo - WTG-DEMO-01', v_wf, v_turbine, 'cleaning', 'cleaning_in_progress', v_user)
    returning id into v_camp_cln;
  insert into cleaning_photo (campaign_id, zone_code, storage_path, filename, capture_order, metadata)
    values (v_camp_cln, 'palas_a', 'cleaning/demo/palas_a/IMG_0001.jpg', 'IMG_0001.jpg', 1, '{"selected_for_report": true}'::jsonb);
  insert into cleaning_photo (campaign_id, zone_code, storage_path, filename, capture_order, metadata)
    values (v_camp_cln, 'nacelle_superior', 'cleaning/demo/nacelle_superior/IMG_0002.jpg', 'IMG_0002.jpg', 1, '{}'::jsonb);
  insert into cleaning_photo (campaign_id, zone_code, storage_path, filename, capture_order, metadata)
    values (v_camp_cln, 'torre', 'cleaning/demo/torre/IMG_0003.jpg', 'IMG_0003.jpg', 1, '{}'::jsonb);

  -- ── HOIST CERTIFICATION campaign (typed items + photos) ─────────────────────
  insert into campaign (name, wind_farm_id, turbine_id, type, status, created_by)
    values ('Certificación Polipastos Demo - WTG-DEMO-01', v_wf, v_turbine, 'hoist_certification', 'hoist_in_progress', v_user)
    returning id into v_camp_hoi;
  insert into hoist_cert_item (campaign_id, item_code, item_type, metadata)
    values (v_camp_hoi, 'prep_viento', 'photo', '{}'::jsonb);
  insert into hoist_cert_item (campaign_id, item_code, item_type, passed)
    values (v_camp_hoi, 'visual_goma_plastico', 'check', true);
  insert into hoist_cert_item (campaign_id, item_code, item_type, measurement_value, measurement_unit)
    values (v_camp_hoi, 'cadena_espesor', 'measurement', '12', '%');
  insert into hoist_cert_photo (campaign_id, item_code, storage_path, filename, capture_order, metadata)
    values (v_camp_hoi, 'prep_viento', 'hoist/demo/prep_viento/IMG_0001.jpg', 'IMG_0001.jpg', 1, '{"selected_for_report": true}'::jsonb);

  raise notice 'Seed demo local completado: wf=% turbine=% repair=% cleaning=% hoist=%',
    v_wf, v_turbine, v_camp_rep, v_camp_cln, v_camp_hoi;
end $$;
