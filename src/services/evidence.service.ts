import { supabase } from '@/lib/supabase';
import type { Evidence, MimeType } from '@/types';
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from '@/types';

export class EvidenceServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'EvidenceServiceError';
  }
}

export const evidenceService = {
  /** Validate file before upload (MIME type and size) */
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_MIME_TYPES.includes(file.type as MimeType)) {
      return { valid: false, error: 'Only JPEG and PNG files are allowed' };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: 'File size must not exceed 20 MB' };
    }
    return { valid: true };
  },

  /** Upload evidence image for an inspection */
  async uploadEvidence(inspectionId: string, file: File): Promise<Evidence> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new EvidenceServiceError(validation.error!);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new EvidenceServiceError('User must be authenticated');

    const storagePath = `${user.id}/${inspectionId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('evidence').upload(storagePath, file);
    if (uploadError) throw new EvidenceServiceError(uploadError.message);

    const geo = await this.extractGeoLocation(file);

    const { data, error } = await supabase
      .from('evidence')
      .insert({
        inspection_id: inspectionId,
        filename: file.name,
        mime_type: file.type as MimeType,
        size_bytes: file.size,
        storage_path: storagePath,
        geo_lat: geo?.lat ?? null,
        geo_lng: geo?.lng ?? null,
      })
      .select()
      .single();

    if (error) throw new EvidenceServiceError(error.message);
    return data as Evidence;
  },

  /** List evidence for an inspection */
  async listEvidence(inspectionId: string): Promise<Evidence[]> {
    const { data, error } = await supabase
      .from('evidence')
      .select('*')
      .eq('inspection_id', inspectionId)
      .order('uploaded_at', { ascending: false });
    if (error) throw new EvidenceServiceError(error.message);
    return data as Evidence[];
  },

  /** Delete evidence (storage file and database record) */
  async deleteEvidence(id: string, storagePath: string): Promise<void> {
    const { error: storageError } = await supabase.storage.from('evidence').remove([storagePath]);
    if (storageError) throw new EvidenceServiceError(storageError.message);

    const { error } = await supabase.from('evidence').delete().eq('id', id);
    if (error) throw new EvidenceServiceError(error.message);
  },

  /** Get thumbnail URL using Supabase image transforms */
  getThumbnailUrl(storagePath: string): string {
    const { data } = supabase.storage.from('evidence').getPublicUrl(storagePath, {
      transform: { width: 300, height: 300, resize: 'contain' },
    });
    return data.publicUrl;
  },

  /** Get full-size public URL */
  getFullUrl(storagePath: string): string {
    const { data } = supabase.storage.from('evidence').getPublicUrl(storagePath);
    return data.publicUrl;
  },

  /** Extract geolocation from EXIF metadata (basic implementation) */
  async extractGeoLocation(file: File): Promise<{ lat: number; lng: number } | null> {
    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);

      // Check for JPEG SOI marker
      if (view.getUint16(0) !== 0xffd8) return null;

      // Find APP1 (EXIF) marker
      let offset = 2;
      while (offset < view.byteLength - 1) {
        const marker = view.getUint16(offset);
        if (marker === 0xffe1) {
          const exifData = this.parseExifGps(view, offset + 4);
          return exifData;
        }
        const segmentLength = view.getUint16(offset + 2);
        offset += 2 + segmentLength;
      }
    } catch {
      // EXIF parsing is best-effort; return null on any error
    }
    return null;
  },

  /** Parse GPS data from EXIF APP1 segment */
  parseExifGps(view: DataView, exifStart: number): { lat: number; lng: number } | null {
    const exifHeader =
      String.fromCharCode(view.getUint8(exifStart)) +
      String.fromCharCode(view.getUint8(exifStart + 1)) +
      String.fromCharCode(view.getUint8(exifStart + 2)) +
      String.fromCharCode(view.getUint8(exifStart + 3));

    if (exifHeader !== 'Exif') return null;

    const tiffStart = exifStart + 6;
    const byteOrder = view.getUint16(tiffStart);
    const littleEndian = byteOrder === 0x4949;

    const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
    const ifd0Start = tiffStart + ifd0Offset;
    const ifd0Count = view.getUint16(ifd0Start, littleEndian);

    let gpsIfdOffset: number | null = null;
    for (let i = 0; i < ifd0Count; i++) {
      const entryOffset = ifd0Start + 2 + i * 12;
      const tag = view.getUint16(entryOffset, littleEndian);
      if (tag === 0x8825) {
        gpsIfdOffset = view.getUint32(entryOffset + 8, littleEndian);
        break;
      }
    }

    if (gpsIfdOffset === null) return null;

    const gpsIfdStart = tiffStart + gpsIfdOffset;
    const gpsCount = view.getUint16(gpsIfdStart, littleEndian);

    let latRef: string | null = null;
    let lngRef: string | null = null;
    let latValues: number[] | null = null;
    let lngValues: number[] | null = null;

    for (let i = 0; i < gpsCount; i++) {
      const entryOffset = gpsIfdStart + 2 + i * 12;
      if (entryOffset + 12 > view.byteLength) break;

      const tag = view.getUint16(entryOffset, littleEndian);

      switch (tag) {
        case 0x0001:
          latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
          break;
        case 0x0002:
          latValues = this.readGpsRational(view, tiffStart, entryOffset, littleEndian);
          break;
        case 0x0003:
          lngRef = String.fromCharCode(view.getUint8(entryOffset + 8));
          break;
        case 0x0004:
          lngValues = this.readGpsRational(view, tiffStart, entryOffset, littleEndian);
          break;
      }
    }

    if (!latValues || !lngValues || !latRef || !lngRef) return null;
    if (latValues.length < 3 || lngValues.length < 3) return null;

    let lat = latValues[0]! + latValues[1]! / 60 + latValues[2]! / 3600;
    let lng = lngValues[0]! + lngValues[1]! / 60 + lngValues[2]! / 3600;

    if (latRef === 'S') lat = -lat;
    if (lngRef === 'W') lng = -lng;

    return { lat, lng };
  },

  /** Read GPS rational values (degrees, minutes, seconds) */
  readGpsRational(
    view: DataView,
    tiffStart: number,
    entryOffset: number,
    littleEndian: boolean,
  ): number[] | null {
    const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
    const absOffset = tiffStart + valueOffset;

    if (absOffset + 24 > view.byteLength) return null;

    const values: number[] = [];
    for (let i = 0; i < 3; i++) {
      const numerator = view.getUint32(absOffset + i * 8, littleEndian);
      const denominator = view.getUint32(absOffset + i * 8 + 4, littleEndian);
      values.push(denominator === 0 ? 0 : numerator / denominator);
    }
    return values;
  },
};
