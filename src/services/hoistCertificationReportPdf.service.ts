import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { hoistCertificationService, hoistCondition } from '@/services/hoistCertification.service';
import type {
  HoistDetails,
  HoistLabelPhoto,
  HoistTree,
  HoistItemNode,
  HoistPhoto,
} from '@/services/hoistCertification.service';
import { byReportOrder } from '@/utils/reportOrder';
import { documentManagerSignatureService } from '@/services/document-manager-signature.service';
import { renderManagerSignaturePage } from '@/services/reportSignaturePage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Hoist certification ("Certificación de polipastos") report PDF.
 *
 * MIRRORS cleaningReportPdf.service.ts (cover, general-data table, per-section
 * photo blocks, footers) but groups evidence by STEP / SUB-GROUP / typed ITEM
 * instead of by zone. For every item the report shows its TYPE, its check result
 * (cumple/no cumple), its measurement value, and the photos selected for the
 * report (metadata.selected_for_report).
 */

type JsPDFWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface HoistReportData {
  /** Turbine (child) campaigns to include, in order. */
  campaignIds: string[];
  /** Parent campaign name (multi-turbine report); defaults to the first campaign's name. */
  campaignName?: string;
}

/** Report-level data shared by every turbine of the report. */
interface HoistReportMeta {
  campaignName: string;
  turbines: string[];
  models: string;
  manufacturers: string;
  certifiedCount: number;
  observedCount: number;
}

type RGB = [number, number, number];

