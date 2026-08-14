import ExcelJS from 'exceljs';
import type { DefectDashboardRow } from '@/types';

// Defect images now come from evidence in the database

/** Fetch an image URL and convert to ArrayBuffer for ExcelJS (with SVG→PNG conversion) */
async function fetchImageAsBuffer(url: string): Promise<{ buffer: ArrayBuffer; extension: 'png' | 'jpeg' } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    const buffer = await resp.arrayBuffer();

    if (contentType.includes('svg') || url.endsWith('.svg')) {
      const svgBlob = new Blob([buffer], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(svgUrl); return null; }
      const img = new Image();
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5000);
        img.onload = () => { clearTimeout(timeout); resolve(); };
        img.onerror = () => { clearTimeout(timeout); resolve(); };
        img.src = svgUrl;
      });
      ctx.drawImage(img, 0, 0, 200, 150);
      URL.revokeObjectURL(svgUrl);
      const pngBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
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
    const resp = await fetch('/core-insight-logo3.png');
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Generate an XLSX Blob from defect dashboard data with embedded images.
 */
export async function generateDefectsXLSX(data: DefectDashboardRow[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Defects');
  sheet.views = [{ showGridLines: false }];

  const origin = window.location.origin;

  // Logo area
  sheet.mergeCells('A1:L2');
  const logoBuffer = await renderLogoPng();
  if (logoBuffer) {
    const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
    sheet.addImage(logoId, {
      tl: { col: 0.2, row: 0.1 },
      ext: { width: 300, height: 60 },
    });
  }

  sheet.getRow(1).height = 35;
  sheet.getRow(2).height = 30;
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.getRow(3).height = 8;

  // Title
  const titleRow = sheet.addRow(['Defects Export - All Wind Farms']);
  titleRow.font = { bold: true, size: 13, color: { argb: 'FF5A8F5A' } };
  titleRow.height = 22;
  sheet.addRow([]);

  // Column widths
  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 22;
  sheet.getColumn(5).width = 10;
  sheet.getColumn(6).width = 7;
  sheet.getColumn(7).width = 6;
  sheet.getColumn(8).width = 12;
  sheet.getColumn(9).width = 14;
  sheet.getColumn(10).width = 9;
  sheet.getColumn(11).width = 16;
  sheet.getColumn(12).width = 28;

  // Headers
  const headers = ['#', 'Asset', 'Turbine', 'Type', 'Category', 'Blade', 'Side', 'Distance (m)', 'Size (cm)', 'Resolved', 'Next Step', 'Photo'];
  const headerRow = sheet.addRow(headers);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A8F5A' } };
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {};
  });

  // Pre-load all unique defect images in parallel (from real evidence URLs)
  const uniqueImgPaths = new Set<string>();
  for (const d of data) {
    if (d.imageUrl) uniqueImgPaths.add(d.imageUrl);
  }
  const imageCache = new Map<string, { buffer: ArrayBuffer; extension: 'png' | 'jpeg' } | null>();
  await Promise.all(
    [...uniqueImgPaths].map(async (imgUrl) => {
      const result = await fetchImageAsBuffer(imgUrl);
      imageCache.set(imgUrl, result);
    })
  );

  // Data rows with cached images
  const dataStartRow = sheet.rowCount + 1;
  for (let i = 0; i < data.length; i++) {
    const d = data[i]!;
    const row = sheet.addRow([
      i + 1,
      d.assetName,
      d.turbineName,
      d.type,
      d.category,
      d.bladePosition,
      d.side,
      d.rootDistance,
      `${d.defectWidth} x ${d.defectHeight}`,
      d.resolved ? 'Yes' : 'No',
      d.nextStep,
      '',
    ]);
    row.height = 75;
    row.alignment = { vertical: 'middle' };
    row.eachCell((cell) => { cell.border = {}; });

    // Embed cached image
    const imgUrl = d.imageUrl;
    const imgData = imgUrl ? imageCache.get(imgUrl) : null;
    if (imgData) {
      const imageId = workbook.addImage({ buffer: imgData.buffer, extension: imgData.extension });
      const rowIdx = dataStartRow + i - 1;
      sheet.addImage(imageId, {
        tl: { col: 11, row: rowIdx },
        ext: { width: 150, height: 90 },
      });
    }
  }

  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  return new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate a CSV Blob from defect dashboard data.
 */
export function generateCSV(data: DefectDashboardRow[]): Blob {
  const headers = [
    'Asset',
    'Turbine',
    'Model',
    'Type',
    'Defect Size (cm)',
    'Category',
    'Action',
    'Next Step',
    'Blade',
    'Side',
    'Root Distance (m)',
  ];

  const rows = data.map((row) => [
    row.assetName,
    row.turbineName,
    row.turbineModel,
    row.type,
    `${row.defectWidth} x ${row.defectHeight}`,
    String(row.category),
    row.actionText,
    row.nextStep,
    row.bladePosition,
    row.side,
    String(row.rootDistance),
  ]);

  const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Trigger a file download from a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
