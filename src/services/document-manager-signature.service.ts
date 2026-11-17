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

/** Storage path for a manager's signature: lowercase, no accents, dashes. */
export function signaturePath(managerName: string): string {
  const slug = managerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `signatures/document-managers/${slug}.png`;
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
  /** Signed URL to preview the signature, or null when none was uploaded yet. */
  async getSignedUrl(managerName: string): Promise<string | null> {
    if (!managerName) return null;
    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(signaturePath(managerName), 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl as string;
  },

  /** The signature as a data URL for the PDF, or null (never throws). */
  async getDataUrl(managerName: string): Promise<string | null> {
    if (!managerName) return null;
    try {
      const { data, error } = await db.storage.from(BUCKET).download(signaturePath(managerName));
      if (error || !data) return null;
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(data as Blob);
      });
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
