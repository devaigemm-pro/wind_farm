import { useState, useMemo, useEffect, type CSSProperties } from 'react';
import { FileDown, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { savePdfBlob } from '@/utils/pdfStorage';
import type { ResultsDefect } from '@/types';

export interface ExportPanelProps {
  inspectionId: string;
  defects: ResultsDefect[];
  turbineName: string;
  windFarmName: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  inline?: boolean;
  existingReport?: { storagePath: string; generatedAt?: string; generatedBy?: string } | null;
  blades?: { position: string; serialNumber: string; id: string }[];
  bladeLength?: number;
  inspectionDate?: string;
  windFarmCoords?: { lat: number; lon: number } | null;
  windFarmId?: string;
  turbineId?: string;
  campaignId?: string;
}

// ─── PDF Color constants ─────────────────────────────────────────────────────
const PDF_COLORS = {
  coverBg: [90, 143, 90] as [number, number, number],      // #5A8F5A green
  titleBlue: [90, 143, 90] as [number, number, number],    // #5A8F5A
  green: [90, 143, 90] as [number, number, number],        // #5A8F5A
  orange: [90, 143, 90] as [number, number, number],       // #5A8F5A
  white: [255, 255, 255] as [number, number, number],
  darkText: [30, 30, 30] as [number, number, number],
  mutedText: [120, 120, 120] as [number, number, number],
  border: [200, 200, 200] as [number, number, number],
  tableHeaderGray: [90, 143, 90] as [number, number, number], // #5A8F5A for table headers
  lightBg: [245, 247, 250] as [number, number, number],   // Light gray bg
  // Category colors (severity)
  cat5: [220, 38, 38] as [number, number, number],
  cat4: [249, 115, 22] as [number, number, number],
  cat3: [234, 179, 8] as [number, number, number],
  cat2: [8, 145, 178] as [number, number, number],
  cat1: [16, 185, 129] as [number, number, number],
  lightGray: [245, 247, 250] as [number, number, number],
  headerGray: [80, 80, 80] as [number, number, number],
};

function catColor(cat: number): [number, number, number] {
  switch (cat) {
    case 5: return PDF_COLORS.cat5;
    case 4: return PDF_COLORS.cat4;
    case 3: return PDF_COLORS.cat3;
    case 2: return PDF_COLORS.cat2;
    case 1: return PDF_COLORS.cat1;
    default: return PDF_COLORS.mutedText;
  }
}

// ─── PDF Graphic Helper Types ────────────────────────────────────────────────
interface BladeDefectMarker {
  side: string;
  distanceFromRoot: number;
  cat: number;
  displayId?: string;
}

// ─── drawBladeDiagram ────────────────────────────────────────────────────────
// Draws a blade diagram with 4 vertical sections (PS, LE, SS, TE),
// a meter scale on the left, and defect markers as colored circles.
function drawBladeDiagram(
  doc: any,
  x: number,
  y: number,
  width: number,
  height: number,
  bladeLength: number,
  defects: BladeDefectMarker[],
  bladeLabel: string,
) {
  const sections = ['PS', 'LE', 'SS', 'TE'];
  const scaleMarginLeft = 12; // space for scale labels
  const labelMarginTop = 8; // space for section labels
  const diagramX = x + scaleMarginLeft;
  const diagramY = y + labelMarginTop;
  const diagramW = width - scaleMarginLeft;
  const diagramH = height - labelMarginTop;
  const sectionGap = 2;
  const sectionW = (diagramW - sectionGap * (sections.length - 1)) / sections.length;

  // Blade label above
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_COLORS.titleBlue);
  doc.text(bladeLabel, x + width / 2, y, { align: 'center' });

  // Section labels
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_COLORS.darkText);
  for (let i = 0; i < sections.length; i++) {
    const sx = diagramX + i * (sectionW + sectionGap) + sectionW / 2;
    doc.text(sections[i]!, sx, diagramY - 1, { align: 'center' });
  }

  // Draw section rectangles
  doc.setFillColor(232, 232, 232); // #E8E8E8
  doc.setDrawColor(200, 200, 200);
  for (let i = 0; i < sections.length; i++) {
    const sx = diagramX + i * (sectionW + sectionGap);
    doc.roundedRect(sx, diagramY, sectionW, diagramH, 1.5, 1.5, 'FD');
  }

  // Meter scale on the left
  doc.setFontSize(5);
  doc.setTextColor(...PDF_COLORS.mutedText);
  doc.setDrawColor(180, 180, 180);
  const steps = Math.min(Math.ceil(bladeLength / 5), 10); // show scale marks every ~5m, max 10
  const stepSize = bladeLength / steps;
  for (let i = 0; i <= steps; i++) {
    const meters = Math.round(i * stepSize);
    const sy = diagramY + (i / steps) * diagramH;
    doc.text(`${meters}m`, x, sy + 1.5, { align: 'left' });
    // Dashed line (draw dots)
    doc.setLineDashPattern([0.5, 1], 0);
    doc.line(diagramX, sy, diagramX + diagramW, sy);
  }
  doc.setLineDashPattern([], 0);

  // Defect markers
  const sideToIdx: Record<string, number> = { PS: 0, LE: 1, SS: 2, TE: 3 };
  const markerRadius = Math.min(sectionW * 0.35, 2);
  for (const d of defects) {
    const sIdx = sideToIdx[d.side] ?? 1; // default to LE
    const cx = diagramX + sIdx * (sectionW + sectionGap) + sectionW / 2;
    const cy = diagramY + (d.distanceFromRoot / bladeLength) * diagramH;
    const color = catColor(d.cat);
    doc.setFillColor(...color);
    doc.setDrawColor(...color);
    doc.circle(cx, cy, markerRadius, 'F');
  }
}

// ─── drawDonutChart ──────────────────────────────────────────────────────────
// Draws a donut chart using arcs approximated with line segments.
function drawDonutChart(
  doc: any,
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  percentage: number,
  label: string,
  color: [number, number, number],
) {
  // Draw background ring (gray)
  drawArc(doc, centerX, centerY, outerRadius, innerRadius, 0, 360, [220, 220, 220]);
  // Draw active segment
  if (percentage > 0) {
    const endAngle = (percentage / 100) * 360;
    drawArc(doc, centerX, centerY, outerRadius, innerRadius, -90, -90 + endAngle, color);
  }
  // Center label
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_COLORS.darkText);
  doc.text(label, centerX, centerY - 1, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`${Math.round(percentage)}%`, centerX, centerY + 4, { align: 'center' });
}

function drawArc(
  doc: any,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
  color: [number, number, number],
) {
  // Guard against degenerate cases
  if (startDeg === endDeg || isNaN(startDeg) || isNaN(endDeg)) return;
  if (!isFinite(startDeg) || !isFinite(endDeg)) return;

  doc.setFillColor(...color);
  doc.setDrawColor(...color);

  // Use fewer segments to avoid jsPDF stack overflow with large polygons
  const segments = 24;
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const step = (endRad - startRad) / segments;

  // Build outer points
  const outerPoints: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = startRad + i * step;
    outerPoints.push([cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle)]);
  }
  // Build inner points (reversed)
  const innerPoints: [number, number][] = [];
  for (let i = segments; i >= 0; i--) {
    const angle = startRad + i * step;
    innerPoints.push([cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle)]);
  }

  const allPoints = [...outerPoints, ...innerPoints];
  if (allPoints.length < 3) return;

  // Build moves array for doc.lines
  const startPoint = allPoints[0]!;
  const moves: [number, number][] = [];
  for (let i = 1; i < allPoints.length; i++) {
    moves.push([allPoints[i]![0] - allPoints[i - 1]![0], allPoints[i]![1] - allPoints[i - 1]![1]]);
  }
  // Close the shape
  moves.push([startPoint[0] - allPoints[allPoints.length - 1]![0], startPoint[1] - allPoints[allPoints.length - 1]![1]]);

  doc.lines(moves, startPoint[0], startPoint[1], [1, 1], 'F', true);
}

// ─── drawTurbineIcon ─────────────────────────────────────────────────────────
// Draws a stylized turbine icon (hub + 3 blades + tower)
function drawTurbineIcon(
  doc: any,
  x: number,
  y: number,
  size: number,
  color: [number, number, number],
  opacity: number,
) {
  // Set color with opacity approximation (jsPDF doesn't support true opacity on shapes,
  // so we'll blend the color with white based on opacity)
  const blended: [number, number, number] = [
    Math.round(color[0] * opacity + 255 * (1 - opacity)),
    Math.round(color[1] * opacity + 255 * (1 - opacity)),
    Math.round(color[2] * opacity + 255 * (1 - opacity)),
  ];
  doc.setFillColor(...blended);
  doc.setDrawColor(...blended);

  // Tower (thin trapezoid)
  const towerW = size * 0.06;
  const towerH = size * 0.4;
  const towerX = x - towerW / 2;
  const towerY = y;
  doc.rect(towerX, towerY, towerW, towerH, 'F');

  // Hub (circle at top of tower)
  const hubR = size * 0.04;
  doc.circle(x, y, hubR, 'F');

  // Blades (3 elongated ellipses radiating from hub)
  const bladeLen = size * 0.45;
  const bladeW = size * 0.04;
  const angles = [90, 210, 330]; // degrees from center
  for (const angleDeg of angles) {
    const angleRad = (angleDeg * Math.PI) / 180;
    // Draw blade as a series of small rectangles along the angle
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const dist = (i / segments) * bladeLen;
      const w = bladeW * (1 - i / segments * 0.7); // taper
      const bx = x + dist * Math.cos(angleRad);
      const by = y - dist * Math.sin(angleRad);
      // Rotated rectangle approximation with a small circle
      doc.circle(bx, by, w / 2, 'F');
    }
  }
}

