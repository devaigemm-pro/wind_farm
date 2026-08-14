import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportPdfData {
  inspectionId: string;
  inspectionDate?: string;
  asset?: string;
  subAsset?: string;
}

interface BladeData {
  id: string;
  position: number;
  serial_number: string | null;
  length_meters: number | null;
  inspectionId: string | null;
  defects: DefectData[];
}

interface DefectData {
  id: string;
  type: string;
  severity: number;
  distance_from_root: number;
  description: string | null;
  imageUrls: string[];
}

interface TurbineInfo {
  id: string;
  name: string;
  model: string | null;
  windFarm: { id: string; name: string; location: string; latitude: number | null; longitude: number | null };
}

interface InspectorInfo {
  name: string;
  email: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

type RGB = [number, number, number];

const COLOR_PRIMARY = '#5A8F5A';
const COLOR_COVER_BG = '#5A8F5A';
const COLOR_HEADER_TABLE: RGB = [90, 143, 90];
const COLOR_CAT5: RGB = [255, 0, 0];
const COLOR_CAT4: RGB = [255, 140, 0];
const COLOR_CAT3: RGB = [255, 215, 0];
const COLOR_CAT2: RGB = [0, 166, 166];
const COLOR_CAT1: RGB = [176, 196, 222];

const SEVERITY_COLORS: Record<number, RGB> = {
  5: COLOR_CAT5,
  4: COLOR_CAT4,
  3: COLOR_CAT3,
  2: COLOR_CAT2,
  1: COLOR_CAT1,
};

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

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateES(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDefectType(type: string): string {
  return DEFECT_TYPE_LABELS[type] || type.toUpperCase().replace(/_/g, ' ');
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

async function loadImageAsBase64(url: string): Promise<string | null> {
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

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchReportData(inspectionId: string) {
  // 1. Get the inspection with blade → turbine → wind_farm
  const { data: inspection, error: inspErr } = await supabase
    .from('inspection')
    .select(`
      id, scheduled_date, completed_at, stage, status, inspector_id,
      blade:blade_id (
        id, position, serial_number, length_meters,
        turbine:turbine_id (
          id, name, model,
          wind_farm:wind_farm_id ( id, name, location, latitude, longitude )
        )
      )
    `)
    .eq('id', inspectionId)
    .single();

  if (inspErr || !inspection) throw inspErr || new Error('Inspection not found');

  const blade = inspection.blade as any;
  const turbine = blade?.turbine;
  const windFarm = turbine?.wind_farm;

  const turbineInfo: TurbineInfo = {
    id: turbine?.id || '',
    name: turbine?.name || 'N/D',
    model: turbine?.model || null,
    windFarm: {
      id: windFarm?.id || '',
      name: windFarm?.name || 'N/D',
      location: windFarm?.location || 'N/D',
      latitude: windFarm?.latitude || null,
      longitude: windFarm?.longitude || null,
    },
  };

  // 2. Get all blades of this turbine
  const { data: allBlades, error: bladesErr } = await supabase
    .from('blade')
    .select('id, position, serial_number, length_meters')
    .eq('turbine_id', turbineInfo.id)
    .order('position');

  if (bladesErr) throw bladesErr;

  // 3. Get finalized inspections for all blades of this turbine
  const bladeIds = (allBlades || []).map((b) => b.id);
  const { data: allInspections, error: allInspErr } = await supabase
    .from('inspection')
    .select('id, blade_id, scheduled_date, completed_at, stage, inspector_id')
    .in('blade_id', bladeIds)
    .eq('stage', 'report');

  if (allInspErr) throw allInspErr;

  // 4. Get defects for all relevant inspections
  const allInspIds = (allInspections || []).map((i) => i.id);
  const { data: allDefects, error: defErr } = await supabase
    .from('defect')
    .select('id, inspection_id, type, severity, distance_from_root, description')
    .in('inspection_id', allInspIds)
    .order('severity', { ascending: false });

  if (defErr) throw defErr;

  // 5. Get defect images
  const defectIds = (allDefects || []).map((d) => d.id);
  const defectImageMap: Record<string, string[]> = {};

  if (defectIds.length > 0) {
    const { data: defectImages } = await supabase
      .from('defect_image')
      .select('defect_id, evidence_id')
      .in('defect_id', defectIds);

    if (defectImages && defectImages.length > 0) {
      const evidenceIds = defectImages.map((di) => di.evidence_id);
      const { data: evidenceRows } = await supabase
        .from('evidence')
        .select('id, storage_path')
        .in('id', evidenceIds);

      const evidencePathMap: Record<string, string> = {};
      for (const ev of evidenceRows || []) {
        const { data: urlData } = supabase.storage.from('evidence').getPublicUrl(ev.storage_path);
        evidencePathMap[ev.id] = urlData.publicUrl;
      }

      for (const di of defectImages) {
        if (!defectImageMap[di.defect_id]) defectImageMap[di.defect_id] = [];
        const imgUrl = evidencePathMap[di.evidence_id];
        if (imgUrl) {
          defectImageMap[di.defect_id]!.push(imgUrl);
        }
      }
    }
  }

  // 6. Get inspector info
  const { data: inspector } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', inspection.inspector_id)
    .single();

  const inspectorInfo: InspectorInfo = {
    name: inspector?.name || 'N/D',
    email: inspector?.email || '',
  };

  // Build blade data with defects
  const bladesData: BladeData[] = (allBlades || []).map((b) => {
    const bladeInspection = (allInspections || []).find((i) => i.blade_id === b.id);
    const bladeDefects = (allDefects || [])
      .filter((d) => bladeInspection && d.inspection_id === bladeInspection.id)
      .map((d) => ({
        id: d.id,
        type: d.type,
        severity: d.severity,
        distance_from_root: d.distance_from_root,
        description: d.description,
        imageUrls: defectImageMap[d.id] || [],
      }));

    return {
      id: b.id,
      position: b.position,
      serial_number: b.serial_number,
      length_meters: b.length_meters,
      inspectionId: bladeInspection?.id || null,
      defects: bladeDefects,
    };
  });

  const inspectionDate = inspection.completed_at || inspection.scheduled_date;

  return { turbineInfo, bladesData, inspectorInfo, inspectionDate, allInspections: allInspections || [] };
}

// ─── PDF Page Helpers ─────────────────────────────────────────────────────────

function addPageHeader(doc: jsPDF, windFarmName: string, turbineName: string, date: string) {
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  const headerText = `${windFarmName} - ${turbineName}\n${date}`;
  doc.text(headerText, PAGE_WIDTH / 2, 10, { align: 'center' });
}

function addPageFooter(doc: jsPDF, currentPage: number, totalPages: number) {
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`${currentPage}/${totalPages}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' });
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  const [r, g, b] = hexToRgb(COLOR_PRIMARY);
  doc.setTextColor(r, g, b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

function addSubSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  return y + 6;
}

// ─── PDF Section Renderers ────────────────────────────────────────────────────

function renderCoverPage(
  doc: jsPDF,
  windFarmName: string,
  turbineName: string,
  turbineModel: string | null,
  bladeSerial: string,
  date: string,
) {
  // Blue background
  const [r, g, b] = hexToRgb(COLOR_COVER_BG);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

  // Overlay (darker area at top)
  doc.setFillColor(r - 20, g - 20, b - 20);
  doc.rect(0, 0, PAGE_WIDTH, 50, 'F');

  // Main title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Palas de turbina eólica', PAGE_WIDTH / 2, 90, { align: 'center' });
  doc.text('Informe de Inspección', PAGE_WIDTH / 2, 105, { align: 'center' });

  // Subtitles
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(windFarmName, PAGE_WIDTH / 2, 130, { align: 'center' });

  doc.setFontSize(12);
  const turbineLabel = `Turbina: ${turbineName}-${bladeSerial} - ${turbineModel || 'N/D'}`;
  doc.text(turbineLabel, PAGE_WIDTH / 2, 142, { align: 'center' });
  doc.text(date, PAGE_WIDTH / 2, 154, { align: 'center' });

  // Footer white band
  doc.setFillColor(255, 255, 255);
  doc.rect(0, PAGE_HEIGHT - 35, PAGE_WIDTH, 35, 'F');

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  doc.text(`Generado por ${windFarmName}`, MARGIN, PAGE_HEIGHT - 20);
  doc.text('Con tecnología CORE Insight', PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 20, { align: 'right' });

  // Environmental note
  doc.setTextColor(34, 139, 34);
  doc.setFontSize(7);
  doc.text(
    'Considere su responsabilidad medioambiental antes de imprimir este PDF',
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 10,
    { align: 'center' },
  );
}

function renderTableOfContents(doc: jsPDF, windFarmName: string, turbineName: string, date: string) {
  doc.addPage();
  addPageHeader(doc, windFarmName, turbineName, date);

  let y = addSectionTitle(doc, 'Índice', 28);
  y += 4;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);

  const tocItems = [
    { num: '1', title: 'Resumen ejecutivo', page: '3' },
    { num: '1.1', title: '  Resumen de defectos', page: '3' },
    { num: '1.2', title: '  Análisis de defectos', page: '4' },
    { num: '2', title: 'Metodología', page: '5' },
    { num: '2.1', title: '  Software de inspección', page: '5' },
    { num: '2.2', title: '  Adquisición de datos', page: '5' },
    { num: '2.3', title: '  Procesamiento de datos', page: '5' },
    { num: '2.4', title: '  Definiciones', page: '6' },
    { num: '2.5', title: '  Categorización de defectos', page: '6' },
    { num: '3', title: 'Detalles de la inspección', page: '7' },
    { num: '3.1', title: '  Resumen operativo', page: '7' },
    { num: '3.2', title: '  Detalles del informe', page: '7' },
    { num: '4', title: 'Información de la turbina', page: '8' },
    { num: '4.1', title: '  Resumen', page: '8' },
    { num: '4.2', title: '  Ubicación', page: '8' },
    { num: '4.3', title: '  Detalles de las palas', page: '8' },
    { num: '4.4', title: '  Historial de inspecciones', page: '8' },
    { num: '5', title: 'Resultados por pala', page: '9' },
  ];

  for (const item of tocItems) {
    const isMain = !item.num.includes('.');
    doc.setFont('helvetica', isMain ? 'bold' : 'normal');
    doc.text(`${item.num}  ${item.title}`, MARGIN + 4, y);
    doc.text(item.page, PAGE_WIDTH - MARGIN, y, { align: 'right' });
    y += 6;
  }
}

function renderDefectSummary(
  doc: jsPDF,
  bladesData: BladeData[],
  windFarmName: string,
  turbineName: string,
  date: string,
) {
  doc.addPage();
  addPageHeader(doc, windFarmName, turbineName, date);

  let y = addSectionTitle(doc, '1. Resumen ejecutivo', 28);
  y = addSubSectionTitle(doc, '1.1 Resumen de defectos', y + 2);
  y += 4;

  // Blade summary labels
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  for (const blade of bladesData) {
    const label = BLADE_LABELS[blade.position] || String(blade.position);
    doc.text(`Pala ${label}: ${blade.serial_number || 'S/N'}`, MARGIN, y);
    y += 5;
  }
  y += 4;

  // Summary table
  const headRow = ['Pala', 'Total', 'Cat 5', 'Cat 4', 'Cat 3', 'Cat 2', 'Cat 1'];
  const bodyRows: string[][] = bladesData.map((blade) => {
    const label = BLADE_LABELS[blade.position] || String(blade.position);
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of blade.defects) {
      if (d.severity >= 1 && d.severity <= 5) counts[d.severity] = (counts[d.severity] ?? 0) + 1;
    }
    return [
      `Pala ${label}`,
      String(blade.defects.length),
      String(counts[5]),
      String(counts[4]),
      String(counts[3]),
      String(counts[2]),
      String(counts[1]),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
    didParseCell: (hookData) => {
      if (hookData.section === 'head') {
        const colIdx = hookData.column.index;
        if (colIdx === 2) hookData.cell.styles.fillColor = [...COLOR_CAT5];
        else if (colIdx === 3) hookData.cell.styles.fillColor = [...COLOR_CAT4];
        else if (colIdx === 4) hookData.cell.styles.fillColor = [...COLOR_CAT3];
        else if (colIdx === 5) hookData.cell.styles.fillColor = [...COLOR_CAT2];
        else if (colIdx === 6) hookData.cell.styles.fillColor = [...COLOR_CAT1];
      }
    },
  });

  // Conclusions per blade
  const afterTable = (doc as any).lastAutoTable?.finalY ?? y + 40;
  let cy = afterTable + 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Conclusiones:', MARGIN, cy);
  cy += 6;
  doc.setFont('helvetica', 'normal');
  for (const blade of bladesData) {
    const label = BLADE_LABELS[blade.position] || String(blade.position);
    const conclusion = blade.defects.length === 0 ? 'Sin defectos detectados' : `${blade.defects.length} defecto(s) encontrado(s)`;
    doc.text(`Pala ${label}: ${conclusion}`, MARGIN + 4, cy);
    cy += 5;
  }
}

function renderDefectAnalysis(
  doc: jsPDF,
  bladesData: BladeData[],
  windFarmName: string,
  turbineName: string,
  date: string,
) {
  doc.addPage();
  addPageHeader(doc, windFarmName, turbineName, date);

  let y = addSubSectionTitle(doc, '1.2 Análisis de defectos', 28);
  y += 6;

  // Aggregate all defects
  const allDefects = bladesData.flatMap((b) => b.defects);
  const countByCat: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of allDefects) {
    if (d.severity >= 1 && d.severity <= 5) countByCat[d.severity] = (countByCat[d.severity] ?? 0) + 1;
  }

  // Draw horizontal color bars
  const barWidth = 150;
  const barHeight = 8;
  const barX = MARGIN;
  for (let cat = 5; cat >= 1; cat--) {
    const color = SEVERITY_COLORS[cat] || COLOR_CAT1;
    doc.setFillColor(color[0], color[1], color[2]);
    const w = allDefects.length > 0 ? ((countByCat[cat] ?? 0) / allDefects.length) * barWidth : 0;
    doc.rect(barX, y, Math.max(w, 0), barHeight, 'F');
    doc.setFontSize(7);
    doc.setTextColor(50);
    doc.text(`Cat ${cat}: ${countByCat[cat]}`, barX + barWidth + 4, y + 6);
    y += barHeight + 2;
  }
  y += 8;

  // Defects by type table
  const defectTypes = [...new Set(allDefects.map((d) => d.type))];
  const typeHeaders = ['Defectos', 'Total/Tipo', 'Cat 5', 'Cat 4', 'Cat 3', 'Cat 2', 'Cat 1'];
  const typeBody: string[][] = defectTypes.map((type) => {
    const typeDefects = allDefects.filter((d) => d.type === type);
    const cats: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of typeDefects) cats[d.severity] = (cats[d.severity] ?? 0) + 1;
    return [
      formatDefectType(type),
      String(typeDefects.length),
      String(cats[5]),
      String(cats[4]),
      String(cats[3]),
      String(cats[2]),
      String(cats[1]),
    ];
  });

  // Total row
  typeBody.push([
    'Total/Categoría',
    String(allDefects.length),
    String(countByCat[5]),
    String(countByCat[4]),
    String(countByCat[3]),
    String(countByCat[2]),
    String(countByCat[1]),
  ]);

  autoTable(doc, {
    startY: y,
    head: [typeHeaders],
    body: typeBody,
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.row.index === typeBody.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [230, 235, 240];
      }
    },
  });
}

function renderMethodology(doc: jsPDF, windFarmName: string, turbineName: string, date: string) {
  doc.addPage();
  addPageHeader(doc, windFarmName, turbineName, date);

  let y = addSectionTitle(doc, '2. Metodología', 28);

  y = addSubSectionTitle(doc, '2.1 Software de inspección', y + 4);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Este informe fue generado utilizando CORE Insight, su software interno de gestión de activos\npara las industrias solar, de construcción y eólica.',
    MARGIN,
    y + 2,
  );
  y += 16;

  y = addSubSectionTitle(doc, '2.2 Adquisición de datos', y);
  doc.setFontSize(9);
  doc.text(
    'Los datos se adquirieron mediante drones equipados con cámaras de alta resolución que\ninspeccionan cada pala de la turbina de forma autónoma, capturando imágenes desde\nmúltiples ángulos para garantizar una cobertura completa.',
    MARGIN,
    y + 2,
  );
  y += 20;

  y = addSubSectionTitle(doc, '2.3 Procesamiento de datos', y);
  doc.setFontSize(9);
  doc.text(
    'Las imágenes capturadas son procesadas mediante un pipeline de inteligencia artificial que\ndetecta, clasifica y mide automáticamente los defectos encontrados en las palas.',
    MARGIN,
    y + 2,
  );
  y += 16;

  y = addSubSectionTitle(doc, '2.4 Definiciones', y);
  y += 2;

  const defHeaders = ['Abreviatura', 'Definición'];
  const defBody = [
    ['SS', 'Suction Side (Lado de succión)'],
    ['PS', 'Pressure Side (Lado de presión)'],
    ['LE', 'Leading Edge (Borde de ataque)'],
    ['TE', 'Trailing Edge (Borde de fuga)'],
    ['SMT', 'Surface Mount Technology'],
    ['LPS', 'Lightning Protection System (Sistema de protección contra rayos)'],
  ];

  autoTable(doc, {
    startY: y,
    head: [defHeaders],
    body: defBody,
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
    margin: { left: MARGIN, right: MARGIN },
  });

  // Page 2 of methodology
  doc.addPage();
  addPageHeader(doc, windFarmName, turbineName, date);

  let y2 = addSubSectionTitle(doc, '2.5 Categorización de defectos', 28);
  y2 += 2;

  const catHeaders = ['Categoría', 'Tipo de daño', 'Acción requerida'];
  const catBody = [
    ['Categoría 5', 'Daño estructural severo', 'Acción inmediata / Parada de turbina'],
    ['Categoría 4', 'Daño significativo', 'Reparación dentro de 1 mes'],
    ['Categoría 3', 'Daño menor', 'Reparación dentro de 6 meses'],
    ['Categoría 2', 'Daño cosmético', 'Monitorizar en próxima inspección'],
    ['Categoría 1', 'Sin daño / Observación', 'Sin acción requerida'],
  ];

  autoTable(doc, {
    startY: y2,
    head: [catHeaders],
    body: catBody,
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        const rowIdx = hookData.row.index;
        const colors: RGB[] = [COLOR_CAT5, COLOR_CAT4, COLOR_CAT3, COLOR_CAT2, COLOR_CAT1];
        if (hookData.column.index === 0 && rowIdx < colors.length) {
          hookData.cell.styles.fillColor = colors[rowIdx]!;
          hookData.cell.styles.textColor = rowIdx <= 1 ? [255, 255, 255] : [0, 0, 0];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });
}

function renderInspectionDetails(
  doc: jsPDF,
  inspectorInfo: InspectorInfo,
  inspectionDate: string,
  windFarmName: string,
  turbineName: string,
  date: string,
) {
  doc.addPage();
  addPageHeader(doc, windFarmName, turbineName, date);

  let y = addSectionTitle(doc, '3. Detalles de la inspección', 28);

  y = addSubSectionTitle(doc, '3.1 Resumen operativo', y + 4);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Método', 'Inspección con dron (CORE Insight)'],
      ['Fecha/hora', formatDateES(inspectionDate)],
      ['Inspector', inspectorInfo.name],
      ['GSD medio', 'N/D'],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });

  const afterOp = (doc as any).lastAutoTable?.finalY ?? y + 40;
  let y2 = afterOp + 10;

  y2 = addSubSectionTitle(doc, '3.2 Detalles del informe', y2);
  y2 += 2;

  const now = new Date();
  autoTable(doc, {
    startY: y2,
    head: [['Campo', 'Valor']],
    body: [
      ['Fecha del informe', formatDateES(now.toISOString())],
      ['Generado por', inspectorInfo.name],
      ['Analizado por', inspectorInfo.name],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });
}

function renderTurbineInfo(
  doc: jsPDF,
  turbineInfo: TurbineInfo,
  bladesData: BladeData[],
  allInspections: any[],
  windFarmName: string,
  turbineName: string,
  date: string,
) {
  doc.addPage();
  addPageHeader(doc, windFarmName, turbineName, date);

  let y = addSectionTitle(doc, '4. Información de la turbina', 28);

  // 4.1 Resumen
  y = addSubSectionTitle(doc, '4.1 Resumen', y + 4);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Instalación', turbineInfo.windFarm.name],
      ['Turbina', turbineInfo.name],
      ['Modelo', turbineInfo.model || 'N/D'],
      ['Potencia', 'N/D'],
      ['Fecha puesta en marcha', 'N/D'],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
  });

  const after41 = (doc as any).lastAutoTable?.finalY ?? y + 40;
  let y2 = after41 + 8;

  // 4.2 Ubicación
  y2 = addSubSectionTitle(doc, '4.2 Ubicación', y2);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const lat = turbineInfo.windFarm.latitude;
  const lng = turbineInfo.windFarm.longitude;
  const locationText = lat && lng
    ? `${turbineInfo.windFarm.location} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    : turbineInfo.windFarm.location;
  doc.text(locationText, MARGIN, y2 + 2);

  // Clickable link to Google Maps over the location text
  if (lat && lng) {
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const textWidth = doc.getTextWidth(locationText);
    doc.link(MARGIN, y2 - 2, textWidth, 8, { url: googleMapsUrl });
  }

  y2 += 10;

  // 4.3 Detalles de las palas
  y2 = addSubSectionTitle(doc, '4.3 Detalles de las palas', y2);
  y2 += 2;

  const bladeHeaders = ['Pala', 'Longitud (m)', 'Nº Serie'];
  const bladeBody = bladesData.map((b) => [
    `Pala ${BLADE_LABELS[b.position] || b.position}`,
    b.length_meters != null ? String(b.length_meters) : 'N/D',
    b.serial_number || 'N/D',
  ]);

  autoTable(doc, {
    startY: y2,
    head: [bladeHeaders],
    body: bladeBody,
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
    margin: { left: MARGIN, right: MARGIN },
  });

  const after43 = (doc as any).lastAutoTable?.finalY ?? y2 + 30;
  let y3 = after43 + 8;

  // 4.4 Historial de inspecciones
  y3 = addSubSectionTitle(doc, '4.4 Historial de inspecciones', y3);
  y3 += 2;

  const histHeaders = ['Fecha', 'Método', 'Total defectos'];
  const histBody = allInspections.map((insp) => {
    const inspDate = insp.completed_at || insp.scheduled_date;
    return [
      formatDateES(inspDate),
      'Dron (CORE Insight)',
      '-', // We don't have defect counts per inspection here easily
    ];
  });

  if (histBody.length === 0) {
    histBody.push(['Sin inspecciones previas', '-', '-']);
  }

  autoTable(doc, {
    startY: y3,
    head: [histHeaders],
    body: histBody,
    theme: 'grid',
    headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
    margin: { left: MARGIN, right: MARGIN },
  });
}

async function renderBladeResults(
  doc: jsPDF,
  bladesData: BladeData[],
  windFarmName: string,
  turbineName: string,
  date: string,
) {
  for (let i = 0; i < bladesData.length; i++) {
    const blade = bladesData[i]!;
    const bladeLabel = BLADE_LABELS[blade.position] || String(blade.position);

    doc.addPage();
    addPageHeader(doc, windFarmName, turbineName, date);

    let y = addSectionTitle(doc, `5.${i + 1} Resumen de la pala ${bladeLabel} - ${blade.serial_number || 'S/N'}`, 28);
    y += 4;

    if (blade.defects.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100);
      doc.text(`Sin defectos en la pala ${bladeLabel}`, MARGIN, y);
      doc.setTextColor(0);
      continue;
    }

    // Defect summary table for this blade
    const bHeaders = ['#', 'Tipo de defecto', 'Cat.'];
    const bBody = blade.defects.map((d, idx) => [
      String(idx + 1),
      formatDefectType(d.type),
      String(d.severity),
    ]);

    autoTable(doc, {
      startY: y,
      head: [bHeaders],
      body: bBody,
      theme: 'grid',
      headStyles: { fillColor: COLOR_HEADER_TABLE, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 3 },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const sev = parseInt(hookData.cell.raw as string);
          if (sev >= 1 && sev <= 5) {
            const color = SEVERITY_COLORS[sev] || COLOR_CAT1;
            hookData.cell.styles.textColor = sev >= 4 ? [255, 255, 255] : [0, 0, 0];
            hookData.cell.styles.fillColor = color;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // Detailed defect pages
    for (let dIdx = 0; dIdx < blade.defects.length; dIdx++) {
      const defect = blade.defects[dIdx]!;
      doc.addPage();
      addPageHeader(doc, windFarmName, turbineName, date);

      const defectLabel = `Defecto #${bladeLabel}${dIdx + 1}`;
      let dy = addSectionTitle(doc, defectLabel, 28);
      dy += 4;

      // Defect data table
      const defectInfoBody = [
        ['Categoría', String(defect.severity)],
        ['Distancia del eje', `${defect.distance_from_root.toFixed(1)} m`],
        ['Lado', '-'],
        ['Tipo', formatDefectType(defect.type)],
        ['Nota', defect.description || '-'],
        ['Causa principal', '-'],
        ['Siguiente etapa', '-'],
        ['Estado', 'Detectado'],
      ];

      autoTable(doc, {
        startY: dy,
        body: defectInfoBody,
        theme: 'grid',
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 3 },
        margin: { left: MARGIN, right: MARGIN },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        didParseCell: (hookData) => {
          if (hookData.row.index === 0 && hookData.column.index === 1) {
            const sev = parseInt(hookData.cell.raw as string);
            if (sev >= 1 && sev <= 5) {
              hookData.cell.styles.fillColor = SEVERITY_COLORS[sev] || COLOR_CAT1;
              hookData.cell.styles.textColor = sev >= 4 ? [255, 255, 255] : [0, 0, 0];
              hookData.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      // Images
      const afterDefectTable = (doc as any).lastAutoTable?.finalY ?? dy + 60;
      let imgY = afterDefectTable + 8;

      if (defect.imageUrls.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Evidencia fotográfica:', MARGIN, imgY);
        imgY += 6;

        for (const url of defect.imageUrls.slice(0, 2)) {
          const base64 = await loadImageAsBase64(url);
          if (base64 && imgY + 60 < PAGE_HEIGHT - 20) {
            try {
              doc.addImage(base64, 'JPEG', MARGIN, imgY, 80, 55);
              imgY += 60;
            } catch {
              doc.setFontSize(7);
              doc.setFont('helvetica', 'italic');
              doc.text('[Imagen no disponible]', MARGIN, imgY);
              imgY += 8;
            }
          }
        }
      }
    }
  }
}

function renderEndPage(doc: jsPDF) {
  doc.addPage();
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FIN DEL INFORME', PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' });
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Generates a professional PDF report replicating the Skyvisor inspection report
 * structure and triggers download.
 */
export async function generateAndDownloadReport(data: ReportPdfData): Promise<void> {
  // Verify active session before making any queries
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
  }

  // Fetch all data from Supabase
  let reportData;
  try {
    reportData = await fetchReportData(data.inspectionId);
  } catch (err: any) {
    // Detect auth-related errors (401, 400 on auth endpoints)
    const message = err?.message || '';
    const status = err?.status || err?.code || 0;
    if (
      status === 401 ||
      status === 403 ||
      (status === 400 && /refresh_token|auth|token/i.test(message)) ||
      /expired|invalid.*token|refresh_token/i.test(message)
    ) {
      throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
    }
    throw err;
  }

  const { turbineInfo, bladesData, inspectorInfo, inspectionDate, allInspections } = reportData;

  const windFarmName = turbineInfo.windFarm.name;
  const turbineName = turbineInfo.name;
  const dateFormatted = formatDateES(inspectionDate);
  const bladeSerial = bladesData[0]?.serial_number || 'N/D';

  // Create PDF document
  const doc = new jsPDF('p', 'mm', 'a4');

  // 1. PORTADA
  renderCoverPage(doc, windFarmName, turbineName, turbineInfo.model, bladeSerial, dateFormatted);

  // 2. ÍNDICE
  renderTableOfContents(doc, windFarmName, turbineName, dateFormatted);

  // 3. RESUMEN EJECUTIVO - Resumen de defectos
  renderDefectSummary(doc, bladesData, windFarmName, turbineName, dateFormatted);

  // 4. RESUMEN EJECUTIVO - Análisis de defectos
  renderDefectAnalysis(doc, bladesData, windFarmName, turbineName, dateFormatted);

  // 5. METODOLOGÍA
  renderMethodology(doc, windFarmName, turbineName, dateFormatted);

  // 6. DETALLES DE LA INSPECCIÓN
  renderInspectionDetails(doc, inspectorInfo, inspectionDate, windFarmName, turbineName, dateFormatted);

  // 7. INFORMACIÓN DE LA TURBINA
  renderTurbineInfo(doc, turbineInfo, bladesData, allInspections, windFarmName, turbineName, dateFormatted);

  // 8. RESULTADOS POR PALA
  await renderBladeResults(doc, bladesData, windFarmName, turbineName, dateFormatted);

  // 9. FIN DEL INFORME
  renderEndPage(doc);

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i - 1, totalPages - 1);
  }

  // Download
  const filename = `Informe_${windFarmName}_${turbineName}_${dateFormatted.replace(/\//g, '-')}.pdf`;
  doc.save(filename.replace(/\s+/g, '_'));

  // Transition inspection stage to 'report' after successful PDF generation
  try {
    await supabase
      .from('inspection')
      .update({ stage: 'report' })
      .eq('id', data.inspectionId)
      .neq('stage', 'report');
  } catch (stageError) {
    console.error('[reportPdf.service] Failed to update inspection stage:', stageError);
  }
}
