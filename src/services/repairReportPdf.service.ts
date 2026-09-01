import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { getStageCatalogLabel } from '@/constants/repair-stages';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepairReportData {
  campaignId: string;
}

type RGB = [number, number, number];

/**
 * One selected repair photo, with ALL the context needed to render its block.
 * Every field is sourced from the DB (repair_photos_detailed view + defect table).
 * Fields that don't exist in the DB are left empty — never invented.
 */
interface RepairPhotoForPdf {
  /** repair_photo id (repair_photos_detailed.photo_id / id). */
  photoId: string;
  /** defect.id this photo belongs to (view.defect_id). */
  defectId: string | null;
  /** repair stage code (view.stage_code) — used for ordering/labels. */
  stageCode: string;
  /** Human-readable stage name (shown as "Descripción" in the block). view.stage_label. */
  stageLabel: string;
  /** repair stage_order for grouping/ordering photos by stage. */
  stageOrder: number;
  captureOrder: number;
  /** captured_at (or repair_completed_at) — used for the Fecha field. */
  capturedAt: string | null;
  repairCompletedAt: string | null;
  /** blade side reported on the photo/stage (view.blade_side). */
  bladeSide: string | null;
  /** turbine name (view.turbine_name). */
  turbineName: string | null;
  /** public URL resolved from storage_path. */
  url: string;
  /** whether metadata.selected_for_report is true. */
  selected: boolean;
}

/**
 * A defect (from the `defect` table, keyed by repair_photos_detailed.defect_id).
 * Provides Largo/Ancho/lado and blade position for the block table.
 */
interface DefectForPdf {
  id: string;
  type: string;
  severity: number | null;
  distanceFromRoot: number | null;
  widthCm: number | null;
  heightCm: number | null;
  side: string | null;
  description: string | null;
  /** blade position (1=A, 2=B, 3=C) resolved via defect→inspection→blade. */
  bladePosition: number;
  /** blade serial number resolved via defect→inspection→blade. */
  bladeSerial: string | null;
}