// ─── drawMapPlaceholder ──────────────────────────────────────────────────────
// Draws a placeholder map rectangle with location marker and coordinates
function drawMapPlaceholder(
  doc: any,
  x: number,
  y: number,
  width: number,
  height: number,
  windFarmName: string,
  coords: { lat: number; lon: number } | null,
) {
  // Background
  doc.setFillColor(235, 242, 248);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');

  // Grid lines to simulate map
  doc.setDrawColor(210, 225, 235);
  doc.setLineDashPattern([1, 2], 0);
  const gridSpacing = 10;
  for (let gx = x + gridSpacing; gx < x + width; gx += gridSpacing) {
    doc.line(gx, y, gx, y + height);
  }
  for (let gy = y + gridSpacing; gy < y + height; gy += gridSpacing) {
    doc.line(x, gy, x + width, gy);
  }
  doc.setLineDashPattern([], 0);

  // Location marker in center
  const markerX = x + width / 2;
  const markerY = y + height / 2 - 5;
  // Pin body (teardrop shape via circle + triangle)
  doc.setFillColor(44, 124, 181); // blue marker
  doc.setDrawColor(44, 124, 181);
  doc.circle(markerX, markerY, 4, 'F');
  // Small triangle below the circle to form pin point
  const triPoints: [number, number][] = [
    [markerX - 2.5, markerY + 2],
    [markerX + 2.5, markerY + 2],
    [markerX, markerY + 7],
  ];
  const triMoves: [number, number][] = [
    [triPoints[1]![0] - triPoints[0]![0], triPoints[1]![1] - triPoints[0]![1]],
    [triPoints[2]![0] - triPoints[1]![0], triPoints[2]![1] - triPoints[1]![1]],
    [triPoints[0]![0] - triPoints[2]![0], triPoints[0]![1] - triPoints[2]![1]],
  ];
  doc.lines(triMoves, triPoints[0]![0], triPoints[0]![1], [1, 1], 'F', true);
  // White dot in center of pin
  doc.setFillColor(255, 255, 255);
  doc.circle(markerX, markerY, 1.5, 'F');

  // Wind farm name
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_COLORS.darkText);
  doc.text(windFarmName, x + width / 2, y + height - 14, { align: 'center' });

  // Coordinates
  if (coords) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.mutedText);
    doc.text(`${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`, x + width / 2, y + height - 8, { align: 'center' });
  }

  // Clickable link to Google Maps over the entire map area
  if (coords) {
    const googleMapsUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lon}`;
    doc.link(x, y, width, height, { url: googleMapsUrl });
  }
}

// ─── drawBladeProfile ────────────────────────────────────────────────────────
// Draws a lateral blade profile (tapered vertical shape) with a defect marker
function drawBladeProfile(
  doc: any,
  x: number,
  y: number,
  height: number,
  bladeLength: number,
  defect: BladeDefectMarker,
) {
  const topW = 4; // width at root (bottom visually = 0m)
  const tipW = 1; // width at tip (top visually)
  // Blade as vertical trapezoid (0m at top, bladeLength at bottom)
  // We draw 0m at top, so root is top and tip is bottom
  doc.setFillColor(210, 220, 230);
  doc.setDrawColor(180, 190, 200);

  // Trapezoid points: top-left, top-right, bottom-right, bottom-left
  const tl: [number, number] = [x - topW / 2, y];
  const tr: [number, number] = [x + topW / 2, y];
  const br: [number, number] = [x + tipW / 2, y + height];
  const bl: [number, number] = [x - tipW / 2, y + height];

  const moves: [number, number][] = [
    [tr[0] - tl[0], tr[1] - tl[1]],
    [br[0] - tr[0], br[1] - tr[1]],
    [bl[0] - br[0], bl[1] - br[1]],
    [tl[0] - bl[0], tl[1] - bl[1]],
  ];
  doc.lines(moves, tl[0], tl[1], [1, 1], 'FD', true);

  // Defect marker
  const defectY = y + (defect.distanceFromRoot / bladeLength) * height;
  const widthAtDist = topW - (topW - tipW) * (defect.distanceFromRoot / bladeLength);
  doc.setFillColor(...catColor(defect.cat));
  doc.circle(x, defectY, Math.max(widthAtDist * 0.4, 1.2), 'F');

  // Side label at top
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_COLORS.darkText);
  doc.text(defect.side, x, y - 2, { align: 'center' });

  // Airfoil cross-section at bottom (small ellipse)
  doc.setFillColor(210, 220, 230);
  doc.setDrawColor(180, 190, 200);
  doc.ellipse(x, y + height + 5, 3, 1.2, 'FD');
}

// ─── i18n texts ──────────────────────────────────────────────────────────────
const texts = {
  en: {
    coverTitle: 'Wind Turbine Blades\nInspection Report',
    generatedBy: 'Generated by',
    withTech: 'With technology',
    envNote: 'Please consider your environmental responsibility before printing this PDF',
    toc: 'Table of Contents',
    execSummary: '1. EXECUTIVE SUMMARY',
    defectSummary: '1.1. Defect Summary',
    defectAnalysis: '1.2. Defect Analysis',
    methodology: '2. METHODOLOGY',
    methodSoftware: '2.1 Inspection Software',
    methodAcquisition: '2.2 Data Acquisition',
    methodProcessing: '2.3 Data Processing',
    methodDefinitions: '2.4 Definitions',
    methodCategorization: '2.5 Categorization',
    inspectionDetails: '3. INSPECTION DETAILS',
    opSummary: '3.1 Operational Summary',
    reportDetails: '3.2 Report Details',
    turbineInfo: '4. TURBINE INFORMATION',
    turbineSummary: '4.1 Summary',
    bladeDetails: '4.3 Blade Details',
    inspHistory: '4.4 Inspection History',
    results: '5. RESULTS BY BLADE',
    bladeSummary: 'Blade summary',
    defect: 'Defect',
    endReport: 'END OF REPORT',
    blade: 'Blade',
    totalDefects: 'Total defects',
    type: 'Defect type',
    category: 'Category',
    side: 'Side',
    distance: 'Distance from hub',
    size: 'Defect size',
    note: 'Note',
    rootCause: 'Root cause',
    nextStep: 'Next step',
    status: 'Status',
    resolved: 'Resolved',
    unresolved: 'Unresolved',
    inspMethod: 'Inspection method',
    inspectedOn: 'Inspected on',
    inspectedBy: 'Inspected by',
    avgGSD: 'Average GSD',
    reportDate: 'Report date',
    generatedByLabel: 'Generated by',
    analyzedBy: 'Analyzed by',
    installName: 'Installation name',
    turbine: 'Turbine',
    serialNumber: 'Serial number',
    model: 'Model',
    totalPower: 'Total power',
    commissionDate: 'Commission date',
    manufacturer: 'Manufacturer/Type',
    length: 'Length',
    noDefects: 'No defects on blade',
  },
  es: {
    coverTitle: 'Palas de turbina eólica\nInforme de Inspección',
    generatedBy: 'Generado por',
    withTech: 'Con tecnología',
    envNote: 'Considere su responsabilidad medioambiental antes de imprimir este PDF',
    toc: 'Índice',
    execSummary: '1. RESUMEN EJECUTIVO',
    defectSummary: '1.1. Resumen de defectos',
    defectAnalysis: '1.2. Análisis de defectos',
    methodology: '2. METODOLOGÍA',
    methodSoftware: '2.1 Software de inspección',
    methodAcquisition: '2.2 Adquisición de datos',
    methodProcessing: '2.3 Procesamiento de datos',
    methodDefinitions: '2.4 Definiciones',
    methodCategorization: '2.5 Categorización',
    inspectionDetails: '3. DETALLES DE LA INSPECCIÓN',
    opSummary: '3.1 Resumen Operativo',
    reportDetails: '3.2 Detalles del informe',
    turbineInfo: '4. INFORMACIÓN DE LA TURBINA',
    turbineSummary: '4.1 Resumen',
    bladeDetails: '4.3 Detalles de las palas',
    inspHistory: '4.4 Historial de inspecciones',
    results: '5. RESULTADOS POR PALA',
    bladeSummary: 'Resumen de la pala',
    defect: 'Defecto',
    endReport: 'FIN DEL INFORME',
    blade: 'Pala',
    totalDefects: 'Defectos totales',
    type: 'Tipo de defecto',
    category: 'Categoría',
    side: 'Lado',
    distance: 'Distancia del eje',
    size: 'Tamaño del defecto',
    note: 'Nota',
    rootCause: 'Causa principal',
    nextStep: 'Siguiente etapa',
    status: 'Estado',
    resolved: 'Resuelto',
    unresolved: 'No resuelto',
    inspMethod: 'Método de inspección',
    inspectedOn: 'Inspeccionado en',
    inspectedBy: 'Inspeccionado por',
    avgGSD: 'GSD medio',
    reportDate: 'Fecha del informe',
    generatedByLabel: 'Generado por',
    analyzedBy: 'Analizado por',
    installName: 'Nombre de la instalación',
    turbine: 'Turbina',
    serialNumber: 'Número de serie',
    model: 'Modelo',
    totalPower: 'Potencia total',
    commissionDate: 'Fecha puesta en marcha',
    manufacturer: 'Fabricante/Tipo',
    length: 'Longitud',
    noDefects: 'Sin defectos en la pala',
  },
};

/** Convert SVG text to a PNG base64 data URI via Canvas API */
async function svgToBase64Png(svgText: string, width: number, height: number): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = new Image();
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { reject(new Error('SVG load timeout')); }, 8000);
      img.onload = () => { clearTimeout(timeout); resolve(); };
      img.onerror = () => { clearTimeout(timeout); reject(new Error('SVG load failed')); };
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function generateCSV(defects: ResultsDefect[], windFarmName: string, turbineName: string, photoUrls: Map<string, string>) {
  const header =
    'ID,Type,Category,Blade,Side,Distance from Root (m),Width (cm),Height (cm),Resolved,Description,Photo URL\n';
  const rows = defects
    .map(
      (d) => {
        const photoUrl = photoUrls.get(d.id) || '';
        return `${d.displayId},${d.type},${d.severity},${d.blade},${d.side},${d.distanceFromRoot},${d.widthCm || ''},${d.heightCm || ''},${d.resolved},"${(d.description || '').replace(/"/g, '""')}","${photoUrl}"`;
      },
    )
    .join('\n');
  const csv = header + rows;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Defects_${windFarmName}_${turbineName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// (Defect images now come from the real evidence in the database)

/** Fetch an image URL and convert to base64 ArrayBuffer for ExcelJS */
async function fetchImageAsBuffer(url: string): Promise<{ buffer: ArrayBuffer; extension: 'png' | 'jpeg' } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    const buffer = await resp.arrayBuffer();

    // SVGs need to be converted to PNG via canvas
    if (contentType.includes('svg') || url.endsWith('.svg')) {
      const svgBlob = new Blob([buffer], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = svgUrl;
      });
      ctx.drawImage(img, 0, 0, 200, 150);
      URL.revokeObjectURL(svgUrl);
      const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!pngBlob) return null;
      return { buffer: await pngBlob.arrayBuffer(), extension: 'png' };
    }

    if (contentType.includes('png')) return { buffer, extension: 'png' };
    return { buffer, extension: 'jpeg' };
  } catch {
    return null;
  }
}

