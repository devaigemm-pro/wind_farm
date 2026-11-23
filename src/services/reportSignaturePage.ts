import type { jsPDF } from 'jspdf';
/**
 * Signature + legal ("Derechos de informe") page appended at the end of the
 * cleaning and hoist-certification reports. Same layout and text as the repair
 * report's renderSignaturePage (repairReportPdf.service.ts); only the
 * "finalidad" (purpose) changes per report type.
 */
const PAGE_WIDTH = 210;
const MARGIN = 14;
export interface SignaturePageInput {
  windFarmName: string;
  /** e.g. "Limpieza de turbina eólica" — rendered as "{purpose} en Proyecto Eólico {windFarmName}". */
  purpose: string;
  managerName: string;
  managerRole: string;
  /** JPEG data URL of the manager's signature (null = blank line). */
  managerSignature: string | null;
  /** Section title color (RGB), matches the report's primary color. */
  titleColor: [number, number, number];
}
export function renderManagerSignaturePage(doc: jsPDF, ctx: SignaturePageInput) {
  doc.addPage();
  doc.setTextColor(...ctx.titleColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Derechos de informe:', MARGIN, 30);
  let y = 30 + 8 + 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  const legal =
    `\u201CEl cliente reconoce los derechos de Propiedad Intelectual del prestador sobre todo el ` +
    `desarrollo intelectual del reporte técnico suministrado, tanto el objeto final del mismo como el ` +
    `conjunto de documentos, diagramas, fotos, tablas, esquemas y demás elementos previos que lo ` +
    `conforman. El prestador cede su desarrollo únicamente para su uso personal físico o jurídico, sin ` +
    `exclusividad, por un tiempo determinado y únicamente para llevar a cabo la siguiente finalidad ` +
    `\u201C${ctx.purpose} en Proyecto Eólico ${ctx.windFarmName}\u201D, no quedando ` +
    `permitida en ningún caso su reproducción, cesión, venta, alquiler o préstamo, comprometiéndose el ` +
    `usuario, a título enunciativo y no limitativo, a no ceder su uso parcial o total de ninguna forma, ` +
    `así como a no divulgarlo, publicarlo, ni ponerlo de ninguna otra manera a disposición de otras ` +
    `personas. El prestador garantiza al cliente que el desarrollo es absolutamente original y que ` +
    `cuenta con la totalidad de los derechos de propiedad intelectual sobre el mismo, habiendo sido ` +
    `completamente desarrollado por el prestador. Por lo que se puede garantizar que éste y las ` +
    `herramientas con las que ha sido realizado no vulneran ninguna normativa, contrato, derecho, ` +
    `interés o propiedad de terceros.\u201D`;
  const legalLines = doc.splitTextToSize(legal, PAGE_WIDTH - 2 * MARGIN);
  doc.text(legalLines, MARGIN, y, { align: 'justify', maxWidth: PAGE_WIDTH - 2 * MARGIN });
  y += legalLines.length * 5 + 40;
  const lineW = 90;
  if (ctx.managerSignature) {
    try {
      const maxH = 34;
      const props = doc.getImageProperties(ctx.managerSignature);
      const ratio = props.width / props.height;
      let w = lineW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      doc.addImage(ctx.managerSignature, 'JPEG', MARGIN, y - 2 - h, w, h);
    } catch {
      /* unreadable image → leave the line blank */
    }
  }
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, MARGIN + lineW, y);
  y += 6;
  if (ctx.managerName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(ctx.managerName, MARGIN, y);
    y += 5;
  }
  if (ctx.managerRole) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(ctx.managerRole.toUpperCase(), MARGIN, y);
  }
  doc.setTextColor(0, 0, 0);
}
