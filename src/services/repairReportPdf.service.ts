import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { REPAIR_STAGES } from '@/constants/repair-stages';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepairReportData {
  campaignId: string;
}

type RGB = [number, number, number];

interface RepairPhotoForPdf {
  defectId: string | null;
  repairStage: string;
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

async function resolveSignedUrl(storagePath: string): Promise<string> {
  const bucket = storagePath.startsWith('inspection-imports/')
    ? 'asset-documents'
    : 'inspection-photos';
  const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? '';
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

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

  // 4. Defects — from the approved quote items if available, else all turbine defects.
  let defects: DefectForPdf[] = [];
  const defectIdsFromQuote: string[] = [];
  if (campaign.quote_id) {
    const { data: quoteItems } = await db
      .from('quote_item')
      .select('defect_id')
      .eq('quote_id', campaign.quote_id);
    for (const qi of (quoteItems as unknown[]) ?? []) {
      const id = (qi as Record<string, unknown>).defect_id as string | null;
      if (id) defectIdsFromQuote.push(id);
    }
  }

  // Defects link to a blade through their inspection (defect → inspection → blade).
  let defectRows: unknown[] = [];
  if (defectIdsFromQuote.length > 0) {
    const { data } = await db
      .from('defect')
      .select(`
        id, type, severity, distance_from_root, width_cm, height_cm, side, description,
        inspection:inspection ( blade:blade ( position ) )
      `)
      .in('id', defectIdsFromQuote);
    defectRows = (data as unknown[]) ?? [];
  }

  defects = defectRows.map((d) => {
    const r = d as Record<string, unknown>;
    const inspection = (r.inspection as Record<string, unknown>) ?? {};
    const blade = (inspection.blade as Record<string, unknown>) ?? {};
    return {
      id: r.id as string,
      type: (r.type as string) ?? 'other',
      severity: Number(r.severity) || 0,
      distanceFromRoot: Number(r.distance_from_root) || 0,
      widthCm: r.width_cm != null ? Number(r.width_cm) : null,
      heightCm: r.height_cm != null ? Number(r.height_cm) : null,
      side: (r.side as string) ?? null,
      description: (r.description as string) ?? null,
      bladePosition: Number(blade.position) || 1,
    };
  });

  // 5. Selected repair photos (repair_selected = true, repair_stage set),
  //    including defect_id so each defect shows its own repair evidence.
  const { data: photoRows } = await db
    .from('inspection_photo')
    .select('defect_id, repair_stage, storage_path')
    .eq('campaign_id', campaignId)
    .eq('repair_selected', true)
    .not('repair_stage', 'is', null)
    .order('uploaded_at', { ascending: true });

  const photos: RepairPhotoForPdf[] = [];
  for (const p of (photoRows as unknown[]) ?? []) {
    const r = p as Record<string, unknown>;
    const url = await resolveSignedUrl(r.storage_path as string);
    photos.push({
      defectId: (r.defect_id as string) ?? null,
      repairStage: r.repair_stage as string,
      url,
    });
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

  const stageOrder = REPAIR_STAGES.map((s) => s.key);

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
      .sort((a, b) => stageOrder.indexOf(a.repairStage) - stageOrder.indexOf(b.repairStage));
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