/** Load the CORE Insight logo PNG for embedding in XLSX */
async function renderLogoPng(): Promise<ArrayBuffer | null> {
  try {
    const resp = await fetch('/core-insight-logo.png');
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}

/** Generate XLSX with embedded images */
async function generateXLSX(defects: ResultsDefect[], windFarmName: string, turbineName: string, includePhotos = true) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Defects');

  // Remove default grid lines
  sheet.views = [{ showGridLines: false }];

  const origin = window.location.origin;

  // Merge cells for logo area so image doesn't split across column borders
  sheet.mergeCells(includePhotos ? 'A1:K2' : 'A1:J2');

  // Add logo at the top (loaded from core-insight-logo.png)
  const logoBuffer = await renderLogoPng();
  if (logoBuffer) {
    const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
    sheet.addImage(logoId, {
      tl: { col: 0.2, row: 0.2 },
      ext: { width: 240, height: 80 },
    });
  }

  // Set row heights for logo area
  sheet.getRow(1).height = 45;
  sheet.getRow(2).height = 30;

  // Row 3: spacing
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.getRow(3).height = 8;

  // Title row (row 4)
  const titleRow = sheet.addRow([`Defects Report - ${windFarmName} - ${turbineName}`]);
  titleRow.font = { bold: true, size: 13, color: { argb: 'FF5A8F5A' } };
  titleRow.height = 22;
  sheet.addRow([]); // row 5 spacing

  // Set column widths
  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 24;
  sheet.getColumn(3).width = 10;
  sheet.getColumn(4).width = 7;
  sheet.getColumn(5).width = 6;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 11;
  sheet.getColumn(8).width = 11;
  sheet.getColumn(9).width = 9;
  sheet.getColumn(10).width = 35;
  if (includePhotos) sheet.getColumn(11).width = 28;

  // Header row (row 6)
  const headers = includePhotos
    ? ['ID', 'Type', 'Category', 'Blade', 'Side', 'Distance (m)', 'Width (cm)', 'Height (cm)', 'Resolved', 'Description', 'Photo']
    : ['ID', 'Type', 'Category', 'Blade', 'Side', 'Distance (m)', 'Width (cm)', 'Height (cm)', 'Resolved', 'Description'];
  const headerRow = sheet.addRow(headers);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A8F5A' } };
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {};
  });

  // Add data rows and embed images
  const dataStartRow = sheet.rowCount + 1;
  for (let i = 0; i < defects.length; i++) {
    const d = defects[i]!;
    const rowData = [
      d.displayId,
      d.type,
      d.severity,
      d.blade,
      d.side,
      d.distanceFromRoot,
      d.widthCm ?? '',
      d.heightCm ?? '',
      d.resolved ? 'Yes' : 'No',
      d.description ?? '',
    ];
    if (includePhotos) rowData.push('');
    const row = sheet.addRow(rowData);
    row.height = includePhotos ? 75 : 22;
    row.alignment = { vertical: 'middle' };
    // No borders on cells
    row.eachCell((cell) => { cell.border = {}; });

    // Fetch and embed defect image
    if (includePhotos) {
      const imgPath = d.images?.[0] ?? null;
      const imgData = imgPath ? await fetchImageAsBuffer(imgPath) : null;
      if (imgData) {
        const imageId = workbook.addImage({ buffer: imgData.buffer, extension: imgData.extension });
        const rowIdx = dataStartRow + i - 1;
        sheet.addImage(imageId, {
          tl: { col: 10, row: rowIdx },
          ext: { width: 150, height: 90 },
        });
      }
    }
  }

  // Protect the header area (rows 1-7) - by default all cells are locked when sheet is protected
  // Only UNLOCK cells from row 8 onwards (data rows) so they can be edited
  for (let r = 8; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const colCount = includePhotos ? 11 : 10;
    for (let c = 1; c <= colCount; c++) {
      row.getCell(c).protection = { locked: false };
    }
  }
  // Enable sheet protection directly (no password needed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sheet as any).sheetProtection = { sheet: true, objects: true, scenarios: true };

  // Generate and download
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Defects_${windFarmName}_${turbineName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  return blob;
}

/** Image data with dimensions for proper aspect ratio rendering in PDF */
interface ImageWithDims {
  dataUrl: string;
  width: number;
  height: number;
}

/** Try to load an image from URL as base64 data URI with its dimensions */
async function loadImageAsBase64(url: string): Promise<ImageWithDims | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const blob = await resp.blob();
    if (blob.size < 1000) return null;

    // Resize image via canvas to avoid jsPDF rendering issues with large images
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 6000);
      const img = new Image();
      const blobUrl = URL.createObjectURL(blob);
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const MAX_W = 1200;
          const MAX_H = 900;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
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
          resolve({ dataUrl, width: w, height: h });
        } catch {
          URL.revokeObjectURL(blobUrl);
          resolve(null);
        }
      };
      img.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(blobUrl); resolve(null); };
      img.src = blobUrl;
    });
  } catch {
    return null;
  }
}

