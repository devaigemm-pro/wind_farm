-- Backfill demo: migrate the 20 demo photos from inspection_photo into the new
-- repair / repair_stage / repair_photo model, so the repair viewer shows them.
-- Idempotent: cleans previously backfilled demo repairs for these work orders.

DO $$
DECLARE
  v_repair_id uuid;
  v_wo record;
  v_stage record;
  v_stage_id uuid;
  v_old_to_new jsonb := '{
    "label":"etiqueta",
    "failure_analysis":"analisis_falla",
    "sanding":"saneado",
    "lamination":"laminacion",
    "vacuum_system":"sistema_vacio",
    "thermal_blanket":"manta_termica",
    "lamination_result":"resultado_laminacion",
    "surface_post_lamination":"ajuste_post_laminado",
    "filler_application":"aplicacion_filler",
    "surface_post_filler":"ajuste_post_filler",
    "paint_first_coat":"pintura_primera_mano"
  }'::jsonb;
  v_new_code text;
  v_cat record;
  v_photo record;
  v_order int;
BEGIN
  -- Iterate the two work orders of the approved quote for FDM-T02.
  FOR v_wo IN
    SELECT id AS work_order_id, defect_id, turbine_id
    FROM work_order
    WHERE quote_id = '672c9990-e57b-4738-8955-f0fbabee04b6'
  LOOP
    -- Clean any prior backfill for this work order.
    DELETE FROM repair_photo WHERE repair_id IN (SELECT id FROM repair WHERE work_order_id = v_wo.work_order_id);
    DELETE FROM repair_stage WHERE repair_id IN (SELECT id FROM repair WHERE work_order_id = v_wo.work_order_id);
    DELETE FROM repair WHERE work_order_id = v_wo.work_order_id;

    -- Create the repair session.
    INSERT INTO repair (work_order_id, defect_id, turbine_id, status, current_stage, started_at)
    VALUES (v_wo.work_order_id, v_wo.defect_id, v_wo.turbine_id, 'completed', 'pintura_primera_mano', NOW())
    RETURNING id INTO v_repair_id;

    -- Create the 11 stages from the catalog.
    FOR v_cat IN SELECT code, label, sort_order FROM repair_stage_catalog ORDER BY sort_order LOOP
      INSERT INTO repair_stage (repair_id, stage_code, stage_label, sort_order, status)
      VALUES (v_repair_id, v_cat.code, v_cat.label, v_cat.sort_order, 'done')
      RETURNING id INTO v_stage_id;

      -- Move demo photos of this defect+old-stage into repair_photo under the new stage.
      v_order := 0;
      FOR v_photo IN
        SELECT ip.id, ip.storage_path, ip.filename
        FROM inspection_photo ip
        WHERE ip.campaign_id = 'd08b1960-fe39-41e5-96ba-4814af03052e'
          AND ip.defect_id = v_wo.defect_id
          AND (v_old_to_new ->> ip.repair_stage) = v_cat.code
        ORDER BY ip.filename
      LOOP
        v_order := v_order + 1;
        INSERT INTO repair_photo (repair_id, repair_stage_id, stage_code, storage_path, filename, capture_order, captured_at, uploaded_at, metadata)
        VALUES (v_repair_id, v_stage_id, v_cat.code, v_photo.storage_path, v_photo.filename, v_order, NOW(), NOW(), '{"selected_for_report": true}'::jsonb);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
