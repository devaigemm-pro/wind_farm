/**
 * Opens the defect compare viewer in a new browser tab.
 */
export function openCompare(opts: {
  imageUrl?: string | null;
  date?: string;
  type?: string;
  severity?: number;
  distance?: number;
  side?: string;
  blade?: string;
  bladeId?: string;
  inspectionId?: string;
  annotX?: number;
  annotY?: number;
  annotW?: number;
  annotH?: number;
  annotAngle?: number;
}) {
  const params = new URLSearchParams();
  if (opts.imageUrl) params.set('image', opts.imageUrl);
  if (opts.date) params.set('date', opts.date);
  if (opts.type) params.set('type', opts.type);
  if (opts.severity != null) params.set('severity', String(opts.severity));
  if (opts.distance != null) params.set('distance', String(opts.distance));
  if (opts.side) params.set('side', opts.side);
  if (opts.blade) params.set('blade', opts.blade);
  if (opts.bladeId) params.set('bladeId', opts.bladeId);
  if (opts.inspectionId) params.set('inspectionId', opts.inspectionId);
  if (opts.annotX != null) params.set('ax', String(opts.annotX));
  if (opts.annotY != null) params.set('ay', String(opts.annotY));
  if (opts.annotW != null) params.set('aw', String(opts.annotW));
  if (opts.annotH != null) params.set('ah', String(opts.annotH));
  if (opts.annotAngle != null) params.set('aa', String(opts.annotAngle));

  window.open(`/compare?${params.toString()}`, '_blank');
}
