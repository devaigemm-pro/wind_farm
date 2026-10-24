import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { hoistCertificationService } from '@/services/hoistCertification.service';
import type {
  HoistTree,
  HoistStepNode,
  HoistItemNode,
  HoistPhoto,
} from '@/services/hoistCertification.service';
import { getHoistLabel } from '@/constants/hoist-certification-steps';

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
  campaignId: string;
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
  tree: HoistTree;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COLOR_PRIMARY = '#5A8F5A';
const COLOR_COVER_BG = '#5A8F5A';
const COLOR_HEADER_TABLE: RGB = [90, 143, 90];
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

/** Localized item-type label for the report tables. */
function itemTypeLabel(type: HoistItemNode['itemType']): string {
  if (type === 'check') return 'Verificación';
  if (type === 'measurement') return 'Medición';
  return 'Foto';
}

/** Localized check result for the report ("Cumple" / "No cumple" / "Sin dato"). */
function checkResultLabel(item: HoistItemNode): string {
  if (item.itemType !== 'check') return '—';
  if (item.passed === true) return 'Cumple';
  if (item.passed === false) return 'No cumple';
  return 'Sin dato';
}

/** Localized measurement value for the report (value + optional unit). */
function measurementLabel(item: HoistItemNode): string {
  if (item.itemType !== 'measurement') return '—';
  if (item.measurementValue === null || item.measurementValue === '') return 'Sin dato';
  return `${item.measurementValue}${item.measurementUnit ? ' ' + item.measurementUnit : ''}`;
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
      id, name, status, created_at,
      wind_farm:wind_farm_id ( name, location, country, client ),
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
  const walk = (it: HoistItemNode) => allPhotos.push(...it.photos);
  for (const step of fullTree) {
    for (const it of step.items) walk(it);
    for (const g of step.groups) for (const it of g.items) walk(it);
  }
  const anySelected = allPhotos.some((p) => p.hoistSelected);
  const keep = (p: HoistPhoto) => (anySelected ? p.hoistSelected : true);
  const filterItem = (it: HoistItemNode): HoistItemNode => ({
    ...it,
    photos: it.photos.filter(keep),
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
    tree,
  };
}

// ─── Renderers ──────────────────────────────────────────────────────────────

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  const [r, g, b] = hexToRgb(COLOR_PRIMARY);
  doc.setTextColor(r, g, b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

/** Cover page (page 1) — "Informe de Certificación de Polipastos". */
async function renderCoverPage(doc: jsPDF, ctx: HoistPdfContext) {
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
      heroImg.src = '/repairs.png';
    });
    if (heroLoaded && heroImg.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = heroImg.naturalWidth;
      canvas.height = heroImg.naturalHeight;
      const cctx = canvas.getContext('2d')!;
      cctx.drawImage(heroImg, 0, 0);
      cctx.fillStyle = 'rgba(90, 143, 90, 0.55)';
      cctx.fillRect(0, 0, canvas.width, canvas.height);
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
      doc.addImage(logoBase64, 'PNG', margin, 15, 60, 20);
    }
  } catch {
    /* ignore */
  }

  // Title — two lines, right-aligned, white.
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const titleLines = ['Polipastos de turbina eólica', 'Informe de Certificación'];
  let titleY = pageH * 0.73;
  for (const line of titleLines) {
    doc.text(line, pageW - margin, titleY, { align: 'right' });
    titleY += 11;
  }

  // Subtitles.
  const dateStr = formatDateShortCL(ctx.createdAt);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(ctx.windFarmName, pageW - margin, titleY + 6, { align: 'right' });
  doc.text(`Turbina: ${ctx.turbineName}`, pageW - margin, titleY + 14, { align: 'right' });
  doc.text(dateStr, pageW - margin, titleY + 22, { align: 'right' });

  // Footer.
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

