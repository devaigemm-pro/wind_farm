/**
 * Order of the photos "selected for the report": the manual drag order first
 * (metadata.report_order), then the photos that were never reordered by
 * captureOrder. Shared by the cleaning / hoist-certification screens and their
 * PDFs so the screen and the report always show the same order.
 */
export function byReportOrder<T extends { reportOrder: number | null; captureOrder: number }>(
  a: T,
  b: T,
): number {
  const ao = a.reportOrder;
  const bo = b.reportOrder;
  if (ao != null && bo != null && ao !== bo) return ao - bo;
  if (ao != null && bo == null) return -1;
  if (ao == null && bo != null) return 1;
  return a.captureOrder - b.captureOrder;
}
