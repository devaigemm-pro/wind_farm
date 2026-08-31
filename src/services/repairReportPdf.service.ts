import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepairReportData {
  campaignId: string;
}

type RGB = [number, number, number];

interface RepairPhotoForPdf {
  /** repair_photo.photo_id (used only while resolving selection state). */
  photoId?: string;
  defectId: string | null;
  stageCode: string;
  /** repair stage_order for grouping/ordering photos by stage. */
  sortOrder: number;
  captureOrder: number;
  url: string;
}

interface DefectForPdf {
  id: string;
  type: string;
  severity: number;
  distanceFromRoot: number;
  widthCm: number | null;
  heightCm: number | null;
  side: string | null;
  description: string | null;
  bladePosition: number;
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
  blades: { position: number; serialNumber: string | null; lengthMeters: number | null }[];
  defects: DefectForPdf[];
  photos: RepairPhotoForPdf[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COLOR_PRIMARY = '#5A8F5A';
const COLOR_HEADER_TABLE: RGB = [90, 143, 90];
const COLOR_DAMAGE_BAND: RGB = [255, 140, 0]; // naranja
const NA = 'N/A';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;

const BLADE_LABELS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

const DEFECT_TYPE_LABELS: Record<string, string> = {
  le_erosion: 'Erosión LE',
  vortex: 'Vortex (paneles faltantes)',
  paint_defect: 'Daños de pintura',
  crack: 'Grieta',
  delamination: 'Delaminación',
  lightning_damage: 'Daño por rayo',
  other: 'Otros',
};

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

function formatDefectType(type: string): string {
  return DEFECT_TYPE_LABELS[type] || type.toUpperCase().replace(/_/g, ' ');
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

/** photos[] entry from get_repair_photos_by_stage. */
interface RpcPhoto {
  photo_id?: string;
  storage_path?: string;
  capture_order?: number;
}

/** Parse the photos[] value (array or JSON string) from a stage row. */
function parseRpcPhotos(value: unknown): RpcPhoto[] {
  if (Array.isArray(value)) return value as RpcPhoto[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as RpcPhoto[]) : [];
    } catch {
      return [];
    }
  }
  return [];
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

  // 4. Repairs / defects — via the official RPC get_repairs_for_quote. Each row is
  //    one repair (= one defect being repaired). The repair_id groups its photos.
  //    We NEVER read inspection_photo for repair evidence.
  const defects: DefectForPdf[] = [];
  const repairIds: string[] = [];
  if (campaign.quote_id) {
    const { data: repairRows, error: repErr } = await db.rpc('get_repairs_for_quote', {
      quote_id_param: campaign.quote_id,
    });
    if (repErr) throw repErr;
    for (const rr of (repairRows as unknown[]) ?? []) {
      const r = rr as Record<string, unknown>;
      const repairId = (r.repair_id as string) ?? '';
      if (!repairId) continue;
      repairIds.push(repairId);
      // The RPC groups by repair/defect. It doesn't carry a blade position or the
      // fine defect dimensions, so we default bladePosition to 1 and leave the
      // dimensional fields as N/A (rendered accordingly). id = repair_id so photos
      // group to the right damage below.
      defects.push({
        id: repairId,
        type: (r.defect_type as string) ?? 'other',
        severity: Number(r.defect_severity) || 0,
        distanceFromRoot: 0,
        widthCm: null,
        heightCm: null,
        side: null,
        description: null,
        bladePosition: 1,
      });
    }
  }

  // 5. Selected repair photos — via get_repair_photos_by_stage per repair. The RPC
  //    returns the 11 stages (in order) with a photos[] array each. Selection is
  //    stored in repair_photo.metadata.selected_for_report, which the read-only RPC
  //    doesn't expose, so we resolve it from repair_photo by photo_id. Photos are
  //    grouped to their defect via repair_id (= defect.id).
  const photos: RepairPhotoForPdf[] = [];
  if (repairIds.length > 0) {
    const stageRowsByRepair = await Promise.all(
      repairIds.map(async (repairId) => {
        const { data, error } = await db.rpc('get_repair_photos_by_stage', {
          repair_id_param: repairId,
        });
        if (error) throw error;
        return { repairId, rows: (data as unknown[]) ?? [] };
      }),
    );

    // Collect all photo ids to resolve selection in a single query.
    const candidates: RepairPhotoForPdf[] = [];
    const allPhotoIds: string[] = [];
    for (const { repairId, rows } of stageRowsByRepair) {
      for (const s of rows) {
        const stage = s as Record<string, unknown>;
        const sortOrder = Number(stage.stage_order) || 0;
        const stageCode = (stage.stage_code as string) ?? '';
        for (const p of parseRpcPhotos(stage.photos)) {
          const photoId = p.photo_id ?? '';
          if (!photoId) continue;
          allPhotoIds.push(photoId);
          candidates.push({
            photoId,
            defectId: repairId,
            stageCode,
            sortOrder,
            captureOrder: Number(p.capture_order) || 0,
            url: resolvePhotoUrl(p.storage_path ?? ''),
          });
        }
      }
    }

    // Resolve which photos are selected_for_report.
    const selectedIds = new Set<string>();
    const uniqueIds = [...new Set(allPhotoIds)];
    if (uniqueIds.length > 0) {
      const { data: metaRows } = await db
        .from('repair_photo')
        .select('id, metadata')
        .in('id', uniqueIds);
      for (const m of (metaRows as unknown[]) ?? []) {
        const r = m as Record<string, unknown>;
        const metadata = r.metadata;
        if (
          !!metadata &&
          typeof metadata === 'object' &&
          Boolean((metadata as Record<string, unknown>).selected_for_report)
        ) {
          selectedIds.add(r.id as string);
        }
      }
    }

    for (const c of candidates) {
      if (c.photoId && selectedIds.has(c.photoId)) {
        photos.push({
          defectId: c.defectId,
          stageCode: c.stageCode,
          sortOrder: c.sortOrder,
          captureOrder: c.captureOrder,
          url: c.url,
        });
      }
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

function renderCoverAndGeneral(doc: jsPDF, ctx: RepairPdfContext) {
  // Title
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
      ['Año', ctx.createdAt ? String(new Date(ctx.createdAt).getFullYear()) : NA],
      ['Fabricante', NA],
      ['Tipo de turbina', ctx.turbineModel],
      ['N° de turbina', ctx.turbineName],
      ['Horas de producción', NA],
      ['Estado turbina antes de la reparación', NA],
      ['Estado turbina después de la reparación', NA],
      ['Pala(s) en reparación', bladesInRepair],
      ['Fecha inicio (Pala A / B / C)', NA],
      ['Fecha fin (Pala A / B / C)', NA],
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

/** Renders one blade separator page + per-damage detail with selected photos. */
async function renderBladeSection(doc: jsPDF, ctx: RepairPdfContext, bladePosition: number) {
  const label = BLADE_LABELS[bladePosition] || String(bladePosition);
  const bladeDefects = ctx.defects.filter((d) => d.bladePosition === bladePosition);
  if (bladeDefects.length === 0) return;

  // Separator page
  doc.addPage();
  doc.setTextColor(...hexToRgb(COLOR_PRIMARY));
  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  doc.text(`PALA ${label}`, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  for (let i = 0; i < bladeDefects.length; i++) {
    const defect = bladeDefects[i]!;
    doc.addPage();

    // Damage header + orange category band
    let y = addSectionTitle(doc, `Pala ${label} ~ Daño #${i + 1}`, 24);
    doc.setFillColor(...COLOR_DAMAGE_BAND);
    doc.rect(MARGIN, y - 4, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Categoría del daño: ${defect.severity || NA}`, MARGIN + 3, y + 1.5);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Damage detail table
    autoTable(doc, {
      startY: y,
      head: [['Campo', 'Valor']],
      body: [
        ['Fecha', formatDateES(ctx.createdAt)],
        ['N° de aspa', ctx.turbineName],
        ['Serie del aspa', ctx.blades.find((b) => b.position === bladePosition)?.serialNumber || NA],
        ['Turbina', ctx.turbineName],
        ['Lado de Alta', NA],
        ['Lado de Baja', NA],
        ['B. Ataque', NA],
        ['B. Salida', NA],
        ['Z1', NA],
        ['Largo', defect.heightCm != null ? `${defect.heightCm} cm` : NA],
        ['Z2', NA],
        ['BA1', NA],
        ['Ancho', defect.widthCm != null ? `${defect.widthCm} cm` : NA],
        ['BA2', NA],
        ['Reparación', 'Externa'],
        ['Descripción', defect.description || `${formatDefectType(defect.type)} a ${defect.distanceFromRoot.toFixed(1)} m del eje`],
      ],
      theme: 'grid',
      headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
      margin: { left: MARGIN, right: MARGIN },
    });

    let imgY = ((doc as any).lastAutoTable?.finalY ?? y + 60) + 8;

    // Selected photos for THIS defect, filtered by defect_id and ordered by the
    // 11 repair stages. Each defect shows its own repair evidence.
    const photosForDamage = ctx.photos
      .filter((p) => p.defectId === defect.id)
      .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.captureOrder - b.captureOrder));
    if (photosForDamage.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Fotos seleccionadas de la reparación:', MARGIN, imgY);
      imgY += 6;

      let col = 0;
      for (const photo of photosForDamage) {
        const base64 = await loadImageAsBase64(photo.url);
        if (!base64) continue;
        if (imgY + 55 > PAGE_HEIGHT - 15) {
          doc.addPage();
          imgY = 20;
          col = 0;
        }
        const x = col === 0 ? MARGIN : MARGIN + 92;
        try {
          doc.addImage(base64, 'JPEG', x, imgY, 85, 50);
        } catch {
          // skip broken image
        }
        col = col === 0 ? 1 : 0;
        if (col === 0) imgY += 56;
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

  // 1. Cover + general data + blade data + findings + design
  renderCoverAndGeneral(doc, ctx);

  // 2. Per-blade sections (separator + damage detail + selected photos)
  const bladePositions = ctx.blades.length > 0
    ? ctx.blades.map((b) => b.position)
    : [...new Set(ctx.defects.map((d) => d.bladePosition))];

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