/** General-data + per-item results table (page 2). */
function renderGeneralData(doc: jsPDF, ctx: HoistPdfContext) {
  doc.addPage();
  const [r, g, b] = hexToRgb(COLOR_PRIMARY);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_WIDTH, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE CERTIFICACIÓN DE POLIPASTOS', PAGE_WIDTH / 2, 20, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  let y = 44;
  const anioReporte = ctx.createdAt ? String(new Date(ctx.createdAt).getFullYear()) : NA;

  autoTable(doc, {
    startY: y,
    head: [['Datos generales', '']],
    body: [
      ['País', ctx.country || NA],
      ['Cliente', ctx.client || NA],
      ['Planta (P.E.)', ctx.windFarmName],
      ['Año', anioReporte],
      ['Fabricante', ctx.manufacturer || NA],
      ['Tipo de turbina', ctx.turbineModel],
      ['N° de turbina', ctx.turbineName],
      ['Fecha', formatDateES(ctx.createdAt)],
      ['Informe realizado por', ctx.reportedBy],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 78 } },
    margin: { left: MARGIN, right: MARGIN },
  });

  y = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY ?? y + 60;
  y += 8;

  // Per-item results summary: step / sub-group / item / type / result / photos.
  y = addSectionTitle(doc, 'Resultados por paso', y);
  const rows: string[][] = [];
  for (const step of ctx.tree) {
    const pushItem = (groupLabel: string, it: HoistItemNode) => {
      const result =
        it.itemType === 'check'
          ? checkResultLabel(it)
          : it.itemType === 'measurement'
            ? measurementLabel(it)
            : '—';
      rows.push([
        step.stepLabel,
        groupLabel,
        it.itemLabel,
        itemTypeLabel(it.itemType),
        result,
        String(it.photos.length),
      ]);
    };
    if (step.hasGroups) {
      for (const grp of step.groups) for (const it of grp.items) pushItem(grp.groupLabel, it);
    } else {
      for (const it of step.items) pushItem('', it);
    }
  }
  autoTable(doc, {
    startY: y,
    head: [['Paso', 'Sub-grupo', 'Ítem', 'Tipo', 'Resultado', 'Fotos']],
    body: rows.length > 0 ? rows : [['—', '—', '—', '—', '—', '0']],
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    styles: { cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 28 },
      3: { cellWidth: 20 },
      4: { cellWidth: 24 },
      5: { cellWidth: 12, halign: 'center' },
    },
    margin: { left: MARGIN, right: MARGIN },
  });
}

/** Render one photo block (header band + full-width image) on its own page. */
async function renderPhotoBlock(
  doc: jsPDF,
  stepLabel: string,
  subLabel: string | null,
  itemLabel: string,
  photo: HoistPhoto,
) {
  doc.addPage();

  const headerY = 20;
  const headerH = 9;
  const totalW = PAGE_WIDTH - 2 * MARGIN;
  doc.setFillColor(224, 237, 247);
  doc.rect(MARGIN, headerY, totalW, headerH, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const parts = [stepLabel, subLabel, itemLabel].filter(Boolean);
  doc.text(parts.join(' · '), MARGIN + 3, headerY + headerH / 2 + 1.5);

  const imgTop = headerY + headerH + 6;
  const imgW = PAGE_WIDTH - 2 * MARGIN;
  const imgBottom = PAGE_HEIGHT - 16;
  const imgH = Math.max(0, imgBottom - imgTop);
  if (imgH > 20) {
    const base64 = await loadImageAsBase64(photo.url);
    if (base64) {
      try {
        doc.addImage(base64, 'JPEG', MARGIN, imgTop, imgW, imgH);
      } catch {
        /* skip broken image */
      }
    }
  }
}

/** One separator page per STEP, then one block page per selected photo. */
async function renderStepSection(doc: jsPDF, step: HoistStepNode, locale: 'es' | 'en') {
  // Collect every item of the step (direct or grouped).
  const groups: { label: string | null; items: HoistItemNode[] }[] = step.hasGroups
    ? step.groups.map((g) => ({ label: g.groupLabel, items: g.items }))
    : [{ label: null, items: step.items }];

  const hasPhotos = groups.some((g) => g.items.some((it) => it.photos.length > 0));
  if (!hasPhotos) return;

  // Separator page with the step name centered.
  doc.addPage();
  doc.setTextColor(...hexToRgb(COLOR_PRIMARY));
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  const stepName = getHoistLabel(step.stepCode, locale).toUpperCase();
  const wrapped = doc.splitTextToSize(stepName, PAGE_WIDTH - 40);
  doc.text(wrapped, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  for (const grp of groups) {
    for (const item of grp.items) {
      const photos = [...item.photos].sort((a, b) => a.captureOrder - b.captureOrder);
      for (const photo of photos) {
        await renderPhotoBlock(doc, step.stepLabel, grp.label, item.itemLabel, photo);
      }
    }
  }
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

  const ctx = await fetchHoistData(data.campaignId);
  const doc = new jsPDF('p', 'mm', 'a4');

  // 1. Cover page.
  await renderCoverPage(doc, ctx);
  // 2. General data + per-item results table.
  renderGeneralData(doc, ctx);
  // 3. One section per STEP (separator + one block page per photo).
  const locale: 'es' | 'en' = 'es';
  for (const step of ctx.tree) {
    await renderStepSection(doc, step, locale);
  }
  // 4. Footers.
  addFooters(doc, ctx.windFarmName);

  const dateStr = formatDateES(ctx.createdAt).replace(/\//g, '-');
  const filename = `Informe_Certificacion_Polipastos_${ctx.turbineName}_${dateStr}.pdf`.replace(/\s+/g, '_');

  const blob = doc.output('blob') as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { blob, filename };
}
