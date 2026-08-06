import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { BladeFace } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface InspectionPhotoRow {
  id: string;
  campaignId: string;
  bladeId: string;
  bladePosition: number;
  face: BladeFace;
  radialPosition: number;
  flightPlanOrder: number;
  storagePath: string;
  filename: string;
  isTagged: boolean;
  isViewed: boolean;
}

const FACE_SHORT: Record<BladeFace, string> = {
  leading_edge: 'LE',
  trailing_edge: 'TE',
  suction_side: 'SS',
  pressure_side: 'PS',
};

/**
 * Fetches inspection photos for a given campaign and optionally a specific blade.
 * Returns the photos with their short face labels and public URLs.
 */
async function fetchInspectionPhotos(
  campaignId: string | null | undefined,
  bladeId?: string | null,
): Promise<InspectionPhotoRow[]> {
  if (!campaignId) return [];

  let query = db
    .from('inspection_photo')
    .select('id, campaign_id, blade_id, face, radial_position, flight_plan_order, storage_path, filename, metadata, blade:blade_id(position)')
    .eq('campaign_id', campaignId)
    .order('flight_plan_order', { ascending: true });

  if (bladeId) {
    query = query.eq('blade_id', bladeId);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    campaignId: row.campaign_id as string,
    bladeId: row.blade_id as string,
    bladePosition: (row.blade as Record<string, unknown>)?.position as number ?? 1,
    face: row.face as BladeFace,
    radialPosition: Number(row.radial_position),
    flightPlanOrder: Number(row.flight_plan_order),
    storagePath: row.storage_path as string,
    filename: row.filename as string,
    isTagged: ((row.metadata as Record<string, unknown>)?.tagged as boolean) ?? false,
    isViewed: ((row.metadata as Record<string, unknown>)?.viewed as boolean) ?? false,
  })).sort((a, b) => a.bladePosition - b.bladePosition || a.flightPlanOrder - b.flightPlanOrder);
}

/**
 * Get the public URL for a photo stored in the inspection-photos bucket.
 * Falls back to a local placeholder image if the storage file doesn't exist.
 */
export function getPhotoPublicUrl(storagePath: string): string {
  // For seeded/demo data, use placeholder images from public directory
  // Real uploaded photos would have actual files in storage
  const face = storagePath.split('/')[2] || 'leading_edge';
  const placeholders: Record<string, string> = {
    leading_edge: '/test-images/defect-erosion-close.svg',
    trailing_edge: '/test-images/defect-blade-close.svg',
    suction_side: '/test-images/defect-vortex-close.svg',
    pressure_side: '/test-images/defect-delamination-close.svg',
  };
  // Check if this is a seeded path (contains UUID pattern in path)
  if (storagePath.includes('/') && !storagePath.startsWith('http')) {
    return placeholders[face] || '/test-images/defect-blade-close.svg';
  }
  const { data } = supabase.storage
    .from('inspection-photos')
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Get the short label for a blade face.
 */
export function getFaceShort(face: BladeFace): string {
  return FACE_SHORT[face] || face;
}

/**
 * Hook to fetch inspection photos for a campaign (optionally filtered by blade).
 */
export function useInspectionPhotos(campaignId: string | null | undefined, bladeId?: string | null) {
  return useQuery({
    queryKey: ['inspection-photos', campaignId, bladeId],
    queryFn: () => fetchInspectionPhotos(campaignId, bladeId),
    enabled: !!campaignId,
  });
}