interface RepairPdfContext {
  campaignName: string;
  status: string;
  createdAt: string;
  windFarmName: string;
  windFarmLocation: string;
  turbineName: string;
  turbineModel: string;
  companyName: string;
  technicianName: string;
  technicianEmail: string;
  /** repair start/end dates from the view (BD), for portada/año. */
  repairStartedAt: string | null;
  repairCompletedAt: string | null;
  blades: { position: number; serialNumber: string | null; lengthMeters: number | null }[];
  defects: DefectForPdf[];
  photos: RepairPhotoForPdf[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COLOR_PRIMARY = '#5A8F5A';
const COLOR_COVER_BG = '#5A8F5A';
const COLOR_HEADER_TABLE: RGB = [90, 143, 90];
const NA = 'N/A';

// Block (per-photo) palette — replicates the client's HG Windtec report image.
const COLOR_BLOCK_LABEL_BG: RGB = [220, 228, 235]; // gris claro (etiquetas)
const COLOR_BLOCK_VALUE_BG: RGB = [255, 255, 255]; // blanco (valores)
const COLOR_BLOCK_ORANGE: RGB = [255, 140, 0]; // naranja (categoría del daño)
const COLOR_BLOCK_LABEL_TEXT: RGB = [0, 0, 0]; // negro bold (etiquetas)

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;

const BLADE_LABELS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

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

const MONTHS_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * es-CL short date (DD-MM-YYYY) for the cover subtitle — same format as the
 * inspection cover (toLocaleDateString('es-CL')). NA if empty/invalid.
 */
function formatDateShortCL(dateStr: string | null | undefined): string {
  if (!dateStr) return NA;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return NA;
  return d.toLocaleDateString('es-CL');
}

/** DD-Mon-YYYY (e.g. "05-Mar-2024") for the block "Fecha" field. Empty if no date. */
function formatDateBlock(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${MONTHS_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

/**
 * Maps a defect side / blade_side value to the X marks for the block table.
 * LE → B.Ataque, TE → B.Salida, PS/pressure → Lado de Alta, SS/suction → Lado de Baja.
 * All others empty. Never invents a mark.
 */
function sideMarks(side: string | null | undefined): {
  ladoAlta: string;
  ladoBaja: string;
  bAtaque: string;
  bSalida: string;
} {
  const out = { ladoAlta: '', ladoBaja: '', bAtaque: '', bSalida: '' };
  if (!side) return out;
  const s = side.toString().trim().toLowerCase();
  if (s === 'le' || s.includes('leading') || s.includes('ataque')) out.bAtaque = 'X';
  else if (s === 'te' || s.includes('trailing') || s.includes('salida')) out.bSalida = 'X';
  else if (s === 'ps' || s.includes('pressure') || s.includes('alta')) out.ladoAlta = 'X';
  else if (s === 'ss' || s.includes('suction') || s.includes('baja')) out.ladoBaja = 'X';
  return out;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function resolvePhotoUrl(storagePath: string): string {
  // Repair photos live under repairs/{repair_id}/... in the PUBLIC
  // 'inspection-photos' bucket → public URL (no signing).
  const { data } = supabase.storage.from('inspection-photos').getPublicUrl(storagePath);
  return data?.publicUrl ?? '';
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

/** Reads a possibly-JSON metadata value and returns whether selected_for_report is true. */
function isSelectedForReport(metadata: unknown): boolean {
  let obj: unknown = metadata;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      return false;
    }
  }
  if (!!obj && typeof obj === 'object') {
    return Boolean((obj as Record<string, unknown>).selected_for_report);
  }
  return false;
}

/** Safe number parse → null when absent. */
function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

async function fetchRepairData(campaignId: string): Promise<RepairPdfContext> {
  // 1. Campaign + turbine + wind farm
  const { data: campaign, error: campErr } = await db
    .from('campaign')
    .select(`
      id, name, status, created_at, quote_id, turbine_id,
      wind_farm:wind_farm_id ( name, location ),
      turbine:turbine_id ( id, name, model )
    `)
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) throw campErr || new Error('Repair campaign not found');

  const wf = (campaign.wind_farm as Record<string, unknown>) ?? {};
  const turbine = (campaign.turbine as Record<string, unknown>) ?? {};
  const turbineId = (turbine.id as string) ?? campaign.turbine_id ?? null;

  // 2. Blades of the turbine
  let blades: RepairPdfContext['blades'] = [];
  if (turbineId) {
    const { data: bladeRows } = await db
      .from('blade')
      .select('position, serial_number, length_meters')
      .eq('turbine_id', turbineId)
      .order('position');
    blades = ((bladeRows as unknown[]) ?? []).map((b) => {
      const r = b as Record<string, unknown>;
      return {
        position: Number(r.position),
        serialNumber: (r.serial_number as string) ?? null,
        lengthMeters: r.length_meters != null ? Number(r.length_meters) : null,
      };
    });
  }

  // 3. Technician info — prefer the quote's quoted_by, fallback to campaign creator.
  let technicianName = NA;
  let technicianEmail = '';
  let quotedById: string | null = null;
  if (campaign.quote_id) {
    const { data: quote } = await db
      .from('quote')
      .select('quoted_by')
      .eq('id', campaign.quote_id)
      .single();
    quotedById = (quote?.quoted_by as string) ?? null;
  }
  if (quotedById) {
    const { data: prof } = await db
      .from('profiles')
      .select('name, email')
      .eq('id', quotedById)
      .single();
    if (prof) {
      technicianName = (prof.name as string) || NA;
      technicianEmail = (prof.email as string) || '';
    }
  }

  // 4. Repair photos — from the OFFICIAL view `repair_photos_detailed` (one row per
  //    photo, with all context). We filter by the campaign's quote_id and order by
  //    stage_order then capture_order. We NEVER read inspection_photo for repair
  //    evidence. Every value below comes from the view (BD) — nothing invented.
  let photos: RepairPhotoForPdf[] = [];
  let repairStartedAt: string | null = null;
  let repairCompletedAt: string | null = null;
  const defectIdsFromView = new Set<string>();

  if (campaign.quote_id) {
    const { data: viewRows, error: viewErr } = await db
      .from('repair_photos_detailed')
      .select('*')
      .eq('quote_id', campaign.quote_id)
      .order('stage_order')
      .order('capture_order');
    if (viewErr) throw viewErr;

    for (const rr of (viewRows as unknown[]) ?? []) {
      const r = rr as Record<string, unknown>;
      const photoId = (r.photo_id as string) ?? (r.id as string) ?? '';
      if (!photoId) continue;

      const storagePath = (r.storage_path as string) ?? '';
      const defectId = (r.defect_id as string) ?? null;
      if (defectId) defectIdsFromView.add(defectId);

      // Track repair timeframe from the BD (any row carries it).
      if (!repairStartedAt && r.repair_started_at) {
        repairStartedAt = r.repair_started_at as string;
      }
      if (!repairCompletedAt && r.repair_completed_at) {
        repairCompletedAt = r.repair_completed_at as string;
      }

      const stageCode = (r.stage_code as string) ?? '';
      const stageLabel =
        (r.stage_label as string) ||
        (stageCode ? getStageCatalogLabel(stageCode, 'es') : '');

      photos.push({
        photoId,
        defectId,
        stageCode,
        stageLabel,
        stageOrder: Number(r.stage_order) || 0,
        captureOrder: Number(r.capture_order) || 0,
        capturedAt: (r.captured_at as string) ?? null,
        repairCompletedAt: (r.repair_completed_at as string) ?? null,
        bladeSide: (r.blade_side as string) ?? null,
        turbineName: (r.turbine_name as string) ?? null,
        url: resolvePhotoUrl(storagePath),
        selected: isSelectedForReport(r.metadata),
      });
    }
  }

  // 4b. Filter to selected_for_report=true. If NONE selected, fall back to all.
  const anySelected = photos.some((p) => p.selected);
  if (anySelected) {
    photos = photos.filter((p) => p.selected);
  }

  // 5. Defect dimensions/sides — read the `defect` table by the defect_id set from
  //    the view. This populates Largo/Ancho/lados. Blade position + serial are
  //    resolved via defect → inspection → blade.
  const defects: DefectForPdf[] = [];
  if (defectIdsFromView.size > 0) {
    const defectIds = [...defectIdsFromView];
    const { data: defectRows, error: defErr } = await db
      .from('defect')
      .select('id, type, severity, distance_from_root, width_cm, height_cm, side, description, inspection_id')
      .in('id', defectIds);
    if (defErr) throw defErr;

    // Resolve blade (position + serial) per defect via inspection → blade.
    const inspectionIds = [
      ...new Set(
        ((defectRows as unknown[]) ?? [])
          .map((d) => (d as Record<string, unknown>).inspection_id as string)
          .filter(Boolean),
      ),
    ];
    const bladeByInspection: Record<string, { position: number; serial: string | null }> = {};
    if (inspectionIds.length > 0) {
      const { data: inspRows } = await db
        .from('inspection')
        .select('id, blade:blade_id ( position, serial_number )')
        .in('id', inspectionIds);
      for (const ir of (inspRows as unknown[]) ?? []) {
        const r = ir as Record<string, unknown>;
        const blade = (r.blade as Record<string, unknown>) ?? {};
        bladeByInspection[r.id as string] = {
          position: Number(blade.position) || 0,
          serial: (blade.serial_number as string) ?? null,
        };
      }
    }

    for (const dr of (defectRows as unknown[]) ?? []) {
      const r = dr as Record<string, unknown>;
      const inspId = (r.inspection_id as string) ?? '';
      const bladeInfo = bladeByInspection[inspId] ?? { position: 0, serial: null };
      defects.push({
        id: (r.id as string) ?? '',
        type: (r.type as string) ?? 'other',
        severity: numOrNull(r.severity),
        distanceFromRoot: numOrNull(r.distance_from_root),
        widthCm: numOrNull(r.width_cm),
        heightCm: numOrNull(r.height_cm),
        side: (r.side as string) ?? null,
        description: (r.description as string) ?? null,
        bladePosition: bladeInfo.position,
        bladeSerial: bladeInfo.serial,
      });
    }
  }

  return {
    campaignName: (campaign.name as string) ?? NA,
    status: (campaign.status as string) ?? NA,
    createdAt: (campaign.created_at as string) ?? '',
    windFarmName: (wf.name as string) ?? NA,
    windFarmLocation: (wf.location as string) ?? NA,
    turbineName: (turbine.name as string) ?? NA,
    turbineModel: (turbine.model as string) ?? NA,
    companyName: 'HG Windtec',
    technicianName,
    technicianEmail,
    repairStartedAt,
    repairCompletedAt,
    blades,
    defects,
    photos,
  };
}

// ─── PDF Renderers ──────────────────────────────────────────────────────────

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  const [r, g, b] = hexToRgb(COLOR_PRIMARY);
  doc.setTextColor(r, g, b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

/**
 * Cover page (page 1). Ported EXACTLY from the inspection cover in
 * ExportPanel.tsx (handleGeneratePDF → "PAGE 1: Cover"), so the repair cover is
 * faithful to the real inspection cover, with two differences:
 *   - the hero image is `/repairs.jpg` instead of `/portada.png`
 *   - the title's second line is "Informe de Reparación"
 *
 * Layout: full-page hero image with the green overlay (rgba(90,143,90,0.55))
 * baked into a canvas → CORE Insight logo (core-insight-logo.png) top-left →
 * two-line right-aligned white title (30pt bold) in the lower half →
 * right-aligned white subtitles (14pt: wind farm, turbine, repair date) →
 * two-column white footer (no white band, no environmental note).
 *
 * All subtitle data comes from BD (windFarmName / turbineName / repair date).
 */
async function renderCoverPage(doc: jsPDF, ctx: RepairPdfContext) {
  // Local constants matching ExportPanel for pixel-faithful fidelity.
  const pageW = PAGE_WIDTH; // 210
  const pageH = PAGE_HEIGHT; // 297
  const margin = 20; // ExportPanel uses 20 on the cover (not MARGIN=14)

  // 1) Full-page hero image with the green overlay BAKED into a canvas
  //    (same approach as inspection: no GState, no opaque top band).
  let coverImageLoaded = false;
  try {
    const heroImg = new Image();
    heroImg.crossOrigin = 'anonymous';
    const heroLoaded = await new Promise<boolean>((resolve) => {
      heroImg.onload = () => resolve(true);
      heroImg.onerror = () => resolve(false);
      heroImg.src = '/repairs.jpg';
    });
    if (heroLoaded && heroImg.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = heroImg.naturalWidth;
      canvas.height = heroImg.naturalHeight;
      const cctx = canvas.getContext('2d')!;
      // Draw the original image, then bake the green overlay on top.
      cctx.drawImage(heroImg, 0, 0);
      cctx.fillStyle = 'rgba(90, 143, 90, 0.55)';
      cctx.fillRect(0, 0, canvas.width, canvas.height);
      const coverBase64 = canvas.toDataURL('image/jpeg', 0.92);
      doc.addImage(coverBase64, 'JPEG', 0, 0, pageW, pageH);
      coverImageLoaded = true;
    }
  } catch (e) {
    console.warn('[repairReportPdf] Could not load repairs.jpg:', e);
  }

  if (!coverImageLoaded) {
    // Fallback: solid green rectangle (top 70% of the page).
    const [r, g, b] = hexToRgb(COLOR_COVER_BG);
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageW, pageH * 0.7, 'F');
  }

  // 2) CORE Insight logo (core-insight-logo.png) in the top-left corner.
  try {
    const resp = await fetch('/core-insight-logo.png');
    if (resp.ok) {
      const arrayBuffer = await resp.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const logoBase64 = 'data:image/png;base64,' + btoa(binary);
      doc.addImage(logoBase64, 'PNG', margin, 15, 60, 20);
    }
  } catch (e) {
    console.warn('[repairReportPdf] Could not load core-insight-logo.png:', e);
  }

  // 3) Title — two lines, right-aligned, 30pt bold white, in the lower half.
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const titleLines = ['Palas de turbina eólica', 'Informe de Reparación'];
  let titleY = pageH * 0.73;
  for (const line of titleLines) {
    doc.text(line, pageW - margin, titleY, { align: 'right' });
    titleY += 11;
  }

  // 4) Subtitles — right-aligned, 14pt white: wind farm, turbine, repair date.
  const repairDateSource = ctx.repairCompletedAt || ctx.repairStartedAt || ctx.createdAt;
  const dateStr = formatDateShortCL(repairDateSource);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(ctx.windFarmName, pageW - margin, titleY + 6, { align: 'right' });
  doc.text(`Turbina: ${ctx.turbineName}`, pageW - margin, titleY + 14, { align: 'right' });
  doc.text(dateStr, pageW - margin, titleY + 22, { align: 'right' });

  // 5) Footer — two columns, white text, no white band, no environmental note.
  const footerStartY = pageH - 15;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('Generado por', margin + 10, footerStartY);
  doc.text(ctx.companyName, margin + 10, footerStartY + 5);
  doc.text('Con tecnología', pageW - margin - 10, footerStartY, { align: 'right' });
  doc.text('CORE Insight', pageW - margin - 10, footerStartY + 5, { align: 'right' });

  doc.setTextColor(0, 0, 0);
}

function renderGeneralData(doc: jsPDF, ctx: RepairPdfContext) {
  // General data starts on its own page (page 2), after the cover.
  doc.addPage();

  // Section band header.
  const [r, g, b] = hexToRgb(COLOR_PRIMARY);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_WIDTH, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE REPARACIÓN, REALIZADA', PAGE_WIDTH / 2, 15, { align: 'center' });
  doc.text('MEDIANTE ACCESO DE CUERDAS', PAGE_WIDTH / 2, 24, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  let y = 44;

  // Año — prefer repair dates from BD, fall back to campaign createdAt.
  const anioSource = ctx.repairCompletedAt || ctx.repairStartedAt || ctx.createdAt;
  const anioReporte = anioSource ? String(new Date(anioSource).getFullYear()) : NA;

  // General data table
  const bladesInRepair = ctx.blades.length > 0
    ? ctx.blades.map((bl) => `Pala ${BLADE_LABELS[bl.position] || bl.position}`).join(', ')
    : NA;

  autoTable(doc, {
    startY: y,
    head: [['Datos generales', '']],
    body: [
      ['País', NA],
      ['Cliente', NA],
      ['Planta (P.E.)', ctx.windFarmName],
      ['Año', anioReporte],
      ['Fabricante', NA],
      ['Tipo de turbina', ctx.turbineModel],
      ['N° de turbina', ctx.turbineName],
      ['Horas de producción', NA],
      ['Estado turbina antes de la reparación', NA],
      ['Estado turbina después de la reparación', NA],
      ['Pala(s) en reparación', bladesInRepair],
      ['Fecha inicio', ctx.repairStartedAt ? formatDateES(ctx.repairStartedAt) : NA],
      ['Fecha fin', ctx.repairCompletedAt ? formatDateES(ctx.repairCompletedAt) : NA],
      ['Daños reparados (cantidad)', String(ctx.defects.length)],
      ['Informe realizado por', ctx.technicianName + (ctx.technicianEmail ? ` (${ctx.technicianEmail})` : '')],
      ['Técnico(s) a cargo', ctx.technicianName],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 78 } },
    margin: { left: MARGIN, right: MARGIN },
  });

  y = (doc as any).lastAutoTable?.finalY ?? y + 60;
  y += 8;

  // Blade data
  y = addSectionTitle(doc, 'Datos del Aspa', y);
  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Largo', ctx.blades[0]?.lengthMeters != null ? `${ctx.blades[0]!.lengthMeters} m` : NA],
      ['Color', NA],
      ['Serie Pala A', ctx.blades.find((b) => b.position === 1)?.serialNumber || NA],
      ['Serie Pala B', ctx.blades.find((b) => b.position === 2)?.serialNumber || NA],
      ['Serie Pala C', ctx.blades.find((b) => b.position === 3)?.serialNumber || NA],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    margin: { left: MARGIN, right: MARGIN },
  });

  y = (doc as any).lastAutoTable?.finalY ?? y + 40;
  y += 8;

  // Findings
  y = addSectionTitle(doc, 'Hallazgos', y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const findings = ctx.defects.length > 0
    ? `Se identificaron ${ctx.defects.length} daño(s) a reparar en la turbina ${ctx.turbineName}.`
    : 'Sin hallazgos registrados.';
  doc.text(doc.splitTextToSize(findings, PAGE_WIDTH - 2 * MARGIN), MARGIN, y);

  // Blade design section (placeholder — exact diagram not replicated)
  y += 16;
  y = addSectionTitle(doc, 'Diseño de la pala', y);
  doc.setFillColor(240, 240, 240);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 40, 'F');
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('[Diagrama de diseño de la pala]', PAGE_WIDTH / 2, y + 22, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

/**
 * Renders the detail table for a single photo block, replicating the client's
 * HG Windtec image: 4-column label/value grid built with autoTable colSpans and
 * per-cell fill colors (labels gray, values white). Every value comes from BD.
 * Returns the finalY after the table.
 */
function renderBlockTable(
  doc: jsPDF,
  startY: number,
  defect: DefectForPdf | null,
  photo: RepairPhotoForPdf,
  bladeLabel: string,
): number {
  // Prefer the defect date context; fall back to captured/completed dates (BD).
  const fecha = formatDateBlock(photo.capturedAt || photo.repairCompletedAt);
  const serie = defect?.bladeSerial || '';
  const turbina = photo.turbineName || '';
  const marks = sideMarks(defect?.side || photo.bladeSide);
  const largo = defect?.heightCm != null ? `${defect.heightCm}mm` : '';
  const ancho = defect?.widthCm != null ? `${defect.widthCm}mm` : '';
  const descripcion = photo.stageLabel || '';

  // autoTable cell type: [text, fill]. Labels use gray bg + bold black; values
  // use white bg. Fields with no BD data render as '' (empty), never invented.
  const labelStyle = { fillColor: COLOR_BLOCK_LABEL_BG, textColor: COLOR_BLOCK_LABEL_TEXT, fontStyle: 'bold' as const };
  const valueStyle = { fillColor: COLOR_BLOCK_VALUE_BG, textColor: [0, 0, 0] as RGB };

  const L = (text: string) => ({ content: text, styles: labelStyle });
  const V = (text: string) => ({ content: text, styles: valueStyle });

  const colW = (PAGE_WIDTH - 2 * MARGIN) / 4;
  autoTable(doc, {
    startY,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [180, 180, 180], lineWidth: 0.2, halign: 'left', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: colW },
      1: { cellWidth: colW },
      2: { cellWidth: colW },
      3: { cellWidth: colW },
    },
    margin: { left: MARGIN, right: MARGIN },
    body: [
      // Row 1 — labels
      [L('Fecha:'), L('Número de aspa:'), L('Serie del Aspa:'), L('Turbina:')],
      // Row 1 — values
      [V(fecha), V(`Pala ${bladeLabel}`), V(serie), V(turbina)],
      // Row 2 — labels
      [L('Lado de Alta:'), L('Lado de Baja:'), L('B. Ataque:'), L('B. Salida:')],
      // Row 2 — values (X marks from BD side; others empty)
      [V(marks.ladoAlta), V(marks.ladoBaja), V(marks.bAtaque), V(marks.bSalida)],
      // Row 3 — labels
      [L('Z1:'), L('Largo:'), L('Z2:'), L('BA1:')],
      // Row 3 — values (Z1/Z2/BA1 empty — no BD field)
      [V(''), V(largo), V(''), V('')],
      // Row 4 — labels
      [L('Ancho:'), L('BA2:'), { content: 'Reparación:', colSpan: 2, styles: labelStyle }],
      // Row 4 — values (BA2 empty; Reparación default 'Externa' per client example)
      [V(ancho), V(''), { content: 'Externa', colSpan: 2, styles: valueStyle }],
      // Descripción — full-width label centered, then full-width value centered = stage_label
      [{ content: 'Descripción:', colSpan: 4, styles: { ...labelStyle, halign: 'center' as const } }],
      [{ content: descripcion, colSpan: 4, styles: { ...valueStyle, halign: 'center' as const } }],
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? startY + 60;
}

/**
 * Renders one blade separator page, then one BLOCK PER SELECTED PHOTO
 * (each on its own page): bicolor header + detail table + one large photo.
 * Damage index (#n) = the defect's index within the blade.
 */
async function renderBladeSection(doc: jsPDF, ctx: RepairPdfContext, bladePosition: number) {
  const label = BLADE_LABELS[bladePosition] || String(bladePosition);
  const bladeDefects = ctx.defects.filter((d) => d.bladePosition === bladePosition);

  // Photos of this blade = photos whose defect belongs to this blade position.
  const bladeDefectIds = new Set(bladeDefects.map((d) => d.id));
  const bladePhotos = ctx.photos
    .filter((p) => p.defectId != null && bladeDefectIds.has(p.defectId))
    .sort((a, b) => a.stageOrder - b.stageOrder || a.captureOrder - b.captureOrder);

  if (bladePhotos.length === 0) return;

  // #n index per defect within this blade.
  const damageIndexByDefect = new Map<string, number>();
  bladeDefects.forEach((d, idx) => damageIndexByDefect.set(d.id, idx + 1));

  // Separator page
  doc.addPage();
  doc.setTextColor(...hexToRgb(COLOR_PRIMARY));
  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  doc.text(`PALA ${label}`, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Group photos by defect (in blade defect order), then render blocks.
  for (const defect of bladeDefects) {
    const photosForDefect = bladePhotos.filter((p) => p.defectId === defect.id);
    const damageIndex = damageIndexByDefect.get(defect.id) ?? 1;

    for (const photo of photosForDefect) {
      doc.addPage();

      // 1. Bicolor header row: left gray "Pala X ~ Daño #n", right orange category.
      const headerY = 20;
      const headerH = 9;
      const halfW = (PAGE_WIDTH - 2 * MARGIN) / 2;

      // Left cell — gray bg, black bold.
      doc.setFillColor(...COLOR_BLOCK_LABEL_BG);
      doc.rect(MARGIN, headerY, halfW, headerH, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Pala ${label} ~ Daño #${damageIndex}`, MARGIN + 3, headerY + headerH / 2 + 1.5);

      // Right cell — orange bg, white bold.
      doc.setFillColor(...COLOR_BLOCK_ORANGE);
      doc.rect(MARGIN + halfW, headerY, halfW, headerH, 'F');
      doc.setTextColor(255, 255, 255);
      const categoria = defect.severity != null ? String(defect.severity) : '';
      doc.text(`Categoría del daño: ${categoria}`, MARGIN + halfW + 3, headerY + headerH / 2 + 1.5);
      doc.setTextColor(0, 0, 0);

      // 2. Detail table (4-column label/value grid).
      const tableY = renderBlockTable(doc, headerY + headerH, defect, photo, label);

      // 3. One large photo, margin-to-margin, filling the lower half of the page.
      const imgTop = tableY + 6;
      const imgW = PAGE_WIDTH - 2 * MARGIN;
      const imgBottom = PAGE_HEIGHT - 16; // leave room for footer
      const imgH = Math.max(0, imgBottom - imgTop);
      if (imgH > 20) {
        const base64 = await loadImageAsBase64(photo.url);
        if (base64) {
          try {
            doc.addImage(base64, 'JPEG', MARGIN, imgTop, imgW, imgH);
          } catch {
            // skip broken image
          }
        }
      }
    }
  }
}

function renderSignaturePage(doc: jsPDF, ctx: RepairPdfContext) {
  doc.addPage();
  let y = addSectionTitle(doc, 'Firma y derechos', 30);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma del responsable:', MARGIN, y);
  doc.setDrawColor(120, 120, 120);
  doc.rect(MARGIN, y + 4, 80, 30);
  y += 44;

  doc.text(`Técnico a cargo: ${ctx.technicianName}`, MARGIN, y);
  y += 12;

  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  const legal =
    'Este documento y su contenido son propiedad de la empresa emisora y se entregan de forma ' +
    'confidencial al cliente. Queda prohibida su reproducción total o parcial, así como su distribución ' +
    'a terceros, sin autorización expresa por escrito. La información contenida refleja el estado de la ' +
    'reparación en la fecha indicada.';
  doc.text(doc.splitTextToSize(legal, PAGE_WIDTH - 2 * MARGIN), MARGIN, y);
  doc.setTextColor(0, 0, 0);
}

function addFooters(doc: jsPDF, companyName: string) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Elaborado por: ${companyName} - Página ${i} de ${totalPages}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 8,
      { align: 'center' },
    );
    doc.setTextColor(0, 0, 0);
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Generate and download the repair report PDF (HG Windtec format).
 * Uses jsPDF + autoTable following reportPdf.service.ts patterns.
 */
export async function generateAndDownloadRepairReport(data: RepairReportData): Promise<void> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
  }

  const ctx = await fetchRepairData(data.campaignId);

  const doc = new jsPDF('p', 'mm', 'a4');

  // 1. Cover page (page 1): repairs.jpg hero + title + subtitles + CORE Insight logo.
  await renderCoverPage(doc, ctx);

  // 1b. General data + blade data + findings + design (page 2 onwards).
  renderGeneralData(doc, ctx);

  // 2. Per-blade sections. One block page per SELECTED photo, grouped by blade.
  //    Combine turbine blade positions with any defect blade positions (incl. 0
  //    when defect→inspection→blade couldn't be resolved) so no photos are lost.
  const bladePositions = [
    ...new Set([
      ...ctx.blades.map((b) => b.position),
      ...ctx.defects.map((d) => d.bladePosition),
    ]),
  ].sort((a, b) => a - b);

  for (const pos of bladePositions) {
    await renderBladeSection(doc, ctx, pos);
  }

  // 3. Signature + legal page
  renderSignaturePage(doc, ctx);

  // 4. Footers on all pages
  addFooters(doc, ctx.companyName);

  const dateStr = formatDateES(ctx.createdAt).replace(/\//g, '-');
  const filename = `Informe_Reparacion_${ctx.turbineName}_${dateStr}.pdf`.replace(/\s+/g, '_');
  doc.save(filename);
}
