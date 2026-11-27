-- Comment and recommendation written by the web user on a campaign (today: the
-- hoist certification of one turbine). Printed in that turbine's report.
-- Additive and nullable: existing rows and the mobile app are unaffected.
alter table public.campaign add column if not exists report_comment text;
alter table public.campaign add column if not exists report_recommendation text;

-- Data of the hoist shown in the "detalle de la revisión" of the report:
-- { tag, manufacturer, model, serialNumber, year, condition, ocrAt }.
-- manufacturer/model/serialNumber/year are pre-filled by OCR of the hoist label
-- photo (item prep_etiqueta_polipasto) and can be corrected on the web.
alter table public.campaign add column if not exists hoist_details jsonb;