export function ExportPanel({
  inspectionId,
  defects,
  turbineName,
  windFarmName,
  open,
  onClose,
  inline,
  blades,
  bladeLength,
  inspectionDate,
  windFarmCoords,
  windFarmId,
  turbineId,
  campaignId,
}: ExportPanelProps) {
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [resolvedFilter, setResolvedFilter] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5]),
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [typesInitialized, setTypesInitialized] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingXlsx, setIsGeneratingXlsx] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

  // Cleanup blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  // Sections collapsed state
  const [resolvedOpen, setResolvedOpen] = useState(true);
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [typeOpen, setTypeOpen] = useState(true);

  // Compute available categories and types from defects
  const { categoryCounts, availableTypes } = useMemo(() => {
    const catCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const types = new Set<string>();
    for (const d of defects) {
      catCounts[d.severity] = (catCounts[d.severity] || 0) + 1;
      types.add(d.type);
    }
    return { categoryCounts: catCounts, availableTypes: Array.from(types).sort() };
  }, [defects]);

  // Initialize selectedTypes once when availableTypes are computed
  if (!typesInitialized && availableTypes.length > 0) {
    setSelectedTypes(new Set(availableTypes));
    setTypesInitialized(true);
  }

  const toggleCategory = (cat: number) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    setGenerateError(null);

    // Transition inspection stage to 'report' immediately
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (userId) {
        // Insert report record — DB trigger will change stage to 'report'
        await (supabase as any).from('report').insert({
          reference_id: inspectionId,
          type: 'inspection',
          generated_by: userId,
          generated_at: new Date().toISOString(),
          filename: `report_${inspectionId}.pdf`,
          storage_path: `reports/${inspectionId}/${Date.now()}.pdf`,
        });
      }
    } catch (e) {
      console.error('[ExportPanel] report insert error:', e);
    }

    try {
      // Filter defects based on current selections
      let filtered = [...defects];
      if (resolvedFilter === 'resolved') filtered = filtered.filter((d) => d.resolved);
      if (resolvedFilter === 'unresolved') filtered = filtered.filter((d) => !d.resolved);
      filtered = filtered.filter((d) => selectedCategories.has(d.severity));
      filtered = filtered.filter((d) => selectedTypes.has(d.type));

      const t = texts[language];
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      // Load blade SVG and convert to PNG once
      const bladeSvgText = await fetch('/blade.svg').then((r) => r.text()).catch(() => null);
      const bladePng = bladeSvgText ? await svgToBase64Png(bladeSvgText, 200, 940) : null;

      // App base URL for clickable links
      const appBaseUrl = 'https://wind-farm-eight.vercel.app';

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth(); // 210
      const pageH = doc.internal.pageSize.getHeight(); // 297
      const margin = 20;
      const contentW = pageW - margin * 2;
      let pageNum = 0;

      const now = new Date();
      const dateStr = inspectionDate
        ? new Date(inspectionDate).toLocaleDateString(language === 'es' ? 'es-CL' : 'en-US')
        : now.toLocaleDateString(language === 'es' ? 'es-CL' : 'en-US');
      const nowStr = now.toLocaleDateString(language === 'es' ? 'es-CL' : 'en-US');

      const bladeSerials: Record<string, string> = {};
      if (blades) {
        for (const b of blades) {
          bladeSerials[b.position] = b.serialNumber;
        }
      }
      const primarySerial = bladeSerials['A'] || 'N/A';

      // Helper: add header/footer to internal pages
      const addHeaderFooter = (pg: number) => {
        // Header
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.mutedText);
        const headerText = `${windFarmName} - ${turbineName}`;
        doc.text(headerText, pageW / 2, 12, { align: 'center' });
        doc.setFontSize(8);
        doc.text(dateStr, pageW / 2, 17, { align: 'center' });
        // Footer
        doc.setDrawColor(...PDF_COLORS.border);
        doc.line(margin, pageH - 16, pageW - margin, pageH - 16);
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.mutedText);
        doc.text(windFarmName, margin, pageH - 10);
        doc.text(`${pg}`, pageW / 2, pageH - 10, { align: 'center' });
        doc.text('CORE Insight', pageW - margin, pageH - 10, { align: 'right' });
      };

      const newPage = () => {
        doc.addPage();
        pageNum++;
        addHeaderFooter(pageNum);
      };

      const sectionTitle = (title: string, y: number): number => {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_COLORS.titleBlue);
        doc.text(title, margin, y);
        return y + 8;
      };

      const subTitle = (title: string, y: number): number => {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_COLORS.titleBlue);
        doc.text(title, margin, y);
        return y + 7;
      };

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 1: Cover
      // ═══════════════════════════════════════════════════════════════════════
      pageNum = 1;
      // Cover background: portada.jpeg as full-page background + green overlay
      let coverImageLoaded = false;
      try {
        const portadaImg = new Image();
        portadaImg.crossOrigin = 'anonymous';
        const portadaLoaded = await new Promise<boolean>((resolve) => {
          portadaImg.onload = () => resolve(true);
          portadaImg.onerror = () => resolve(false);
          portadaImg.src = '/portada.jpeg';
        });
        if (portadaLoaded && portadaImg.naturalWidth > 0) {
          // Draw image to canvas with green overlay baked in
          const canvas = document.createElement('canvas');
          canvas.width = portadaImg.naturalWidth;
          canvas.height = portadaImg.naturalHeight;
          const ctx = canvas.getContext('2d')!;
          // Draw the original image
          ctx.drawImage(portadaImg, 0, 0);
          
          // Draw green scan beam from the drone to the turbine hub
          // From evidence: drone at center-right ~55%x 60%y, hub at upper-center ~42%x 30%y
          const cw = canvas.width;
          const ch = canvas.height;
          const droneX = cw * 0.55;  // drone position
          const droneY = ch * 0.60;
          const hubX = cw * 0.42;    // turbine hub
          const hubY = ch * 0.30;
          const beamWidth = cw * 0.08; // beam spread at target (hub)
          
          // Draw cone beam from drone (point) expanding toward hub
          const gradient = ctx.createLinearGradient(droneX, droneY, hubX, hubY);
          gradient.addColorStop(0, 'rgba(0, 230, 60, 0.85)');
          gradient.addColorStop(0.3, 'rgba(0, 210, 50, 0.5)');
          gradient.addColorStop(0.7, 'rgba(0, 200, 40, 0.25)');
          gradient.addColorStop(1, 'rgba(0, 180, 30, 0.08)');
          
          // Calculate perpendicular offset for beam width at hub
          const dx = hubX - droneX;
          const dy = hubY - droneY;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len; // perpendicular normal
          const ny = dx / len;
          
          ctx.beginPath();
          ctx.moveTo(droneX, droneY); // point source at drone
          ctx.lineTo(hubX + nx * beamWidth, hubY + ny * beamWidth);
          ctx.lineTo(hubX - nx * beamWidth, hubY - ny * beamWidth);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();
          
          // Beam edge lines
          ctx.strokeStyle = 'rgba(0, 230, 60, 0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(droneX, droneY);
          ctx.lineTo(hubX + nx * beamWidth, hubY + ny * beamWidth);
          ctx.moveTo(droneX, droneY);
          ctx.lineTo(hubX - nx * beamWidth, hubY - ny * beamWidth);
          ctx.stroke();

          // Apply green overlay with opacity
          ctx.fillStyle = 'rgba(90, 143, 90, 0.55)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          // Convert to JPEG base64
          const coverBase64 = canvas.toDataURL('image/jpeg', 0.92);
          // Add as full cover page background
          doc.addImage(coverBase64, 'JPEG', 0, 0, pageW, pageH);
          coverImageLoaded = true;
        }
      } catch (e) {
        console.warn('[ExportPanel] Could not load portada.jpeg:', e);
      }

      if (!coverImageLoaded) {
        // Fallback: solid green color
        doc.setFillColor(...PDF_COLORS.coverBg);
        doc.rect(0, 0, pageW, pageH * 0.7, 'F');
      }

      // Logo in top-left corner
      const logoPng = await renderLogoPng();
      if (logoPng) {
        const bytes = new Uint8Array(logoPng);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        const logoBase64 = 'data:image/png;base64,' + btoa(binary);
        doc.addImage(logoBase64, 'PNG', margin, 15, 60, 20);
      }

      // (Cover decoration removed for clean minimalist style)

      // Title — right-aligned, starting from middle of page downward
      doc.setFontSize(30);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_COLORS.white);
      const titleLines = t.coverTitle.split('\n');
      let titleY = pageH * 0.73;
      for (const line of titleLines) {
        doc.text(line, pageW - margin, titleY, { align: 'right' });
        titleY += 11;
      }

      // Subtitle info — right-aligned, tight below title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.white);
      doc.text(windFarmName, pageW - margin, titleY + 6, { align: 'right' });
      doc.text(`${t.turbine}: ${turbineName} - ${primarySerial}`, pageW - margin, titleY + 14, { align: 'right' });
      doc.text(dateStr, pageW - margin, titleY + 22, { align: 'right' });

      // Footer section — white text at page bottom
      const footerStartY = pageH - 15;
      doc.setFontSize(11);
      doc.setTextColor(...PDF_COLORS.white);
      doc.text(t.generatedBy, margin + 10, footerStartY);
      doc.text(windFarmName, margin + 10, footerStartY + 5);
      doc.text(t.withTech, pageW - margin - 10, footerStartY, { align: 'right' });
      doc.text('CORE Insight', pageW - margin - 10, footerStartY + 5, { align: 'right' });

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 2: Table of Contents
      // ═══════════════════════════════════════════════════════════════════════
      newPage();
      let y = 28;
      y = sectionTitle(t.toc, y);
      y += 10;

      // Professional TOC with dot leaders and section numbers
      // We'll track actual page numbers and fill them in after generation
      const tocPageRef: Record<string, number> = {};
      const tocSections = [
        { level: 0, num: '1', text: language === 'es' ? 'Resumen Ejecutivo' : 'Executive Summary' },
        { level: 1, num: '1.1', text: language === 'es' ? 'Resumen de defectos' : 'Defect Summary' },
        { level: 1, num: '1.2', text: language === 'es' ? 'Análisis de defectos' : 'Defect Analysis' },
        { level: 0, num: '2', text: language === 'es' ? 'Metodología' : 'Methodology' },
        { level: 1, num: '2.1', text: language === 'es' ? 'Software de inspección' : 'Inspection Software' },
        { level: 1, num: '2.2', text: language === 'es' ? 'Adquisición de datos' : 'Data Acquisition' },
        { level: 1, num: '2.3', text: language === 'es' ? 'Procesamiento de datos' : 'Data Processing' },
        { level: 1, num: '2.4', text: language === 'es' ? 'Definiciones' : 'Definitions' },
        { level: 1, num: '2.5', text: language === 'es' ? 'Categorización' : 'Categorization' },
        { level: 0, num: '3', text: language === 'es' ? 'Detalles de la inspección' : 'Inspection Details' },
        { level: 0, num: '4', text: language === 'es' ? 'Información de la turbina' : 'Turbine Information' },
        { level: 0, num: '5', text: language === 'es' ? 'Resultados por pala' : 'Results by Blade' },
      ];

      for (const item of tocSections) {
        const indent = item.level === 0 ? 0 : 10;
        const fontSize = item.level === 0 ? 11 : 9.5;
        const fontStyle = item.level === 0 ? 'bold' : 'normal';

        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        doc.setTextColor(...(item.level === 0 ? PDF_COLORS.titleBlue : PDF_COLORS.darkText));

        // Number
        doc.text(item.num, margin + indent, y);
        // Text
        doc.text(item.text, margin + indent + 12, y);

        // Dot leader line
        const textEndX = margin + indent + 12 + doc.getTextWidth(item.text) + 3;
        const lineEndX = pageW - margin - 10;
        doc.setDrawColor(...PDF_COLORS.border);
        doc.setLineDashPattern([0.5, 1.5], 0);
        doc.line(textEndX, y, lineEndX, y);
        doc.setLineDashPattern([], 0);

        // Page number on the right (will be based on section order — pages start at 3)
        const pageOffset = 3; // Cover=1, TOC=2, content starts at 3
        let sectionPage = pageOffset;
        if (item.num.startsWith('1')) sectionPage = 3;
        if (item.num.startsWith('2')) sectionPage = 5;
        if (item.num.startsWith('3')) sectionPage = 6;
        if (item.num.startsWith('4')) sectionPage = 7;
        if (item.num.startsWith('5')) sectionPage = 8;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        doc.setTextColor(...(item.level === 0 ? PDF_COLORS.titleBlue : PDF_COLORS.darkText));
        doc.text(String(sectionPage), pageW - margin, y, { align: 'right' });

        y += item.level === 0 ? 10 : 7;
      }

      // Separator line at bottom of TOC
      y += 5;
      doc.setDrawColor(...PDF_COLORS.green);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      doc.setLineWidth(0.2);

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 3: 1. Executive Summary - 1.1 Defect Summary
      // ═══════════════════════════════════════════════════════════════════════
      newPage();
      y = 28;
      y = sectionTitle(t.execSummary, y);
      y = subTitle(t.defectSummary, y + 2);
      y += 4;

      // Per-blade summary table
      const bladeLetters = ['A', 'B', 'C'];
      const bladeSummaryRows = bladeLetters.map((bl) => {
        const bladeDefects = filtered.filter((d) => d.blade === bl);
        return [
          `${t.blade} ${bl}`,
          String(bladeDefects.length),
          String(bladeDefects.filter((d) => d.severity === 5).length),
          String(bladeDefects.filter((d) => d.severity === 4).length),
          String(bladeDefects.filter((d) => d.severity === 3).length),
          String(bladeDefects.filter((d) => d.severity === 2).length),
          String(bladeDefects.filter((d) => d.severity === 1).length),
        ];
      });
      // Total row
      bladeSummaryRows.push([
        'Total',
        String(filtered.length),
        String(filtered.filter((d) => d.severity === 5).length),
        String(filtered.filter((d) => d.severity === 4).length),
        String(filtered.filter((d) => d.severity === 3).length),
        String(filtered.filter((d) => d.severity === 2).length),
        String(filtered.filter((d) => d.severity === 1).length),
      ]);

      autoTable(doc, {
        startY: y,
        head: [[t.blade, t.totalDefects, 'Cat 5', 'Cat 4', 'Cat 3', 'Cat 2', 'Cat 1']],
        body: bladeSummaryRows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: PDF_COLORS.tableHeaderGray, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          2: { fillColor: [255, 235, 235] },
          3: { fillColor: [255, 243, 230] },
          4: { fillColor: [255, 250, 230] },
          5: { fillColor: [230, 248, 250] },
          6: { fillColor: [230, 250, 245] },
        },
        margin: { left: margin, right: margin },
      });

      // Blade diagrams (3 small blades side by side using bladePng)
      const tableEndY = (doc as any).lastAutoTable?.finalY || y + 40;
      const diagramStartY = tableEndY + 10;
      const diagramH = 90;
      const diagramW = (contentW - 16) / 3; // 3 columns with 8mm gap between
      const bLen = bladeLength || 43;
      for (let i = 0; i < bladeLetters.length; i++) {
        const bl = bladeLetters[i]!;
        const blDefects = filtered.filter((d) => d.blade === bl).map((d) => ({
          side: d.side,
          distanceFromRoot: d.distanceFromRoot ?? 0,
          cat: d.severity,
          displayId: d.displayId,
        }));
        const dX = margin + i * (diagramW + 8);

        // Blade label above
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_COLORS.titleBlue);
        doc.text(`${t.blade} ${bl}`, dX + diagramW / 2, diagramStartY - 2, { align: 'center' });

        if (bladePng) {
          // Use real blade SVG (maintain aspect ratio within diagramH)
          const imgW = diagramH / 4.7; // aspect ratio from SVG viewBox
          const imgX = dX + (diagramW - imgW) / 2;
          doc.addImage(bladePng, 'PNG', imgX, diagramStartY, imgW, diagramH);
          // Defect markers
          for (const dm of blDefects) {
            const markerY = diagramStartY + (dm.distanceFromRoot / bLen) * diagramH;
            const color = catColor(dm.cat);
            doc.setFillColor(...color);
            doc.setDrawColor(...color);
            doc.circle(imgX + imgW / 2, markerY, 1.5, 'F');
          }
        } else {
          drawBladeDiagram(doc, dX, diagramStartY, diagramW, diagramH, bLen, blDefects, '');
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 4: 1.2 Defect Analysis
      // ═══════════════════════════════════════════════════════════════════════
      newPage();
      y = 28;
      y = subTitle(t.defectAnalysis, y);
      y += 4;

      // Category badges with counts
      doc.setFontSize(9);
      let badgeX = margin;
      for (let cat = 5; cat >= 1; cat--) {
        const count = filtered.filter((d) => d.severity === cat).length;
        const color = catColor(cat);
        doc.setFillColor(...color);
        doc.roundedRect(badgeX, y, 30, 10, 2, 2, 'F');
        doc.setTextColor(...PDF_COLORS.white);
        doc.setFont('helvetica', 'bold');
        doc.text(`Cat ${cat}: ${count}`, badgeX + 15, y + 6.5, { align: 'center' });
        badgeX += 34;
      }
      y += 18;

      // Donut charts per blade
      const donutY = y + 5;
      const donutSpacing = contentW / 3;
      const totalDefectsCount = filtered.length;
      for (let i = 0; i < bladeLetters.length; i++) {
        const bl = bladeLetters[i]!;
        const blCount = filtered.filter((d) => d.blade === bl).length;
        const cx = margin + donutSpacing * i + donutSpacing / 2;
        const cy = donutY + 18;
        if (blCount === 0) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...PDF_COLORS.mutedText);
          doc.text(`${t.noDefects} ${bl}`, cx, cy, { align: 'center' });
        } else {
          const pct = totalDefectsCount > 0 ? (blCount / totalDefectsCount) * 100 : 0;
          drawDonutChart(doc, cx, cy, 14, 8, pct, `${t.blade} ${bl}`, PDF_COLORS.orange);
        }
      }
      y = donutY + 42;

      // Type by category table
      doc.setTextColor(...PDF_COLORS.darkText);
      const typeMap: Record<string, Record<number, number>> = {};
      for (const d of filtered) {
        if (!typeMap[d.type]) typeMap[d.type] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        typeMap[d.type]![d.severity] = (typeMap[d.type]![d.severity] || 0) + 1;
      }
      const typeRows = Object.entries(typeMap).map(([type, cats]) => {
        const total = Object.values(cats).reduce((a, b) => a + b, 0);
        return [type, String(total), String(cats[5] || 0), String(cats[4] || 0), String(cats[3] || 0), String(cats[2] || 0), String(cats[1] || 0)];
      });

      autoTable(doc, {
        startY: y,
        head: [[t.type, 'Total', 'Cat 5', 'Cat 4', 'Cat 3', 'Cat 2', 'Cat 1']],
        body: typeRows,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: PDF_COLORS.tableHeaderGray, textColor: 255, fontStyle: 'bold' },
        margin: { left: margin, right: margin },
      });

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 5: 2. Methodology
      // ═══════════════════════════════════════════════════════════════════════
      newPage();
      y = 28;
      y = sectionTitle(t.methodology, y);
      y += 2;

      // 2.1
      y = subTitle(t.methodSoftware, y);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.darkText);
      const softwareText = language === 'es'
        ? 'CORE Insight es una plataforma de software para la inspección digital de palas de aerogeneradores que utiliza drones para detecta defectos estructurales.'
        : 'CORE Insight is a software platform for digital wind turbine blade inspection that uses drones to detect structural defects.';
      const lines1 = doc.splitTextToSize(softwareText, contentW);
      doc.text(lines1, margin, y);
      y += lines1.length * 4.5 + 6;

      // 2.2
      y = subTitle(t.methodAcquisition, y);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.darkText);
      const acqText = language === 'es'
        ? 'Los datos se adquieren mediante vuelos de dron planificados con rutas de vuelo optimizadas para capturar todas las superficies de las palas con alta resolución.'
        : 'Data is acquired through planned drone flights with optimized flight paths to capture all blade surfaces at high resolution.';
      const lines2 = doc.splitTextToSize(acqText, contentW);
      doc.text(lines2, margin, y);
      y += lines2.length * 4.5 + 6;

      // 2.3
      y = subTitle(t.methodProcessing, y);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.darkText);
      const procText = language === 'es'
        ? 'El procesamiento de datos incluye la detección de defectos mediante inspección, revisión y validación por parte de ingenieros certificados.'
        : 'Data processing includes defect detection through inspection, review and validation by certified engineers.';
      const lines3 = doc.splitTextToSize(procText, contentW);
      doc.text(lines3, margin, y);
      y += lines3.length * 4.5 + 8;

      // 2.4 Definitions table
      y = subTitle(t.methodDefinitions, y);
      const defRows = language === 'es'
        ? [
            ['SS', 'Lado de succión (Suction Side)'],
            ['PS', 'Lado de presión (Pressure Side)'],
            ['LE', 'Borde de ataque (Leading Edge)'],
            ['TE', 'Borde de fuga (Trailing Edge)'],
            ['SMT', 'Montaje superior (Surface Mount)'],
            ['LPS', 'Sistema de protección contra rayos'],
          ]
        : [
            ['SS', 'Suction Side'],
            ['PS', 'Pressure Side'],
            ['LE', 'Leading Edge'],
            ['TE', 'Trailing Edge'],
            ['SMT', 'Surface Mount'],
            ['LPS', 'Lightning Protection System'],
          ];

      autoTable(doc, {
        startY: y,
        head: [[language === 'es' ? 'Término' : 'Term', language === 'es' ? 'Definición' : 'Definition']],
        body: defRows,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: PDF_COLORS.tableHeaderGray, textColor: 255, fontStyle: 'bold' },
        margin: { left: margin, right: margin },
        tableWidth: contentW * 0.7,
      });
      y = (doc as any).lastAutoTable?.finalY + 8 || y + 50;

      // 2.5 Categorization table
      if (y > pageH - 80) { newPage(); y = 28; }
      y = subTitle(t.methodCategorization, y);
      const catRows = language === 'es'
        ? [
            ['1', 'Cosmetica', 'Daño superficial sin impacto estructural', 'Turbina continua en operación. Sin acción requerida.'],
            ['2', 'Menor', 'Daño menor con bajo riesgo', 'Turbina continua en operación. Planificar solo si hay otros daños a reparar. En caso de no realizar reparación, monitorear anualmente.'],
            ['3', 'Moderada', 'Daño menor, sin compromiso estructural.', 'Turbina continua en operación. Planificar reparacion de daños en los proximos 3 meses. En caso de no realizar reparación, monitorear cada 3 meses.'],
            ['4', 'Mayor', 'Daño significativo sin compromiso de operación de la turbina durante los proximos 3 meses. Requiere pronta atención.', 'Turbina continua en operación. Requiere soporte tecnico especializado de palas y planificar reparacion de daños inmediata. En caso de no realizar reparacion, monitorear mensualmente.'],
            ['5', 'Critico', 'Daño severo que requiere accion inmediata.', 'Detener inmediata el Aerogenerador. ¡Seguridad no garantizada! Reparación urgente.'],
          ]
        : [
            ['1', 'Cosmetic', 'Superficial damage with no structural impact', 'Turbine continues in operation. No action required.'],
            ['2', 'Minor', 'Minor damage with low risk', 'Turbine continues in operation. Plan only if there are other damages to repair. If no repair, monitor annually.'],
            ['3', 'Moderate', 'Minor damage, no structural compromise.', 'Turbine continues in operation. Plan damage repair within 3 months. If no repair, monitor every 3 months.'],
            ['4', 'Major', 'Significant damage without compromising turbine operation for the next 3 months. Requires prompt attention.', 'Turbine continues in operation. Requires specialized blade technical support and plan immediate damage repair. If no repair, monitor monthly.'],
            ['5', 'Critical', 'Severe damage requiring immediate action.', 'Immediately stop the Wind Turbine. Safety not guaranteed! Urgent repair.'],
          ];

      autoTable(doc, {
        startY: y,
        head: [['Cat', language === 'es' ? 'Severidad' : 'Severity', language === 'es' ? 'Tipo de daño' : 'Damage type', language === 'es' ? 'Acción requerida' : 'Required action']],
        body: catRows,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: PDF_COLORS.tableHeaderGray, textColor: 255, fontStyle: 'bold' },
        bodyStyles: { textColor: [0, 0, 0] },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            const catNum = parseInt(data.row.raw[0] as string, 10);
            // Row colors from reference image: teal 1-2, amber 3, orange 4, red 5
            const rowColors: Record<number, [number, number, number]> = {
              1: [0, 139, 148],    // teal/cyan
              2: [0, 139, 148],    // teal/cyan
              3: [255, 179, 0],    // amber/gold
              4: [255, 140, 0],    // orange
              5: [255, 0, 0],      // red
            };
            if (rowColors[catNum]) {
              data.cell.styles.fillColor = rowColors[catNum];
              data.cell.styles.textColor = [255, 255, 255];
            }
            if (data.column.index === 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 14;
            }
            if (data.column.index === 1) {
              data.cell.styles.fontStyle = 'bold';
            }
          }
          if (data.section === 'head') {
            data.cell.styles.fillColor = [160, 160, 160];
            data.cell.styles.textColor = [255, 255, 255];
          }
        },
        margin: { left: margin, right: margin },
      });

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 6: 3. Inspection Details
      // ═══════════════════════════════════════════════════════════════════════
      newPage();
      y = 28;
      y = sectionTitle(t.inspectionDetails, y);
      y += 2;

      // 3.1 Operational Summary
      y = subTitle(t.opSummary, y);
      autoTable(doc, {
        startY: y,
        body: [
          [t.inspMethod, 'CORE Insight'],
          [t.inspectedOn, dateStr],
          [t.inspectedBy, 'Inspector'],
          [t.avgGSD, '0.07 cm/pixel'],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
        margin: { left: margin, right: margin },
        tableWidth: contentW * 0.7,
        theme: 'grid',
      });
      y = (doc as any).lastAutoTable?.finalY + 12 || y + 40;

      // 3.2 Report Details
      // Get current user's full name from auth metadata
      let userFullName = 'Inspector';
      try {
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user) {
          const meta = authUser.user.user_metadata || {};
          // Try full_name, then name, then construct from first/last
          if (meta.full_name) {
            userFullName = meta.full_name;
          } else if (meta.name) {
            userFullName = meta.name;
          } else if (meta.first_name || meta.last_name) {
            userFullName = `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
          }
          // Only fall back to email if nothing else available
          if (userFullName === 'Inspector' && authUser.user.email) {
            userFullName = authUser.user.email.split('@')[0] || authUser.user.email;
          }
        }
      } catch { /* fallback to 'Inspector' */ }

      y = subTitle(t.reportDetails, y);
      autoTable(doc, {
        startY: y,
        body: [
          [t.reportDate, nowStr],
          [t.generatedByLabel, userFullName],
          [t.analyzedBy, userFullName],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
        margin: { left: margin, right: margin },
        tableWidth: contentW * 0.7,
        theme: 'grid',
      });

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 7: 4. Turbine Information
      // ═══════════════════════════════════════════════════════════════════════
      newPage();
      y = 28;
      y = sectionTitle(t.turbineInfo, y);
      y += 2;

      // 4.1 Summary — fetch turbine model, power, commission date
      let turbineModel = 'N/A';
      let turbinePower = 'N/A';
      let turbineCommission = 'N/A';
      if (turbineId) {
        try {
          const { data: tData } = await (supabase as any)
            .from('turbine')
            .select('model, power_kw, powering_date')
            .eq('id', turbineId)
            .single();
          if (tData) {
            if (tData.model) turbineModel = tData.model;
            if (tData.power_kw) turbinePower = `${tData.power_kw} kW`;
            if (tData.powering_date) turbineCommission = new Date(tData.powering_date).toLocaleDateString(language === 'es' ? 'es-CL' : 'en-US');
          }
        } catch { /* fallback to N/A */ }
      }

      y = subTitle(t.turbineSummary, y);
      autoTable(doc, {
        startY: y,
        body: [
          [t.installName, windFarmName],
          [t.turbine, turbineName],
          [t.serialNumber, primarySerial],
          [t.model, turbineModel],
          [t.totalPower, turbinePower],
          [t.commissionDate, turbineCommission],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
        margin: { left: margin, right: margin },
        tableWidth: contentW * 0.7,
        theme: 'grid',
      });
      y = (doc as any).lastAutoTable?.finalY + 12 || y + 50;

      // 4.2 Location (terrain map with turbine icon + Google Maps link)
      const locationTitle = language === 'es' ? '4.2 Ubicación' : '4.2 Location';
      y = subTitle(locationTitle, y);
      const mapH = 65;
      if (windFarmCoords) {
        // Generate a terrain map by compositing OSM tiles on canvas
        let mapLoaded = false;
        try {
          const zoom = 13;
          const lat = windFarmCoords.lat;
          const lon = windFarmCoords.lon;
          // Convert lat/lon to tile coords
          const n = Math.pow(2, zoom);
          const xtile = Math.floor((lon + 180) / 360 * n);
          const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
          
          // Load a 4x3 grid of tiles for a wider terrain view
          const tileSize = 256;
          const gridW = 4;
          const gridH = 3;
          const canvas = document.createElement('canvas');
          canvas.width = tileSize * gridW;
          canvas.height = tileSize * gridH;
          const ctx = canvas.getContext('2d')!;
          
          const tilePromises: Promise<void>[] = [];
          for (let dx = -2; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const tx = xtile + dx;
              const ty = ytile + dy;
              const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
              tilePromises.push(new Promise<void>((resolve) => {
                const tileImg = new Image();
                tileImg.crossOrigin = 'anonymous';
                tileImg.onload = () => {
                  ctx.drawImage(tileImg, (dx + 2) * tileSize, (dy + 1) * tileSize);
                  resolve();
                };
                tileImg.onerror = () => resolve();
                tileImg.src = tileUrl;
              }));
            }
          }
          await Promise.race([Promise.all(tilePromises), new Promise(r => setTimeout(r, 10000))]);
          
          // Draw wind turbine icon at center
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          const turbineScale = 2.5;
          ctx.save();
          ctx.translate(cx, cy);
          // Tower
          ctx.strokeStyle = '#1565C0';
          ctx.lineWidth = 3 * turbineScale;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, 18 * turbineScale);
          ctx.stroke();
          // Hub
          ctx.fillStyle = '#1565C0';
          ctx.beginPath();
          ctx.arc(0, 0, 3 * turbineScale, 0, Math.PI * 2);
          ctx.fill();
          // 3 blades (120° apart)
          ctx.strokeStyle = '#1565C0';
          ctx.lineWidth = 2.5 * turbineScale;
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const angle = (i * 120 - 90) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * 16 * turbineScale, Math.sin(angle) * 16 * turbineScale);
            ctx.stroke();
          }
          ctx.restore();
          
          const mapBase64 = canvas.toDataURL('image/jpeg', 0.88);
          if (canvas.width > 100) {
            doc.addImage(mapBase64, 'JPEG', margin, y, contentW, mapH);
            mapLoaded = true;
          }
        } catch { /* fallback */ }
        if (!mapLoaded) {
          drawMapPlaceholder(doc, margin, y, contentW, mapH, windFarmName, windFarmCoords);
        }
        y += mapH + 3;
        // Google Maps clickable link
        const gmapsUrl = `https://www.google.com/maps?q=${windFarmCoords.lat},${windFarmCoords.lon}&z=14&t=k`;
        const linkLabel = language === 'es' ? 'Ver ubicación en Google Maps' : 'View location on Google Maps';
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 100, 200);
        doc.text(linkLabel, margin, y);
        const linkW = doc.getTextWidth(linkLabel);
        doc.link(margin, y - 4, linkW, 5, { url: gmapsUrl });
        doc.setTextColor(...PDF_COLORS.darkText);
        y += 10;
      } else {
        drawMapPlaceholder(doc, margin, y, contentW, mapH, windFarmName, null);
        y += mapH + 10;
      }

      // 4.3 Blade Details
      y = subTitle(t.bladeDetails, y);
      const bladeDetailRows = [
        [t.manufacturer, 'N/A'],
        [t.length, `${bladeLength || 43}m`],
        [`${t.blade} A`, bladeSerials['A'] || 'N/A'],
        [`${t.blade} B`, bladeSerials['B'] || 'N/A'],
        [`${t.blade} C`, bladeSerials['C'] || 'N/A'],
      ];
      autoTable(doc, {
        startY: y,
        body: bladeDetailRows,
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
        margin: { left: margin, right: margin },
        tableWidth: contentW * 0.7,
        theme: 'grid',
      });
      y = (doc as any).lastAutoTable?.finalY + 12 || y + 40;

      // 4.4 Inspection History
      y = subTitle(t.inspHistory, y);
      autoTable(doc, {
        startY: y,
        head: [[language === 'es' ? 'Fecha' : 'Date', t.totalDefects]],
        body: [[dateStr, String(filtered.length)]],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: PDF_COLORS.tableHeaderGray, textColor: 255, fontStyle: 'bold' },
        margin: { left: margin, right: margin },
        tableWidth: contentW * 0.5,
      });

      // ═══════════════════════════════════════════════════════════════════════
      // PAGES 8+: 5. Results by Blade
      // ═══════════════════════════════════════════════════════════════════════
      newPage();
      y = 28;
      y = sectionTitle(t.results, y);
      y += 4;

      // Clickable link to app Results view
      if (windFarmId && turbineId) {
        const resultsUrl = `${appBaseUrl}/inspections/${inspectionId}/workflow?step=4`;
        const linkText = language === 'es' ? 'Ver todos los defectos en CORE Insight' : 'View all defects in CORE Insight';
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 166, 255);
        doc.text(linkText, margin, y);
        const linkTextW = doc.getTextWidth(linkText);
        doc.link(margin, y - 4, linkTextW, 5, { url: resultsUrl });
        doc.setTextColor(...PDF_COLORS.darkText);
        y += 8;
      }

      let bladeIdx = 1;
      for (const bl of bladeLetters) {
        const bladeDefects = filtered.filter((d) => d.blade === bl);
        const serial = bladeSerials[bl] || 'N/A';

        if (y > pageH - 160) { newPage(); y = 28; }

        // Blade header
        y = subTitle(`5.${bladeIdx}. ${t.bladeSummary} ${bl} - ${serial}`, y);
        y += 2;

        if (bladeDefects.length === 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...PDF_COLORS.mutedText);
          doc.text(`${t.noDefects} ${bl}`, margin, y);
          y += 10;
        } else {
          // Blade SVG on the left (use rasterized bladePng with correct aspect ratio)
          const blDefMarkers = bladeDefects.map((d) => ({
            side: d.side,
            distanceFromRoot: d.distanceFromRoot ?? 0,
            cat: d.severity,
            displayId: d.displayId,
          }));
          // Cap diagram height to available space on page (pageH - y - footer margin)
          const availableH = pageH - y - 25;
          const diagramH = Math.min(availableH, Math.min(140, bladeDefects.length * 15 + 50));
          const bladeW = Math.min(25, diagramH / 4.7); // maintain SVG aspect ratio, max 25mm wide

          if (bladePng) {
            // Blade label above
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...PDF_COLORS.titleBlue);
            doc.text(`${t.blade} ${bl}`, margin + bladeW / 2, y - 2, { align: 'center' });
            // Draw blade image with correct aspect ratio
            doc.addImage(bladePng, 'PNG', margin, y, bladeW, diagramH);
            // Defect markers
            for (const dm of blDefMarkers) {
              const markerY = y + (dm.distanceFromRoot / (bladeLength || 43)) * diagramH;
              const color = catColor(dm.cat);
              doc.setFillColor(...color);
              doc.setDrawColor(...color);
              doc.circle(margin + bladeW / 2, markerY, 2, 'F');
            }
          } else {
            drawBladeDiagram(doc, margin, y, 40, diagramH, bladeLength || 43, blDefMarkers, `${t.blade} ${bl}`);
          }

          // Defects summary table for this blade (to the right of the blade)
          const bladeTableRows = bladeDefects.map((d, i) => [
            String(i + 1),
            d.displayId,
            d.type,
            String(d.severity),
            d.side,
            `${d.distanceFromRoot?.toFixed(1) ?? '-'} m`,
          ]);

          autoTable(doc, {
            startY: y,
            head: [['#', 'ID', t.type, 'Cat.', t.side, t.distance]],
            body: bladeTableRows,
            styles: { fontSize: 8, cellPadding: 2.5 },
            headStyles: { fillColor: PDF_COLORS.tableHeaderGray, textColor: 255, fontStyle: 'bold' },
            didParseCell: (data: any) => {
              if (data.section === 'body' && data.column.index === 3) {
                const catNum = parseInt(data.cell.raw as string, 10);
                if (catNum >= 1 && catNum <= 5) {
                  data.cell.styles.fillColor = catColor(catNum);
                  data.cell.styles.textColor = [255, 255, 255];
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            },
            margin: { left: margin + bladeW + 8, right: margin },
          });
          const tableBottom = (doc as any).lastAutoTable?.finalY || y + 30;
          y = Math.max(tableBottom, y + diagramH) + 8;
        }
        bladeIdx++;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Defect Details (if includeDetails is ON)
      // ═══════════════════════════════════════════════════════════════════════
      if (includeDetails) {
        // Pre-load defect images: fetch signed URLs from DB in batch, then download in parallel
        const imageCache: Record<string, ImageWithDims> = {};
        try {
          const annotIds = filtered.map(d => d.id).filter(Boolean);
          if (annotIds.length > 0) {
            // Step 1: Get thumbnail_ids for all annotations
            const { data: annots } = await supabase
              .from('annotation')
              .select('id, thumbnail_id')
              .in('id', annotIds);

            if (annots && annots.length > 0) {
              const thumbIds = annots.map(a => a.thumbnail_id).filter(Boolean) as string[];
              if (thumbIds.length > 0) {
                // Step 2: Get storage paths for all photos
                const { data: photos } = await (supabase as any)
                  .from('inspection_photo')
                  .select('id, storage_path')
                  .in('id', thumbIds);

                if (photos && photos.length > 0) {
                  const photoMap: Record<string, string> = {};
                  for (const p of photos) if (p.storage_path) photoMap[p.id] = p.storage_path;

                  // Step 3: Generate signed URLs in batch
                  const assetPaths = Object.values(photoMap).filter((p: string) => p.startsWith('inspection-imports/'));
                  const inspPaths = Object.values(photoMap).filter((p: string) => !p.startsWith('inspection-imports/'));
                  const signedMap: Record<string, string> = {};

                  const [aRes, iRes] = await Promise.all([
                    assetPaths.length > 0 ? supabase.storage.from('asset-documents').createSignedUrls(assetPaths, 600) : { data: null },
                    inspPaths.length > 0 ? supabase.storage.from('inspection-photos').createSignedUrls(inspPaths, 600) : { data: null },
                  ]);
                  if (aRes.data) aRes.data.forEach((item: any, i: number) => { if (item?.signedUrl && !item.error) signedMap[assetPaths[i]!] = item.signedUrl; });
                  if (iRes.data) iRes.data.forEach((item: any, i: number) => { if (item?.signedUrl && !item.error) signedMap[inspPaths[i]!] = item.signedUrl; });

                  // Step 4: Map annotation_id → signed URL
                  const annotUrlMap: Record<string, string> = {};
                  for (const a of annots) {
                    if (a.thumbnail_id && photoMap[a.thumbnail_id]) {
                      const url = signedMap[photoMap[a.thumbnail_id]!];
                      if (url) annotUrlMap[a.id] = url;
                    }
                  }

                  // Step 5: Download all images in parallel with 15s global timeout
                  const entries = Object.entries(annotUrlMap);
                  if (entries.length > 0) {
                    await Promise.race([
                      Promise.allSettled(entries.map(async ([annotId, url]) => {
                        const imgData = await loadImageAsBase64(url);
                        if (imgData) imageCache[annotId] = imgData;
                      })),
                      new Promise(resolve => setTimeout(resolve, 30000)),
                    ]);
                  }
                }
              }
            }
          }
        } catch {
          // Continue without images if anything fails
        }

        // Also try d.images as fallback (for when photoPathMap had valid URLs)
        for (const d of filtered) {
          if (!imageCache[d.id] && d.images && d.images.length > 0 && d.images[0]!.startsWith('http')) {
            try {
              const imgData = await loadImageAsBase64(d.images[0]!);
              if (imgData) imageCache[d.id] = imgData;
            } catch { /* skip */ }
          }
        }

        for (const d of filtered) {
          // Ensure enough space for defect info + image together (~150mm needed)
          if (y > pageH - 150) { newPage(); y = 28; }

          // Defect header in green accent
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...PDF_COLORS.green);
          doc.text(`${t.defect} #${d.displayId}`, margin, y);
          y += 7;

          // Blade image on the left + info table on the right (using bladePng)
          const profileH = 55;
          const profileX = margin;

          if (bladePng) {
            const bImgW = 12;
            const bImgH = profileH;
            doc.addImage(bladePng, 'PNG', profileX, y, bImgW, bImgH);
            // Defect marker on blade image
            const defectMarkerY = y + ((d.distanceFromRoot ?? 0) / (bladeLength || 43)) * bImgH;
            const defectColor = catColor(d.severity);
            doc.setFillColor(...defectColor);
            doc.setDrawColor(...defectColor);
            doc.circle(profileX + bImgW / 2, defectMarkerY, 1.5, 'F');
          }

          // Info table (shifted right to make room for blade)
          const tableLeftMargin = margin + 18;
          const sizeStr = (d.widthCm && d.heightCm)
            ? `${d.widthCm} x ${d.heightCm} cm`
            : '-';
          const detailRows = [
            [t.category, String(d.severity)],
            [t.side, d.side],
            [t.type, d.type],
            [t.distance, `${d.distanceFromRoot?.toFixed(1) ?? '-'} m`],
            [t.size, sizeStr],
          ];
          if (d.notes) detailRows.push([t.note, d.notes]);
          if (d.rootCause) detailRows.push([t.rootCause, d.rootCause]);
          if (d.nextStep) detailRows.push([t.nextStep, d.nextStep]);
          detailRows.push([t.status, d.resolved ? t.resolved : t.unresolved]);

          autoTable(doc, {
            startY: y,
            body: detailRows,
            styles: { fontSize: 8, cellPadding: 2.5 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
            margin: { left: tableLeftMargin, right: margin },
            tableWidth: contentW - (tableLeftMargin - margin),
            theme: 'grid',
            didParseCell: (data: any) => {
              // Color the category value cell
              if (data.section === 'body' && data.row.index === 0 && data.column.index === 1) {
                const catNum = parseInt(data.cell.raw as string, 10);
                if (catNum >= 1 && catNum <= 5) {
                  data.cell.styles.fillColor = catColor(catNum);
                  data.cell.styles.textColor = [255, 255, 255];
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            },
          });
          const detailTableEnd = (doc as any).lastAutoTable?.finalY || y + 40;
          y = Math.max(detailTableEnd, y + profileH + 5) + 5;

          // Clickable link per defect
          if (windFarmId && turbineId) {
            const defectUrl = `${appBaseUrl}/inspections/${inspectionId}/workflow?step=4&tab=details&defectId=${d.displayId}`;
            const defectLinkText = language === 'es'
              ? 'Ver más información sobre este defecto en CORE Insight'
              : 'View more information about this defect in CORE Insight';
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(0, 166, 255);
            doc.text(defectLinkText, tableLeftMargin, y);
            const defectLinkW = doc.getTextWidth(defectLinkText);
            doc.link(tableLeftMargin, y - 4, defectLinkW, 5, { url: defectUrl });
            doc.setTextColor(...PDF_COLORS.darkText);
            doc.setFont('helvetica', 'normal');
            y += 7;
          }

          // Use pre-loaded image from cache
          const cachedImg = imageCache[d.id];
          if (cachedImg) {
            // Calculate dimensions preserving aspect ratio within a bounding box
            const maxImgW = contentW * 0.9;
            const maxImgH = 120; // max height in mm
            const aspectRatio = cachedImg.width / cachedImg.height;
            let imgW = maxImgW;
            let imgH = imgW / aspectRatio;
            if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * aspectRatio; }
            const imgX = margin + (contentW - imgW) / 2;
            if (y + imgH > pageH - 20) { newPage(); y = 28; }
            doc.setDrawColor(200, 200, 200);
            doc.roundedRect(imgX - 1, y - 1, imgW + 2, imgH + 2, 2, 2, 'S');

            // Draw image with annotation overlay baked in using canvas
            try {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              const imgLoaded = await new Promise<boolean>((resolve) => {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = cachedImg.dataUrl;
              });
              if (imgLoaded && img.naturalWidth > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);

                // Draw annotation overlay (red rectangle based on annotation coords)
                // Get annotation data for this defect
                const annId = d.id;
                try {
                  const { data: annData } = await supabase
                    .from('annotation')
                    .select('x, y, w, h, angle, note')
                    .eq('id', annId)
                    .single();
                  if (annData && annData.x && annData.y && annData.w) {
                    const cw = canvas.width;
                    const ch = canvas.height;
                    ctx.strokeStyle = '#FF3300';
                    ctx.lineWidth = Math.max(3, cw * 0.004);
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';

                    if (annData.note && annData.note.startsWith('[pencil]')) {
                      // Pencil annotation: draw polyline
                      try {
                        const pointsJson = annData.note.replace('[pencil]', '').split('|||')[0] || '[]';
                        const points: { x: number; y: number }[] = JSON.parse(pointsJson);
                        if (points.length >= 2) {
                          ctx.beginPath();
                          ctx.moveTo(points[0]!.x / 100 * cw, points[0]!.y / 100 * ch);
                          for (let i = 1; i < points.length; i++) {
                            ctx.lineTo(points[i]!.x / 100 * cw, points[i]!.y / 100 * ch);
                          }
                          ctx.stroke();
                        }
                      } catch { /* skip */ }
                    } else {
                      // Rectangle annotation: draw rotated rect
                      // Coordinates: x,y = center (%), w = line length (%), h = perpendicular width (%)
                      // In AnnotateStep SVG: x% = fraction of container width, y% = fraction of container height
                      // On canvas: convert each axis independently (x→cw, y→ch) like the SVG does
                      const rad = (annData.angle || 0) * (Math.PI / 180);
                      const halfW = annData.w / 2; // in % units
                      const halfH = (annData.h || 3) / 2; // in % units
                      // Center in pixels
                      const centerX = (annData.x / 100) * cw;
                      const centerY = (annData.y / 100) * ch;
                      // Start/end of line axis (cos component → x-axis %, sin component → y-axis %)
                      const cosR = Math.cos(rad);
                      const sinR = Math.sin(rad);
                      const startX = centerX - (halfW * cosR / 100) * cw;
                      const startY = centerY - (halfW * sinR / 100) * ch;
                      const endX = centerX + (halfW * cosR / 100) * cw;
                      const endY = centerY + (halfW * sinR / 100) * ch;
                      // Normal vector components (perpendicular to line) — also split by axis
                      const nxPx = (-sinR * halfH / 100) * cw;
                      const nyPx = (cosR * halfH / 100) * ch;
                      // 4 corners
                      const p1x = startX + nxPx; const p1y = startY + nyPx;
                      const p2x = endX + nxPx; const p2y = endY + nyPx;
                      const p3x = endX - nxPx; const p3y = endY - nyPx;
                      const p4x = startX - nxPx; const p4y = startY - nyPx;
                      ctx.beginPath();
                      ctx.moveTo(p1x, p1y);
                      ctx.lineTo(p2x, p2y);
                      ctx.lineTo(p3x, p3y);
                      ctx.lineTo(p4x, p4y);
                      ctx.closePath();
                      ctx.stroke();
                    }
                  }
                } catch { /* skip annotation overlay if query fails */ }

                const finalBase64 = canvas.toDataURL('image/jpeg', 0.90);
                doc.addImage(finalBase64, 'JPEG', imgX, y, imgW, imgH);
              } else {
                doc.addImage(cachedImg.dataUrl, 'JPEG', imgX, y, imgW, imgH);
              }
            } catch {
              doc.addImage(cachedImg.dataUrl, 'JPEG', imgX, y, imgW, imgH);
            }
            y += imgH + 5;
          }

          y += 5;
          y += 5;
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // LAST PAGE: End of Report
      // ═══════════════════════════════════════════════════════════════════════
      newPage();
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_COLORS.titleBlue);
      doc.text(t.endReport, pageW / 2, pageH / 2, { align: 'center' });

      // Generate blob URL for download
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(url);
      setLastGeneratedAt(new Date().toLocaleString());
      setIsGenerating(false);

      // Background operations (don't block UI)
      (async () => {
        try { await savePdfBlob(inspectionId, blob); } catch { /* ignore */ }
        try {
          await (supabase as any).from('inspection')
            .update({ stage: 'report' })
            .eq('id', inspectionId)
            .neq('stage', 'report');

          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;
          if (userId) {
            const filename = `Inspection_${windFarmName}_${turbineName}_${Date.now()}.pdf`;
            const storagePath = `${inspectionId}/${filename}`;

            let finalStoragePath: string | null = null;
            const { error: uploadError } = await supabase.storage
              .from('reports')
              .upload(storagePath, blob, { contentType: 'application/pdf', upsert: false });
            if (!uploadError) finalStoragePath = storagePath;

            await (supabase as any).from('report').insert({
              reference_id: inspectionId,
              type: 'inspection',
              generated_by: userId,
              generated_at: new Date().toISOString(),
              filename,
              storage_path: finalStoragePath || `pending/${inspectionId}/${filename}`,
            });
          }
        } catch { /* silent */ }
      })();
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate PDF');
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (pdfBlobUrl) {
      // Open PDF in a new browser tab so clicks on links inside (e.g. Google Maps)
      // navigate that tab — not the main app tab
      window.open(pdfBlobUrl, '_blank');
    }
  };

  const handleDownloadCSV = async () => {
    setIsGeneratingXlsx(true);
    try {
      const blob = await generateXLSX(defects, windFarmName, turbineName, includeDetails);
      // Save XLSX to IndexedDB for retrieval from CampaignResults
      if (blob) {
        try { await savePdfBlob(`xlsx-${inspectionId}`, blob); } catch { /* ignore */ }
      }
    } finally {
      setIsGeneratingXlsx(false);
    }
  };

  if (!open) return null;

  const wrapperContent = (
    <div style={inline ? { padding: 20 } : panelStyle} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={panelTitleStyle}>Filter defects and export to PDF &amp; XLSX</h3>
        {!inline && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#666', padding: 4 }}>&times;</button>}
      </div>

        {/* Language select */}
        <div style={fieldRowStyle}>
          <label style={fieldLabelStyle}>Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'es')}
            style={selectStyle}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>

        {/* Include details switch */}
        <div
          style={switchRowStyle}
          onClick={() => setIncludeDetails(!includeDetails)}
          role="switch"
          aria-checked={includeDetails}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIncludeDetails(!includeDetails);
            }
          }}
        >
          <div style={{ ...switchTrackStyle, backgroundColor: includeDetails ? '#5A8F5A' : '#CCC' }}>
            <div style={{ ...switchThumbStyle, left: includeDetails ? '18px' : '2px' }} />
          </div>
          <span style={switchLabelStyle}>Include defects details and photos</span>
        </div>

        {/* Resolved status accordion */}
        <div style={accordionStyle}>
          <div style={accordionHeaderStyle} onClick={() => setResolvedOpen(!resolvedOpen)}>
            <span style={accordionTitleStyle}>Resolved status</span>
            {resolvedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
          {resolvedOpen && (
            <div style={accordionContentStyle}>
              <div style={buttonGroupStyle}>
                {(['all', 'resolved', 'unresolved'] as const).map((value) => (
                  <button
                    key={value}
                    style={{
                      ...groupBtnStyle,
                      ...(resolvedFilter === value ? groupBtnActiveStyle : {}),
                    }}
                    onClick={() => setResolvedFilter(value)}
                  >
                    {value === 'all' ? 'All' : value === 'resolved' ? 'Only resolved' : 'Only unresolved'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Category accordion */}
        <div style={accordionStyle}>
          <div style={accordionHeaderStyle} onClick={() => setCategoryOpen(!categoryOpen)}>
            <span style={accordionTitleStyle}>Category</span>
            {categoryOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
          {categoryOpen && (
            <div style={accordionContentStyle}>
              <div style={categoryRowStyle}>
                {[1, 2, 3, 4, 5].map((cat) => {
                  const count = categoryCounts[cat] || 0;
                  const disabled = count === 0;
                  const checked = selectedCategories.has(cat);
                  return (
                    <label
                      key={cat}
                      style={{
                        ...categoryLabelStyle,
                        opacity: disabled ? 0.4 : 1,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked && !disabled}
                        disabled={disabled}
                        onChange={() => !disabled && toggleCategory(cat)}
                        style={checkboxStyle}
                      />
                      <span>{cat}</span>
                      <span style={categoryCountStyle}>({count})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Type accordion */}
        <div style={accordionStyle}>
          <div style={accordionHeaderStyle} onClick={() => setTypeOpen(!typeOpen)}>
            <span style={accordionTitleStyle}>Type</span>
            {typeOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
          {typeOpen && (
            <div style={accordionContentStyle}>
              <div style={typeGridStyle}>
                {availableTypes.map((type) => (
                  <label key={type} style={typeLabelStyle}>
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(type)}
                      onChange={() => toggleType(type)}
                      style={checkboxStyle}
                    />
                    <span style={typeTextStyle}>{type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PDF Section */}
        <div style={sectionDividerStyle}>
          <span style={sectionDividerTextStyle}>PDF</span>
        </div>

        {generateError && <div style={errorStyle}>{generateError}</div>}

        <div style={actionRowStyle}>
          <button
            style={generatePdfBtnStyle}
            onClick={handleGeneratePDF}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Generating...
              </>
            ) : (
              <>
                <FileDown size={14} />
                Generate PDF
              </>
            )}
          </button>

          {pdfBlobUrl && (
            <button style={downloadPdfBtnStyle} onClick={handleDownloadPDF}>
              <Download size={14} />
              PDF
            </button>
          )}
        </div>

        {lastGeneratedAt && (
          <p style={reportInfoStyle}>
            Last generated on {lastGeneratedAt}
          </p>
        )}

        {/* XLSX Section */}
        <div style={sectionDividerStyle}>
          <span style={sectionDividerTextStyle}>XLSX</span>
        </div>

        <div style={actionRowStyle}>
          <button style={downloadCsvBtnStyle} onClick={handleDownloadCSV} disabled={isGeneratingXlsx}>
            {isGeneratingXlsx ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Generating...
              </>
            ) : (
              <>
                <Download size={14} />
                XLSX
              </>
            )}
          </button>
        </div>
        <p style={csvNoteStyle}>Filters do not apply to XLSX</p>
      </div>
  );
  
  if (inline) return wrapperContent;

  return (
    <>
      {wrapperContent}
    </>
  );
}

/* ---------- Styles ---------- */

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'transparent',
  zIndex: 999,
  pointerEvents: 'none',
};

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: '50px',
  right: '20px',
  width: '420px',
  maxHeight: '80vh',
  overflowY: 'auto',
  background: 'white',
  borderRadius: '8px',
  boxShadow: '0px 5px 15px rgba(0,0,0,0.2)',
  padding: '20px',
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const panelTitleStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#1F2937',
  margin: 0,
};

const fieldRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const fieldLabelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#374151',
  minWidth: '70px',
};

const selectStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  fontSize: '12px',
  color: '#374151',
  background: 'white',
  cursor: 'pointer',
  outline: 'none',
};

const switchRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  cursor: 'pointer',
  userSelect: 'none',
};

const switchTrackStyle: CSSProperties = {
  position: 'relative',
  width: '36px',
  height: '20px',
  borderRadius: '10px',
  transition: 'background-color 200ms ease',
  flexShrink: 0,
};

const switchThumbStyle: CSSProperties = {
  position: 'absolute',
  top: '2px',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  backgroundColor: 'var(--color-neutral-0)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  transition: 'left 200ms ease',
};

const switchLabelStyle: CSSProperties = {
  fontSize: '12px',
  color: '#374151',
};

const accordionStyle: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  overflow: 'hidden',
};

const accordionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  cursor: 'pointer',
  backgroundColor: 'var(--color-neutral-50)',
  userSelect: 'none',
};

const accordionTitleStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
};

const accordionContentStyle: CSSProperties = {
  padding: '10px 12px',
};

const buttonGroupStyle: CSSProperties = {
  display: 'flex',
  gap: '4px',
};

const groupBtnStyle: CSSProperties = {
  padding: '5px 10px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 500,
  border: '1px solid #D1D5DB',
  background: 'white',
  color: '#374151',
  cursor: 'pointer',
  transition: 'all 150ms',
};

const groupBtnActiveStyle: CSSProperties = {
  backgroundColor: '#5A8F5A',
  color: 'white',
  borderColor: '#5A8F5A',
};

const categoryRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
};

const categoryLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  color: '#374151',
};

const categoryCountStyle: CSSProperties = {
  fontSize: '10px',
  color: '#6B7280',
};

const checkboxStyle: CSSProperties = {
  width: '14px',
  height: '14px',
  cursor: 'pointer',
  accentColor: '#5A8F5A',
};

const typeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px',
};

const typeLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11px',
  color: '#374151',
  cursor: 'pointer',
};

const typeTextStyle: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const sectionDividerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginTop: '4px',
};

const sectionDividerTextStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid #E5E7EB',
  width: '100%',
  paddingBottom: '4px',
};

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
};

const generatePdfBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 14px',
  borderRadius: '6px',
  border: '1.5px solid #5A8F5A',
  background: 'transparent',
  color: '#5A8F5A',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const downloadPdfBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 14px',
  borderRadius: '6px',
  border: 'none',
  background: '#5A8F5A',
  color: 'white',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const downloadCsvBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 14px',
  borderRadius: '6px',
  border: 'none',
  background: '#5A8F5A',
  color: 'white',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const reportInfoStyle: CSSProperties = {
  fontSize: '11px',
  color: '#6B7280',
  margin: 0,
};

const csvNoteStyle: CSSProperties = {
  fontSize: '11px',
  color: '#6B7280',
  margin: 0,
  fontStyle: 'italic',
};

const errorStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: '4px',
  background: '#FEE2E2',
  color: '#DC2626',
  fontSize: '11px',
};
