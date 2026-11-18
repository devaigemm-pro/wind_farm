/**
 * Friendly names for the tables listed in the "delete wind farm" confirmation
 * (delete_wind_farm_cascade returns row counts keyed by table name). Tables not
 * listed here (e.g. new ones added by the mobile team) are shown by their raw
 * table name, so the dialog never hides something that will be deleted.
 */
const LABELS: Record<string, { es: string; en: string }> = {
  turbine: { es: 'Turbinas', en: 'Turbines' },
  blade: { es: 'Palas', en: 'Blades' },
  inspection: { es: 'Inspecciones', en: 'Inspections' },
  campaign: { es: 'Campañas', en: 'Campaigns' },
  defect: { es: 'Defectos', en: 'Defects' },
  defect_comment: { es: 'Comentarios de defectos', en: 'Defect comments' },
  defect_image: { es: 'Imágenes de defectos', en: 'Defect images' },
  defect_import: { es: 'Importaciones de defectos', en: 'Defect imports' },
  defect_import_row: { es: 'Filas de importación', en: 'Import rows' },
  annotation: { es: 'Anotaciones', en: 'Annotations' },
  annotation_comment: { es: 'Comentarios de anotaciones', en: 'Annotation comments' },
  evidence: { es: 'Evidencias', en: 'Evidence' },
  report: { es: 'Informes', en: 'Reports' },
  asset_document: { es: 'Documentos', en: 'Documents' },
  quote: { es: 'Cotizaciones', en: 'Quotes' },
  quote_item: { es: 'Ítems de cotización', en: 'Quote items' },
  work_order: { es: 'Órdenes de trabajo', en: 'Work orders' },
  repair: { es: 'Reparaciones', en: 'Repairs' },
  repair_stage: { es: 'Etapas de reparación', en: 'Repair stages' },
  repair_photo: { es: 'Fotos de reparación', en: 'Repair photos' },
  cleaning_zone: { es: 'Zonas de limpieza', en: 'Cleaning zones' },
  cleaning_photo: { es: 'Fotos de limpieza', en: 'Cleaning photos' },
  hoist_cert_item: { es: 'Ítems de certificación de polipasto', en: 'Hoist certification items' },
  hoist_cert_photo: { es: 'Fotos de certificación de polipasto', en: 'Hoist certification photos' },
  inspection_photo: { es: 'Fotos de inspección', en: 'Inspection photos' },
  wind_farm_user: { es: 'Asignaciones de usuarios', en: 'User assignments' },
};

export function getDeletionLabel(table: string, locale: 'es' | 'en'): string {
  return LABELS[table]?.[locale] ?? table;
}
