import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Handwritten signature image of a document manager (the signer of the repair
 * report). One image PER MANAGER NAME (not per wind farm): the same person signs
 * every farm they manage, so it is stored once at a deterministic path in the
 * private 'asset-documents' bucket and looked up by name.
 */
const BUCKET = 'asset-documents';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH_PX = 800;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export class DocumentManagerSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentManagerSignatureError';
  }
}

/** Slug of a manager name: lowercase, no accents, dashes ("Víctor Hugo" → "victor-hugo"). */
export function signatureSlug(managerName: string): string {
  return managerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Storage path for a manager's uploaded signature. */
export function signaturePath(managerName: string): string {
  return `signatures/document-managers/${signatureSlug(managerName)}.png`;
}

/**
 * Signature as a LIGHT JPEG data URL for the PDF: capped at MAX_WIDTH_PX and
 * flattened on white (the report page is white). Embedding the raw PNG is not an
 * option — jsPDF stores it decompressed, so a 2828×1069 RGBA PNG of 214 KB adds
 * ~12 MB to the PDF, which risks the upload size limit of the generated report.
 * Returns null when the image can't be decoded (the signature line stays blank).
 */
async function blobToPdfDataUrl(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_WIDTH_PX / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
}

/**
 * Static fallback: a signature image committed to public/ as <slug>.png (e.g.
 * public/victor-hugo-cayola.png). Used when no signature was uploaded through
 * the form. The host rewrites unknown paths to index.html with HTTP 200, so the
 * response must really be an image, not just ok.
 */
async function fetchPublicSignature(managerName: string): Promise<{ url: string; blob: Blob } | null> {
  const slug = signatureSlug(managerName);
  if (!slug) return null;
  try {
    const url = `${window.location.origin}/${slug}.png`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return { url, blob };
  } catch {
    return null;
  }
}

/** Re-encode any accepted image as a PNG capped at MAX_WIDTH_PX (light PDFs). */
async function toPng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH_PX / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new DocumentManagerSignatureError('Canvas not available');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new DocumentManagerSignatureError('PNG encode failed'))),
      'image/png',
    );
  });
}

export const documentManagerSignatureService = {
  /** URL to preview the signature (uploaded one, else public/<slug>.png), or null. */
  async getSignedUrl(managerName: string): Promise<string | null> {
    if (!managerName) return null;
    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(signaturePath(managerName), 3600);
    if (!error && data?.signedUrl) return data.signedUrl as string;
    // Nothing uploaded → fall back to the image committed in public/.
    return (await fetchPublicSignature(managerName))?.url ?? null;
  },

  /** The signature as a light JPEG data URL for the PDF (uploaded one, else public/<slug>.png), or null. Never throws. */
  async getDataUrl(managerName: string): Promise<string | null> {
    if (!managerName) return null;
    try {
      // 1. A signature uploaded through the form wins.
      const { data, error } = await db.storage.from(BUCKET).download(signaturePath(managerName));
      if (!error && data) {
        const uploaded = await blobToPdfDataUrl(data as Blob);
        if (uploaded) return uploaded;
      }
      // 2. Otherwise the image committed in public/<slug>.png.
      const fallback = await fetchPublicSignature(managerName);
      return fallback ? await blobToPdfDataUrl(fallback.blob) : null;
    } catch {
      return null;
    }
  },

  /** Upload (or replace) the manager's signature. Throws with a readable message. */
  async upload(managerName: string, file: File): Promise<void> {
    if (!managerName) throw new DocumentManagerSignatureError('Document manager is required');
    if (!ACCEPTED_TYPES.includes(file.type)) {
      throw new DocumentManagerSignatureError('Use a PNG, JPG or WEBP image');
    }
    if (file.size > MAX_BYTES) {
      throw new DocumentManagerSignatureError('The image must be 5 MB or smaller');
    }
    const png = await toPng(file);
    const { error } = await db.storage
      .from(BUCKET)
      .upload(signaturePath(managerName), png, { contentType: 'image/png', upsert: true });
    if (error) throw new DocumentManagerSignatureError(error.message);
  },
};
