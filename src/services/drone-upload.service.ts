import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type { InspectionPhoto, DroneUploadPayload, BladeUploadProgress, CampaignStatus, BladeFace } from '@/types';

export class DroneUploadServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'DroneUploadServiceError';
  }
}

export const droneUploadService = {
  /**
   * Upload a photo from the drone agent.
   * 1. Uploads file to Supabase Storage bucket 'inspection-photos'
   * 2. Creates inspection_photo record with metadata
   * 3. Returns the created record
   */
  async uploadPhoto(
    file: File,
    payload: DroneUploadPayload,
  ): Promise<InspectionPhoto> {
    const storagePath = `${payload.campaignId}/${payload.bladeId}/${payload.face}/${payload.flightPlanOrder}_${payload.filename}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('inspection-photos')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new DroneUploadServiceError(`Storage upload failed: ${uploadError.message}`);
    }

    // Create DB record
    const { data, error } = await db
      .from('inspection_photo')
      .insert({
        campaign_id: payload.campaignId,
        blade_id: payload.bladeId,
        face: payload.face,
        radial_position: payload.radialPosition,
        flight_plan_order: payload.flightPlanOrder,
        storage_path: storagePath,
        filename: payload.filename,
        captured_at: payload.capturedAt || null,
        metadata: payload.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new DroneUploadServiceError(`DB insert failed: ${error.message}`, error.code);
    }

    // Transition inspection stage to 'inspect' if this is the first photo
    try {
      const { data: insp } = await db
        .from('inspection')
        .select('id, stage')
        .eq('campaign_id', payload.campaignId)
        .single();

      if (insp && insp.stage === 'planned') {
        await db
          .from('inspection')
          .update({ stage: 'inspect' })
          .eq('id', insp.id)
          .eq('stage', 'planned');
      }
    } catch (stageError) {
      console.error('[drone-upload.service] Failed to update inspection stage:', stageError);
    }

    return mapPhotoRow(data);
  },

  /**
   * Batch upload: register multiple photos already uploaded to storage.
   * Used when the drone agent uploads files directly and then registers metadata.
   */
  async registerPhotoBatch(
    photos: Array<DroneUploadPayload & { storagePath: string }>,
  ): Promise<InspectionPhoto[]> {
    const rows = photos.map((p) => ({
      campaign_id: p.campaignId,
      blade_id: p.bladeId,
      face: p.face,
      radial_position: p.radialPosition,
      flight_plan_order: p.flightPlanOrder,
      storage_path: p.storagePath,
      filename: p.filename,
      captured_at: p.capturedAt || null,
      metadata: p.metadata || {},
    }));

    const { data, error } = await db
      .from('inspection_photo')
      .insert(rows)
      .select();

    if (error) {
      throw new DroneUploadServiceError(`Batch insert failed: ${error.message}`, error.code);
    }

    return (data ?? []).map(mapPhotoRow);
  },

  /**
   * Get upload progress for a campaign (grouped by blade + face).
   */
  async getUploadProgress(campaignId: string): Promise<BladeUploadProgress[]> {
    const { data, error } = await db.rpc('get_campaign_upload_progress', {
      p_campaign_id: campaignId,
    });

    if (error) {
      throw new DroneUploadServiceError(`Failed to get progress: ${error.message}`, error.code);
    }

    return ((data as unknown[]) ?? []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        bladeId: r.blade_id as string,
        bladePosition: r.blade_position as number,
        face: r.face as BladeFace,
        photoCount: Number(r.photo_count),
        analyzedCount: Number(r.analyzed_count),
      };
    });
  },

  /**
   * Get all photos for a blade, optionally filtered by face.
   * Returns ordered by radial position (root → tip).
   */
  async getBladePhotos(
    campaignId: string,
    bladeId: string,
    face?: BladeFace,
  ): Promise<InspectionPhoto[]> {
    let query = db
      .from('inspection_photo')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('blade_id', bladeId)
      .order('radial_position', { ascending: true });

    if (face) {
      query = query.eq('face', face);
    }

    const { data, error } = await query;

    if (error) {
      throw new DroneUploadServiceError(`Failed to get photos: ${error.message}`, error.code);
    }

    return (data ?? []).map(mapPhotoRow);
  },

  /**
   * Get all photos for a campaign organized by blade and face.
   */
  async getCampaignPhotos(campaignId: string): Promise<Record<string, Record<BladeFace, InspectionPhoto[]>>> {
    const { data, error } = await db
      .from('inspection_photo')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('flight_plan_order', { ascending: true });

    if (error) {
      throw new DroneUploadServiceError(`Failed to get campaign photos: ${error.message}`, error.code);
    }

    const photos = (data ?? []).map(mapPhotoRow);
    const grouped: Record<string, Record<string, InspectionPhoto[]>> = {};

    for (const photo of photos) {
      if (!grouped[photo.bladeId]) {
        grouped[photo.bladeId] = {} as Record<string, InspectionPhoto[]>;
      }
      if (!grouped[photo.bladeId]![photo.face]) {
        grouped[photo.bladeId]![photo.face] = [];
      }
      grouped[photo.bladeId]![photo.face]!.push(photo);
    }

    return grouped as Record<string, Record<BladeFace, InspectionPhoto[]>>;
  },

  /**
   * Update campaign status.
   */
  async updateCampaignStatus(campaignId: string, status: CampaignStatus): Promise<void> {
    const { error } = await db
      .from('campaign')
      .update({ status })
      .eq('id', campaignId);

    if (error) {
      throw new DroneUploadServiceError(`Failed to update campaign status: ${error.message}`, error.code);
    }
  },

  /**
   * Mark a photo as analyzed.
   */
  async markPhotoAnalyzed(photoId: string): Promise<void> {
    const { error } = await db
      .from('inspection_photo')
      .update({ analyzed: true })
      .eq('id', photoId);

    if (error) {
      throw new DroneUploadServiceError(`Failed to mark analyzed: ${error.message}`, error.code);
    }
  },

  /**
   * Get signed URL for a photo.
   * Uses 'asset-documents' bucket for imported photos, 'inspection-photos' for native uploads.
   */
  async getPhotoUrl(storagePath: string): Promise<string> {
    const bucket = storagePath.startsWith('inspection-imports/')
      ? 'asset-documents'
      : 'inspection-photos';

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (error) {
      throw new DroneUploadServiceError(`Failed to get URL: ${error.message}`);
    }

    return data.signedUrl;
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapPhotoRow(row: unknown): InspectionPhoto {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    campaignId: r.campaign_id as string,
    inspectionId: (r.inspection_id as string) ?? null,
    bladeId: r.blade_id as string,
    face: r.face as BladeFace,
    radialPosition: Number(r.radial_position),
    flightPlanOrder: Number(r.flight_plan_order),
    storagePath: r.storage_path as string,
    filename: r.filename as string,
    thumbnailPath: (r.thumbnail_path as string) ?? null,
    widthPx: r.width_px != null ? Number(r.width_px) : null,
    heightPx: r.height_px != null ? Number(r.height_px) : null,
    capturedAt: (r.captured_at as string) ?? null,
    uploadedAt: r.uploaded_at as string,
    analyzed: Boolean(r.analyzed),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  };
}