interface HoistPdfContext {
  campaignName: string;
  status: string;
  createdAt: string;
  windFarmName: string;
  windFarmLocation: string;
  country: string;
  client: string;
  turbineName: string;
  turbineModel: string;
  manufacturer: string;
  reportedBy: string;
  /** wind_farm.manager_name / manager_role (from DB) — signer on the signature page. */
  managerName: string;
  managerRole: string;
  /** JPEG data URL of the manager's signature (null = blank line). */
  managerSignature: string | null;
  tree: HoistTree;
  /** campaign.report_comment / report_recommendation (free text from the web). */
  comment: string;
  recommendation: string;
  /** campaign.hoist_details (label OCR + manual edits). */
  details: HoistDetails;
  /** First label photo (its upload date = inspection date). */
  labelPhoto: HoistLabelPhoto | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COLOR_PRIMARY = '#5A8F5A';
const COLOR_COVER_BG = '#5A8F5A';
const NA = 'N/A';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function formatDateES(dateStr: string | null | undefined): string {
  if (!dateStr) return NA;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return NA;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

function formatDateShortCL(dateStr: string | null | undefined): string {
  if (!dateStr) return NA;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return NA;
  return d.toLocaleDateString('es-CL');
}

/**
 * Load an image URL as a base64 dataURL, compressing JPEGs via canvas (so the
 * PDF stays small) and keeping PNG/SVG raw. Mirrors cleaningReportPdf's loader.
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const lower = url.toLowerCase().split('?')[0] ?? '';
    if (lower.endsWith('.png') || lower.endsWith('.svg')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }
    return await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 8000);
      const img = new Image();
      const blobUrl = URL.createObjectURL(blob);
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const MAX_W = 1200, MAX_H = 900;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > MAX_W) { h = Math.round(h * (MAX_W / w)); w = MAX_W; }
          if (h > MAX_H) { w = Math.round(w * (MAX_H / h)); h = MAX_H; }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(null); return; }
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          URL.revokeObjectURL(blobUrl);
          resolve(dataUrl);
        } catch {
          URL.revokeObjectURL(blobUrl);
          resolve(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(blobUrl);
        resolve(null);
      };
      img.src = blobUrl;
    });
  } catch {
    return null;
  }
}

// ─── Data fetching ──────────────────────────────────────────────────────────

async function fetchHoistData(campaignId: string): Promise<HoistPdfContext> {
  const { data: campaign, error } = await db
    .from('campaign')
    .select(`
      id, name, status, created_at, report_comment, report_recommendation, hoist_details,
      wind_farm:wind_farm_id ( name, location, manager_name, manager_role, country, client ),
      turbine:turbine_id ( name, model, manufacturer )
    `)
    .eq('id', campaignId)
    .single();
  if (error || !campaign) throw error || new Error('Hoist certification campaign not found');

  const wf = (campaign.wind_farm as Record<string, unknown>) ?? {};
  const turbine = (campaign.turbine as Record<string, unknown>) ?? {};

  // Reuse the SAME tree the UI uses so the report reflects exactly what the web
  // shows (and degrades gracefully to empty items when no data yet).
  const fullTree = await hoistCertificationService.getHoistTree(campaignId);

  // Keep only the photos selected for the report. If NONE are selected across
  // the whole campaign, fall back to ALL photos (same rule as cleaning). Check
  // and measurement STATE is always kept regardless of photo selection.
  const allPhotos: HoistPhoto[] = [];
  // Only photo-capture items carry photos in the report (verification and
  // measurement items show none, even if old photos exist).
  const walk = (it: HoistItemNode) => {
    if (it.itemType === 'photo') allPhotos.push(...it.photos);
  };
  for (const step of fullTree) {
    for (const it of step.items) walk(it);
    for (const g of step.groups) for (const it of g.items) walk(it);
  }
  const anySelected = allPhotos.some((p) => p.hoistSelected);
  const keep = (p: HoistPhoto) => (anySelected ? p.hoistSelected : true);
  const filterItem = (it: HoistItemNode): HoistItemNode => ({
    ...it,
    photos: it.itemType === 'photo' ? it.photos.filter(keep) : [],
  });
  const tree: HoistTree = fullTree.map((step) => ({
    ...step,
    items: step.items.map(filterItem),
    groups: step.groups.map((g) => ({ ...g, items: g.items.map(filterItem) })),
  }));

  // "Informe realizado por" — the authenticated user who generates the PDF.
  let reportedBy = NA;
  try {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id ?? null;
    if (uid) {
      const { data: prof } = await db
        .from('profiles')
        .select('name, last_name')
        .eq('id', uid)
        .single();
      if (prof) {
        const name = [prof.name, prof.last_name].filter(Boolean).join(' ').trim();
        reportedBy = name || NA;
      }
    }
  } catch {
    reportedBy = NA;
  }

  return {
    campaignName: (campaign.name as string) ?? NA,
    status: (campaign.status as string) ?? NA,
    createdAt: (campaign.created_at as string) ?? '',
    windFarmName: (wf.name as string) ?? NA,
    windFarmLocation: (wf.location as string) ?? NA,
    country: (wf.country as string) ?? '',
    client: (wf.client as string) ?? '',
    turbineName: (turbine.name as string) ?? NA,
    turbineModel: (turbine.model as string) ?? NA,
    manufacturer: (turbine.manufacturer as string) ?? '',
    reportedBy,
    managerName: (wf.manager_name as string) ?? '',
    managerRole: (wf.manager_role as string) ?? '',
    managerSignature: await documentManagerSignatureService.getDataUrl(
      (wf.manager_name as string) ?? '',
    ),
    tree,
    comment: ((campaign as Record<string, unknown>).report_comment as string) ?? '',
    recommendation: ((campaign as Record<string, unknown>).report_recommendation as string) ?? '',
    details: ((campaign as Record<string, unknown>).hoist_details as HoistDetails) ?? {},
    labelPhoto: await hoistCertificationService.getLabelPhoto(campaignId),
  };
}

// ─── Renderers ──────────────────────────────────────────────────────────────

/** Cover page (page 1) — "Informe de Certificación de Polipastos". */
async function renderCoverPage(doc: jsPDF, ctx: HoistPdfContext, meta: HoistReportMeta) {
  const pageW = PAGE_WIDTH;
  const pageH = PAGE_HEIGHT;
  const margin = 20;

  // Hero image with a blue overlay baked into a canvas (fallback: solid blue).
  let coverImageLoaded = false;
  try {
    const heroImg = new Image();
    heroImg.crossOrigin = 'anonymous';
    const heroLoaded = await new Promise<boolean>((resolve) => {
      heroImg.onload = () => resolve(true);
      heroImg.onerror = () => resolve(false);
      heroImg.src = '/Portada_polipasto.png';
    });
    if (heroLoaded && heroImg.naturalWidth > 0) {
      // Designed cover (no tint): crop it to the A4 ratio, centered, so it
      // fills the page without stretching.
      const pageRatio = pageW / pageH;
      const imgW = heroImg.naturalWidth;
      const imgH = heroImg.naturalHeight;
      let sw = imgW;
      let sh = imgH;
      if (imgW / imgH > pageRatio) sw = Math.round(imgH * pageRatio);
      else sh = Math.round(imgW / pageRatio);
      const sx = Math.round((imgW - sw) / 2);
      const sy = Math.round((imgH - sh) / 2);
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const cctx = canvas.getContext('2d')!;
      cctx.drawImage(heroImg, sx, sy, sw, sh, 0, 0, sw, sh);
      // Green overlay baked in, same as the repair and inspection covers.
      cctx.fillStyle = 'rgba(90, 143, 90, 0.55)';
      cctx.fillRect(0, 0, sw, sh);
      const coverBase64 = canvas.toDataURL('image/jpeg', 0.92);
      doc.addImage(coverBase64, 'JPEG', 0, 0, pageW, pageH);
      coverImageLoaded = true;
    }
  } catch {
    /* fall through to solid panel */
  }
  if (!coverImageLoaded) {
    const [r, g, b] = hexToRgb(COLOR_COVER_BG);
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageW, pageH * 0.7, 'F');
  }

  // CORE Insight logo top-left.
  try {
    const resp = await fetch('/core-insight-logo.png');
    if (resp.ok) {
      const arrayBuffer = await resp.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const logoBase64 = 'data:image/png;base64,' + btoa(binary);
      // Top-right.
      doc.addImage(logoBase64, 'PNG', pageW - margin - 60, 15, 60, 20);
    }
  } catch {
    /* ignore */
  }

  // Title + park, turbine(s) and date — right-aligned, white, block centered
  // around the middle of the page.
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const titleLines = ['Polipastos de turbina eólica', 'Informe de Certificación'];
  let titleY = pageH * 0.42;
  for (const line of titleLines) {
    doc.text(line, pageW - margin, titleY, { align: 'right' });
    titleY += 11;
  }

  // Subtitles — right-aligned, 14pt white: wind farm, turbine(s), date.
  const dateStr = formatDateShortCL(ctx.createdAt);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  const turbineLine =
    meta.turbines.length === 1
      ? `Turbina: ${meta.turbines[0]}`
      : `${meta.campaignName} · ${meta.turbines.length} turbinas`;
  doc.text(ctx.windFarmName, pageW - margin, titleY + 6, { align: 'right' });
  doc.text(turbineLine, pageW - margin, titleY + 14, { align: 'right' });
  doc.text(dateStr, pageW - margin, titleY + 22, { align: 'right' });

  // Footer — two columns, white text.
  const footerStartY = pageH - 15;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('Generado por', margin + 10, footerStartY);
  doc.text(ctx.reportedBy, margin + 10, footerStartY + 5);
  doc.text('Con tecnología', pageW - margin - 10, footerStartY, { align: 'right' });
  doc.text('CORE Insight', pageW - margin - 10, footerStartY + 5, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

/** All check/measurement items of the tree, in catalog order. */
function resultItems(tree: HoistTree): HoistItemNode[] {
  const out: HoistItemNode[] = [];
  for (const step of tree) {
    const items = [...step.items, ...step.groups.flatMap((g) => g.items)];
    for (const it of items) if (it.itemType !== 'photo') out.push(it);
  }
  return out;
}

/** Brake clearance ranges (mm) of the "verificación holgura de freno" items. */
const BRAKE_RANGES: Record<string, [number, number]> = {
  freno_holgura_020_050: [0.2, 0.5],
  freno_holgura_050_100: [0.5, 1],
};

/**
 * "Detalle de la revisión" — one sheet per turbine, same cell layout as the
 * reference sheet (WTG title, TAG / N° spanning two rows, fecha + condición,
 * fabricante / modelo, serie / fabricación, comentarios, recomendación), then
 * the result of every check/measurement item and one hoist photo in a box.
 */
async function renderRevisionDetail(doc: jsPDF, ctx: HoistPdfContext) {
  doc.addPage();
  const d = ctx.details ?? {};
  const items = resultItems(ctx.tree);
  const condition = hoistCondition(d, items.some((it) => it.itemType === 'check' && it.passed === false));
  const conditionLabel = condition === 'certificado' ? 'CERTIFICADO' : 'CERTIFICADO CON OBSERVACIONES';
  const LIGHT_GREEN: RGB = [146, 208, 80];
  const DARK_GREEN: RGB = [0, 176, 80];
  const conditionFill: RGB = condition === 'certificado' ? LIGHT_GREEN : [255, 192, 0];
  const val = (v: string | null | undefined) => (v && String(v).trim()) || '';
  const W = PAGE_WIDTH - 2 * MARGIN;
  const BORDER = { lineColor: [0, 0, 0] as RGB, lineWidth: 0.3 };
  const label = { fontStyle: 'bold' as const };

  // Photo-capture items go in the sheet, one row each (title + photos), before
  // COMENTARIOS. Up to 3 report photos per item, side by side.
  const PHOTO_ROW_H = 40;
  const photoItems = ctx.tree.flatMap((st) => [...st.items, ...st.groups.flatMap((g) => g.items)])
    .filter((it) => it.itemType === 'photo');
  const photoImgs: { data: string; w: number; h: number }[][] = [];
  for (const it of photoItems) {
    const imgs: { data: string; w: number; h: number }[] = [];
    for (const ph of [...it.photos].sort(byReportOrder).slice(0, 3)) {
      const data = await loadImageAsBase64(ph.url);
      if (!data) continue;
      try {
        const pr = doc.getImageProperties(data);
        imgs.push({ data, w: pr.width, h: pr.height });
      } catch {
        /* skip broken image */
      }
    }
    photoImgs.push(imgs);
  }
  const PHOTO_ROW0 = 5; // rows before the photo rows: title, tag×2, fabricante, serie
  const photoRows = photoItems.map((it) => [
    { content: it.itemLabel.toUpperCase(), styles: { ...label, valign: 'middle' as const } },
    { content: '', colSpan: 3, styles: { minCellHeight: PHOTO_ROW_H } },
  ]);

  autoTable(doc, {
    startY: 14,
    theme: 'plain',
    body: [
      [{ content: `WTG ${ctx.turbineName}`, colSpan: 4, styles: { fillColor: LIGHT_GREEN, fontStyle: 'bold', fontSize: 13, halign: 'center' } }],
      [
        { content: 'TAG', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 14, halign: 'center', valign: 'middle' } },
        { content: val(d.tag), rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 14, halign: 'center', valign: 'middle' } },
        { content: 'FECHA INSPECCIÓN', styles: label },
        { content: ctx.labelPhoto?.uploadedAt ? formatDateES(ctx.labelPhoto.uploadedAt).replace(/\//g, '-') : '' },
      ],
      [
        { content: 'CONDICIÓN', styles: label },
        { content: conditionLabel, styles: { fillColor: conditionFill, fontStyle: 'bold', halign: 'center' } },
      ],
      [
        { content: 'FABRICANTE', styles: label },
        val(d.manufacturer),
        { content: 'MODELO', styles: label },
        val(d.model),
      ],
      [
        { content: 'NÚMERO SERIE', styles: label },
        val(d.serialNumber),
        { content: 'FABRICACIÓN', styles: label },
        val(d.year),
      ],
      ...photoRows,
      [{ content: 'COMENTARIOS', styles: label }, { content: val(ctx.comment), colSpan: 3 }],
      [{ content: 'RECOMENDACIÓN', styles: label }, { content: val(ctx.recommendation), colSpan: 3, styles: { minCellHeight: 12 } }],
    ],
    styles: { fontSize: 10, cellPadding: 1.4, textColor: [0, 0, 0], ...BORDER },
    columnStyles: {
      0: { cellWidth: W * 0.32 },
      1: { cellWidth: W * 0.17 },
      2: { cellWidth: W * 0.24 },
      3: { cellWidth: W * 0.27 },
    },
    margin: { left: MARGIN, right: MARGIN, top: 14, bottom: 20 },
    didDrawCell: (hook) => {
      if (hook.section !== 'body' || hook.column.index !== 1) return;
      const imgs = photoImgs[hook.row.index - PHOTO_ROW0];
      if (!imgs || imgs.length === 0) return;
      const pad = 2;
      const gap = 3;
      const cellW = hook.cell.width - 2 * pad;
      const cellH = hook.cell.height - 2 * pad;
      const slotW = (cellW - gap * (imgs.length - 1)) / imgs.length;
      imgs.forEach((im, i) => {
        const scale = Math.min(slotW / im.w, cellH / im.h);
        const w = im.w * scale;
        const h = im.h * scale;
        const x = hook.cell.x + pad + i * (slotW + gap) + (slotW - w) / 2;
        const y = hook.cell.y + pad + (cellH - h) / 2;
        try {
          doc.addImage(im.data, 'JPEG', x, y, w, h);
        } catch {
          /* skip broken image */
        }
      });
    },
  });

  const result = (it: HoistItemNode): string => {
    if (it.itemType === 'measurement') {
      if (it.measurementValue === null || it.measurementValue === '') return '—';
      const v = `${it.measurementValue}${it.measurementUnit ? ' ' + it.measurementUnit : ''}`;
      const range = BRAKE_RANGES[it.itemCode];
      const n = parseFloat(String(it.measurementValue).replace(',', '.'));
      if (range && !isNaN(n)) return `${v} / ${n >= range[0] && n <= range[1] ? 'OK' : 'NO OK'}`;
      return v;
    }
    if (it.passed === true) return 'OK';
    if (it.passed === false) return 'NO CUMPLE';
    return '—';
  };

  const y0 = ((doc as JsPDFWithAutoTable).lastAutoTable?.finalY ?? 60) + 3;
  autoTable(doc, {
    startY: y0,
    theme: 'plain',
    body: items.map((it) => [it.itemLabel, result(it)]),
    styles: { fontSize: 8.5, cellPadding: 1.1, textColor: [0, 0, 0], ...BORDER },
    columnStyles: {
      0: { cellWidth: W * 0.77 },
      1: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: MARGIN, right: MARGIN, top: 14, bottom: 20 },
    didParseCell: (hook) => {
      if (hook.section !== 'body' || hook.column.index !== 1) return;
      const it = items[hook.row.index];
      if (!it) return;
      if (it.itemType === 'measurement' && !BRAKE_RANGES[it.itemCode] && result(it) !== '—') {
        hook.cell.styles.fillColor = DARK_GREEN;
      } else if (it.itemType === 'check' && it.passed === false) {
        hook.cell.styles.fillColor = [255, 199, 206];
      }
    },
  });
  // Photos are only inside the sheet (photo-item rows); none below the table.
}

/** A run of text with its style (rich paragraph). */
interface Run {
  text: string;
  bold?: boolean;
  underline?: boolean;
}

/**
 * Draw a rich paragraph (bold / underlined runs) wrapped to `width`, justified
 * except its last line. Returns the y below the paragraph.
 */
function drawRichParagraph(
  doc: jsPDF,
  runs: Run[],
  x: number,
  y: number,
  width: number,
  size = 11,
  lineH = 5.3,
): number {
  type Frag = { text: string; bold: boolean; underline: boolean; w: number };
  const measure = (t: string, bold: boolean) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    return doc.getTextWidth(t);
  };
  // Words = fragments with no whitespace between them (a word can mix styles).
  const words: Frag[][] = [];
  let cur: Frag[] = [];
  for (const r of runs) {
    for (const piece of r.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        if (cur.length) words.push(cur);
        cur = [];
        continue;
      }
      cur.push({ text: piece, bold: !!r.bold, underline: !!r.underline, w: measure(piece, !!r.bold) });
    }
  }
  if (cur.length) words.push(cur);
  const wordW = (w: Frag[]) => w.reduce((acc, f) => acc + f.w, 0);
  const space = measure(' ', false);

  const lines: Frag[][][] = [];
  let line: Frag[][] = [];
  let lineW = 0;
  for (const w of words) {
    const ww = wordW(w);
    if (line.length && lineW + space + ww > width) {
      lines.push(line);
      line = [];
      lineW = 0;
    }
    lineW += (line.length ? space : 0) + ww;
    line.push(w);
  }
  if (line.length) lines.push(line);

  doc.setLineWidth(0.25);
  doc.setDrawColor(0, 0, 0);
  lines.forEach((ln, li) => {
    const last = li === lines.length - 1;
    const total = ln.reduce((acc, w) => acc + wordW(w), 0);
    const gap = !last && ln.length > 1 ? (width - total) / (ln.length - 1) : space;
    let cx = x;
    ln.forEach((w, wi) => {
      for (const f of w) {
        doc.setFont('helvetica', f.bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.text(f.text, cx, y);
        if (f.underline) doc.line(cx, y + 0.9, cx + f.w, y + 0.9);
        cx += f.w;
      }
      const next = ln[wi + 1];
      // Underline continues across the space between two underlined words.
      if (next && w[w.length - 1]!.underline && next[0]!.underline) {
        doc.line(cx, y + 0.9, cx + gap, y + 0.9);
      }
      cx += gap;
    });
    y += lineH;
  });
  return y;
}

/**
 * Page 2: "EQUIPOS CERTIFICADOS Y EQUIPOS CERTIFICADOS CON OBSERVACIONES" —
 * the text given by the user (docs/informe-polipastos-pagina2.md). Dynamic: the
 * number of certified hoists and of hoists certified with observations.
 */
function renderCertifiedSummary(doc: jsPDF, meta: HoistReportMeta) {
  doc.addPage();
  const W = PAGE_WIDTH - 2 * MARGIN - 6;
  const X = MARGIN + 3;
  const nn = (n: number) => String(n).padStart(2, '0');
  const BU = (text: string): Run => ({ text, bold: true, underline: true });
  const B = (text: string): Run => ({ text, bold: true });
  const N = (text: string): Run => ({ text });
  const lubrication: Run[] = [
    N('Mantener limpia y lubricada la cadena de carga. La falta de lubricación acelera el desgate en eslabones de cadena, generara una condición insegura de trabajo y desgaste en nuez de carga de tecle y gancho.'),
  ];
  const nominal: Run[] = [
    N('Realizar maniobras solo con cargas iguales o inferior a la carga nominal recomendada por el fabricante, esto es '),
    BU('800 kilos'),
    N('.'),
  ];
  const angle: Run[] = [N('No realizar maniobras con carga en un ángulo superior a 15°.')];

  let y = 26;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const title = doc.splitTextToSize('EQUIPOS CERTIFICADOS Y EQUIPOS CERTIFICADOS CON OBSERVACIONES', W - 20) as string[];
  doc.text(title, PAGE_WIDTH / 2, y, { align: 'center' });
  y += title.length * 6.5 + 12;

  const heading = (text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(text, X, y);
    y += 8;
  };
  const bullets = (list: Run[][]) => {
    for (const b of list) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text('•', X + 6, y);
      y = drawRichParagraph(doc, b, X + 13, y, W - 13);
    }
    y += 3;
  };

  y = drawRichParagraph(doc, [
    N('Terminado el proceso de Inspección y certificación de Polipastos, se determinó que '),
    BU(`${nn(meta.certifiedCount)} polipastos pasaron la inspección de manera satisfactoria`),
    N('. Las unidades catalogadas como “'),
    B('CERTIFICADOS'),
    N('” se entenderán “'),
    B('APTOS'),
    N('” para realizar maniobras hasta su próxima revisión contado un año desde la fecha de revisión, indicada en TAG.'),
  ], X, y, W);
  y += 3;
  heading('Recomendaciones generales para unidades certificadas');
  bullets([lubrication, nominal, angle]);

  y = drawRichParagraph(doc, [
    N('De igual forma, terminado el proceso de Inspección y certificación de Polipastos, se determinó que '),
    BU(`${nn(meta.observedCount)} polipastos pasaron la inspección, pero mantienen observaciones`),
    N('. Las unidades catalogadas como “'),
    B('CERTIFICADO CON OBSERVACIONES'),
    N('” se entenderán “'),
    B('APTOS'),
    N('” para realizar maniobras hasta su próxima revisión contado un año desde la fecha de revisión, indicada en TAG, sin embargo, se deberán atender y considerar las observaciones o recomendaciones realizadas.'),
  ], X, y, W);
  y += 3;
  heading('Recomendaciones generales para unidades certificadas con observaciones');
  bullets([[N('Atender y considerar las observaciones o recomendaciones realizadas.')], lubrication, nominal, angle]);
}

function addFooters(doc: jsPDF, windFarmName: string) {
  const totalPages = doc.getNumberOfPages();
  const footMargin = 20;
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(footMargin, PAGE_HEIGHT - 16, PAGE_WIDTH - footMargin, PAGE_HEIGHT - 16);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(windFarmName, footMargin, PAGE_HEIGHT - 10);
    doc.text(`${i}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });
    doc.text('CORE Insight', PAGE_WIDTH - footMargin, PAGE_HEIGHT - 10, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate and download the hoist-certification report PDF, grouped by
 * step/sub-group, showing each item's type + check result + measurement value,
 * and using only the photos selected for the report. Mirrors
 * generateAndDownloadCleaningReport.
 */
export async function generateAndDownloadHoistCertificationReport(
  data: HoistReportData,
): Promise<{ blob: Blob; filename: string }> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
  }

  if (data.campaignIds.length === 0) throw new Error('No hay turbinas para el informe.');

  // Turbine contexts, a few at a time (each one reads its tree and photos).
  const ctxs: HoistPdfContext[] = [];
  for (let i = 0; i < data.campaignIds.length; i += 4) {
    const batch = data.campaignIds.slice(i, i + 4);
    ctxs.push(...(await Promise.all(batch.map((id) => fetchHoistData(id)))));
  }
  ctxs.sort((a, b) => a.turbineName.localeCompare(b.turbineName, 'es', { numeric: true }));
  const first = ctxs[0]!;
  const multi = ctxs.length > 1;
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter((x) => x && x !== NA))].join(', ');
  const isObserved = (c: HoistPdfContext) =>
    hoistCondition(c.details, resultItems(c.tree).some((it) => it.itemType === 'check' && it.passed === false)) !==
    'certificado';
  const observedCount = ctxs.filter(isObserved).length;
  const meta: HoistReportMeta = {
    campaignName: data.campaignName || first.campaignName,
    turbines: ctxs.map((c) => c.turbineName),
    models: uniq(ctxs.map((c) => c.turbineModel)),
    manufacturers: uniq(ctxs.map((c) => c.manufacturer)),
    certifiedCount: ctxs.length - observedCount,
    observedCount,
  };

  const doc = new jsPDF('p', 'mm', 'a4');

  // 1. Cover page.
  await renderCoverPage(doc, first, meta);
  // 2. Certified / certified-with-observations summary.
  renderCertifiedSummary(doc, meta);
  // 3. General data.
  // (General data page removed from this report.)
  // 4. Per turbine: revision detail sheet, then its report photos.
  for (const ctx of ctxs) {
    // Photos of photo-capture items are inside the sheet (no separate photo pages).
    await renderRevisionDetail(doc, ctx);
  }
  // 5. Signature + legal page (same as the repair report).
  renderManagerSignaturePage(doc, {
    windFarmName: first.windFarmName,
    purpose: 'Certificación de polipastos de turbina eólica',
    managerName: first.managerName,
    managerRole: first.managerRole,
    managerSignature: first.managerSignature,
    titleColor: hexToRgb(COLOR_PRIMARY),
  });

  // 6. Footers.
  addFooters(doc, first.windFarmName);

  const dateStr = formatDateES(first.createdAt).replace(/\//g, '-');
  const subject = multi ? meta.campaignName : first.turbineName;
  const filename = `Informe_Certificacion_Polipastos_${subject}_${dateStr}.pdf`.replace(/[\s/\\]+/g, '_');

  const blob = doc.output('blob') as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { blob, filename };
}
