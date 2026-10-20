import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { cleaningService } from '@/services/cleaning.service';
import type { CleaningTree, CleaningZoneNode, CleaningPhoto } from '@/services/cleaning.service';
import { getCleaningZoneLabel } from '@/constants/cleaning-zones';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Cleaning ("Limpieza de Turbina") report PDF.
 *
 * MIRRORS repairReportPdf.service.ts (cover, general-data table, per-section
 * photo blocks, footers) but groups photos by ZONE / SUB-ZONE instead of by
 * defect/stage, and uses ONLY the photos selected for the report
 * (metadata.selected_for_report). There are NO defects, categories, OCR, or
 * damage tables — cleaning evidence is purely zone-organized photos.
 */

type JsPDFWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface CleaningReportData {
  campaignId: string;
}

type RGB = [number, number, number];

interface CleaningPdfContext {
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
  tree: CleaningTree;
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

/**
 * Load an image URL as a base64 dataURL, compressing JPEGs via canvas (so the
 * PDF stays small) and keeping PNG/SVG raw. Mirrors repairReportPdf's
 * loadImageAsBase64. Cleaning photos are public JPEGs in 'inspection-photos'.
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

async function fetchCleaningData(campaignId: string): Promise<CleaningPdfContext> {
  const { data: campaign, error } = await db
    .from('campaign')
    .select(`
      id, name, status, created_at,
      wind_farm:wind_farm_id ( name, location, country, client ),
      turbine:turbine_id ( name, model, manufacturer )
    `)
    .eq('id', campaignId)
    .single();
  if (error || !campaign) throw error || new Error('Cleaning campaign not found');

  const wf = (campaign.wind_farm as Record<string, unknown>) ?? {};
  const turbine = (campaign.turbine as Record<string, unknown>) ?? {};

  // Reuse the SAME tree the UI uses, so the report reflects exactly what the
  // web shows (and degrades gracefully to empty zones when no data yet).
  const fullTree = await cleaningService.getCleaningTree(campaignId);

  // Keep only the photos selected for the report. If NONE are selected across
  // the whole campaign, fall back to ALL photos (same rule as repair).
  const anySelected = fullTree.some(
    (z) =>
      z.photos.some((p) => p.cleaningSelected) ||
      z.children.some((c) => c.photos.some((p) => p.cleaningSelected)),
  );
  const keep = (p: CleaningPhoto) => (anySelected ? p.cleaningSelected : true);
  const tree: CleaningTree = fullTree.map((z) => ({
    ...z,
    photos: z.photos.filter(keep),
    children: z.children.map((c) => ({ ...c, photos: c.photos.filter(keep) })),
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

/** Cover page (page 1) — ported from the repair cover, title "Informe de Limpieza". */
async function renderCoverPage(doc: jsPDF, ctx: CleaningPdfContext) {
  const pageW = PAGE_WIDTH;
  const pageH = PAGE_HEIGHT;
  const margin = 20;

  // Hero image with a green overlay baked into a canvas (fallback: solid green).
  let coverImageLoaded = false;
  try {
    const heroImg = new Image();
    heroImg.crossOrigin = 'anonymous';
    const heroLoaded = await new Promise<boolean>((resolve) => {
      heroImg.onload = () => resolve(true);
      heroImg.onerror = () => resolve(false);
      // Reuse the repairs hero if present; otherwise the fallback green panel.
      heroImg.src = '/repairs.jpg';
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
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const titleLines = ['Palas de turbina eólica', 'Informe de Limpieza'];
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

/** General-data + per-zone summary table (page 2). */
function renderGeneralData(doc: jsPDF, ctx: CleaningPdfContext) {
  doc.addPage();
  const [r, g, b] = hexToRgb(COLOR_PRIMARY);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_WIDTH, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE LIMPIEZA DE TURBINA', PAGE_WIDTH / 2, 20, { align: 'center' });
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

  // Per-zone photo summary (zone / sub-zone → selected photos count).
  y = addSectionTitle(doc, 'Resumen por zona', y);
  const summaryRows: string[][] = [];
  for (const zone of ctx.tree) {
    if (zone.isLeaf) {
      summaryRows.push([zone.zoneLabel, '', String(zone.photos.length)]);
    } else {
      for (const child of zone.children) {
        summaryRows.push([zone.zoneLabel, child.zoneLabel, String(child.photos.length)]);
      }
    }
  }
  autoTable(doc, {
    startY: y,
    head: [['Zona', 'Sub-zona', 'Fotos']],
    body: summaryRows.length > 0 ? summaryRows : [['—', '—', '0']],
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 2.5 },
    margin: { left: MARGIN, right: MARGIN },
  });
}

/** Render one photo block (header band + full-width image) on its own page. */
async function renderPhotoBlock(
  doc: jsPDF,
  zoneLabel: string,
  subZoneLabel: string | null,
  photo: CleaningPhoto,
) {
  doc.addPage();

  // Header band: zone · sub-zone (gray) on the left.
  const headerY = 20;
  const headerH = 9;
  const totalW = PAGE_WIDTH - 2 * MARGIN;
  doc.setFillColor(225, 238, 225);
  doc.rect(MARGIN, headerY, totalW, headerH, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const headerText = subZoneLabel ? `${zoneLabel} · ${subZoneLabel}` : zoneLabel;
  doc.text(headerText, MARGIN + 3, headerY + headerH / 2 + 1.5);

  // Full-width photo in the lower area of the page.
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

/** One separator page per ROOT zone, then one block page per selected photo. */
async function renderZoneSection(doc: jsPDF, zone: CleaningZoneNode, locale: 'es' | 'en') {
  // Collect the zone's selected photos (leaf root: own photos; container: children).
  const rows = zone.isLeaf ? [zone] : zone.children;
  const hasPhotos = rows.some((r) => r.photos.length > 0);
  if (!hasPhotos) return;

  // Separator page with the zone name centered.
  doc.addPage();
  doc.setTextColor(...hexToRgb(COLOR_PRIMARY));
  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  doc.text(
    getCleaningZoneLabel(zone.zoneCode, locale).toUpperCase(),
    PAGE_WIDTH / 2,
    PAGE_HEIGHT / 2,
    { align: 'center' },
  );
  doc.setTextColor(0, 0, 0);

  for (const row of rows) {
    const subLabel = zone.isLeaf ? null : row.zoneLabel;
    const photos = [...row.photos].sort((a, b) => a.captureOrder - b.captureOrder);
    for (const photo of photos) {
      await renderPhotoBlock(doc, zone.zoneLabel, subLabel, photo);
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
 * Generate and download the cleaning report PDF, grouped by zone/sub-zone, using
 * only the photos selected for the report. Mirrors
 * generateAndDownloadRepairReport (capture the blob once, download from it).
 */
export async function generateAndDownloadCleaningReport(
  data: CleaningReportData,
): Promise<{ blob: Blob; filename: string }> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
  }

  const ctx = await fetchCleaningData(data.campaignId);
  const doc = new jsPDF('p', 'mm', 'a4');

  // 1. Cover page.
  await renderCoverPage(doc, ctx);
  // 2. General data + per-zone summary.
  renderGeneralData(doc, ctx);
  // 3. One section per ROOT zone (separator + one block page per photo).
  const locale: 'es' | 'en' = 'es';
  for (const zone of ctx.tree) {
    await renderZoneSection(doc, zone, locale);
  }
  // 4. Footers.
  addFooters(doc, ctx.windFarmName);

  const dateStr = formatDateES(ctx.createdAt).replace(/\//g, '-');
  const filename = `Informe_Limpieza_${ctx.turbineName}_${dateStr}.pdf`.replace(/\s+/g, '_');

  const blob = doc.output('blob') as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { blob, filename };
}
