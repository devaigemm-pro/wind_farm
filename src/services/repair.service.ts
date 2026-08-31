import { supabase } from '@/lib/supabase';
import { REPAIR_STAGE_KEYS } from '@/constants/repair-stages';
import type { RepairCampaignStatus } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export class RepairServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'RepairServiceError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Aggregated repair campaign header data (campaign + turbine + wind farm). */
export interface RepairCampaignDetail {
  id: string;
  name: string;
  status: RepairCampaignStatus;
  createdAt: string;
  updatedAt: string;
  quoteId: string | null;
  windFarmId: string;
  windFarmName: string | null;
  windFarmLocation: string | null;
  turbineId: string | null;
  turbineName: string | null;
  turbineModel: string | null;
}

/** A repair photo (inspection_photo row with repair_stage set). */
export interface RepairPhoto {
  id: string;
  campaignId: string;
  bladeId: string | null;
  repairStage: string;
  repairSelected: boolean;
  storagePath: string;
  filename: string;
  /** Resolved signed/public URL for rendering. */
  url: string;
  isViewed: boolean;
}

/** Repair photos grouped by stage key. */
export interface RepairStagePhotos {
  stageKey: string;
  photos: RepairPhoto[];
}

/** Summary data for the repair row in the campaigns panel. */
export interface RepairSummary {
  photosCount: number;
  selectedCount: number;
  stagesWithPhotos: number;
  totalStages: number;
  /** % of stages that have at least one photo (0-100). */
  stagesProgressPercent: number;
  /** % of photos marked as viewed (0-100). */
  viewedPercent: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve a rendering URL for a repair photo storage path.
 * Mirrors droneUploadService.getPhotoUrl / useInspectionPhotos: imported photos
 * live in the 'asset-documents' bucket (prefix inspection-imports/), everything
 * else in the private 'inspection-photos' bucket. Both need signed URLs.
 */
async function resolvePhotoUrls(
  photos: { id: string; storagePath: string }[],
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  if (photos.length === 0) return urlMap;

  const importBucket = 'asset-documents';
  const nativeBucket = 'inspection-photos';

  const imported = photos.filter((p) => p.storagePath.startsWith('inspection-imports/'));
  const native = photos.filter((p) => !p.storagePath.startsWith('inspection-imports/'));

  const BATCH = 50;

  async function signBatch(bucket: string, batch: { id: string; storagePath: string }[]) {
    if (batch.length === 0) return;
    try {
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrls(batch.map((p) => p.storagePath), 3600);
      if (data) {
        for (let i = 0; i < data.length; i++) {
          const url = data[i]?.signedUrl;
          if (url) urlMap.set(batch[i]!.id, url);
        }
      }
    } catch {
      // Silent fallback — photos render broken but nothing crashes.
    }
  }

  for (let i = 0; i < imported.length; i += BATCH) {
    await signBatch(importBucket, imported.slice(i, i + BATCH));
  }
  for (let i = 0; i < native.length; i += BATCH) {
    await signBatch(nativeBucket, native.slice(i, i + BATCH));
  }

  return urlMap;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const repairService = {
  /**
   * Get the repair campaign header data with turbine + wind farm.
   */
  async getRepairCampaign(campaignId: string): Promise<RepairCampaignDetail> {
    const { data, error } = await db
      .from('campaign')
      .select(`
        id, name, status, quote_id, created_at, updated_at, wind_farm_id, turbine_id,
        wind_farm:wind_farm_id ( id, name, location ),
        turbine:turbine_id ( id, name, model )
      `)
      .eq('id', campaignId)
      .single();

    if (error || !data) {
      throw new RepairServiceError(error?.message || 'Repair campaign not found', error?.code);
    }

    const r = data as Record<string, unknown>;
    const wf = (r.wind_farm as Record<string, unknown>) ?? {};
    const turbine = (r.turbine as Record<string, unknown>) ?? {};

    return {
      id: r.id as string,
      name: r.name as string,
      status: ((r.status as string) ?? 'repair_open') as RepairCampaignStatus,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      quoteId: (r.quote_id as string) ?? null,
      windFarmId: r.wind_farm_id as string,
      windFarmName: (wf.name as string) ?? null,
      windFarmLocation: (wf.location as string) ?? null,
      turbineId: (r.turbine_id as string) ?? null,
      turbineName: (turbine.name as string) ?? null,
      turbineModel: (turbine.model as string) ?? null,
    };
  },

  /**
   * Get all repair photos of a campaign (repair_stage != null), grouped by stage.
   * Returns one entry per stage that has at least one photo. URLs are resolved.
   */
  async getRepairPhotosByStage(campaignId: string): Promise<RepairStagePhotos[]> {
    const { data, error } = await db
      .from('inspection_photo')
      .select('id, campaign_id, blade_id, repair_stage, repair_selected, storage_path, filename, metadata')
      .eq('campaign_id', campaignId)
      .not('repair_stage', 'is', null)
      .order('uploaded_at', { ascending: true });

    if (error) {
      throw new RepairServiceError(error.message, error.code);
    }

    const rows = ((data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        campaignId: r.campaign_id as string,
        bladeId: (r.blade_id as string) ?? null,
        repairStage: r.repair_stage as string,
        repairSelected: Boolean(r.repair_selected),
        storagePath: r.storage_path as string,
        filename: r.filename as string,
        isViewed: ((r.metadata as Record<string, unknown>)?.viewed as boolean) ?? false,
      };
    });

    const urlMap = await resolvePhotoUrls(rows.map((r) => ({ id: r.id, storagePath: r.storagePath })));

    const photos: RepairPhoto[] = rows.map((r) => ({
      ...r,
      url: urlMap.get(r.id) ?? '',
    }));

    // Group by stage, preserving the canonical stage order.
    const grouped: RepairStagePhotos[] = REPAIR_STAGE_KEYS.map((stageKey) => ({
      stageKey,
      photos: photos.filter((p) => p.repairStage === stageKey),
    }));

    return grouped;
  },

  /**
   * Mark / unmark a photo as selected for the repair report.
   */
  async setPhotoSelected(photoId: string, selected: boolean): Promise<void> {
    const { error } = await db
      .from('inspection_photo')
      .update({ repair_selected: selected })
      .eq('id', photoId);

    if (error) {
      throw new RepairServiceError(error.message, error.code);
    }
  },

  /**
   * Aggregate summary for the repair row in the campaigns panel.
   */
  async getRepairSummary(campaignId: string): Promise<RepairSummary> {
    const { data, error } = await db
      .from('inspection_photo')
      .select('id, repair_stage, repair_selected, metadata')
      .eq('campaign_id', campaignId)
      .not('repair_stage', 'is', null);

    if (error) {
      throw new RepairServiceError(error.message, error.code);
    }

    const rows = ((data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        repairStage: r.repair_stage as string,
        repairSelected: Boolean(r.repair_selected),
        isViewed: ((r.metadata as Record<string, unknown>)?.viewed as boolean) ?? false,
      };
    });

    const photosCount = rows.length;
    const selectedCount = rows.filter((r) => r.repairSelected).length;
    const viewedCount = rows.filter((r) => r.isViewed).length;
    const stagesWithPhotos = new Set(rows.map((r) => r.repairStage)).size;
    const totalStages = REPAIR_STAGE_KEYS.length;

    return {
      photosCount,
      selectedCount,
      stagesWithPhotos,
      totalStages,
      stagesProgressPercent: totalStages > 0 ? Math.round((stagesWithPhotos / totalStages) * 100) : 0,
      viewedPercent: photosCount > 0 ? Math.round((viewedCount / photosCount) * 100) : 0,
    };
  },

  /**
   * Update the repair campaign workflow status.
   */
  async updateRepairStatus(campaignId: string, status: RepairCampaignStatus): Promise<void> {
    const { error } = await db
      .from('campaign')
      .update({ status })
      .eq('id', campaignId);

    if (error) {
      throw new RepairServiceError(error.message, error.code);
    }
  },
};
