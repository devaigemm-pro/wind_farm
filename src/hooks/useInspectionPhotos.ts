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
  /** Pre-generated thumbnail signed URL (thumb_ prefixed file). Falls back to transform URL. */
  thumbnailUrl: string;
}

const FACE_SHORT: Record<BladeFace, string> = {
  leading_edge: 'LE',
  trailing_edge: 'TE',
  suction_side: 'SS',
  pressure_side: 'PS',
};

/**
 * Given an original storage path, return the path to the pre-generated thumbnail.
 * E.g., inspection-imports/camp/blade/face/1_DJI_0002.JPG
 *     → inspection-imports/camp/blade/face/thumb_1_DJI_0002.JPG
 */
function getThumbStoragePath(storagePath: string): string {
  const lastSlash = storagePath.lastIndexOf('/');
  const dir = storagePath.substring(0, lastSlash);
  const filename = storagePath.substring(lastSlash + 1);
  return `${dir}/thumb_${filename}`;
}

/**
 * Fetches inspection photos for a given campaign and optionally a specific blade.
 * Returns the photos with their short face labels and public URLs.
 * For imported photos (in asset-documents bucket), generates signed URLs.
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

  const rows = (data as Record<string, unknown>[]).map((row) => ({
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
    thumbnailUrl: '', // Will be populated below for imported photos
  })).sort((a, b) => a.bladePosition - b.bladePosition || a.flightPlanOrder - b.flightPlanOrder);

  // For imported photos, generate signed URLs for both original and pre-generated thumbnails.
  // Thumbnail files use thumb_ prefix in the same directory as the original.
  const importedRows = rows.filter(r => r.storagePath.startsWith('inspection-imports/'));

  if (importedRows.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < importedRows.length; i += BATCH_SIZE) {
      const batch = importedRows.slice(i, i + BATCH_SIZE);
      const originalPaths = batch.map(r => r.storagePath);
      const thumbPaths = batch.map(r => getThumbStoragePath(r.storagePath));

      try {
        // Fetch signed URLs for originals and pre-generated thumbnails in parallel
        const [originalResult, thumbResult] = await Promise.all([
          supabase.storage.from('asset-documents').createSignedUrls(originalPaths, 3600),
          supabase.storage.from('asset-documents').createSignedUrls(thumbPaths, 3600),
        ]);

        // Assign original signed URLs by index (API preserves order)
        if (originalResult.data) {
          for (let j = 0; j < originalResult.data.length; j++) {
            const item = originalResult.data[j];
            if (item?.signedUrl && !item.error) {
              batch[j]!.storagePath = item.signedUrl;
            }
          }
        }

        // Assign thumbnail signed URLs by index — these are the pre-generated
        // thumb_ files which load much faster than on-the-fly transforms
        if (thumbResult.data) {
          for (let j = 0; j < thumbResult.data.length; j++) {
            const signedItem = thumbResult.data[j];
            if (signedItem?.signedUrl && !signedItem.error) {
              batch[j]!.thumbnailUrl = signedItem.signedUrl;
            }
          }
        }
      } catch {
        // Silent fallback — photos will show as broken but won't crash
      }
    }
  }

  return rows;
}

/**
 * Image size presets for optimized loading.
 * Supabase Storage transforms images on-the-fly and serves WebP automatically.
 */
export type ImageSize = 'thumbnail' | 'viewer' | 'full';

const IMAGE_PRESETS: Record<ImageSize, { width: number; quality: number } | null> = {
  thumbnail: { width: 150, quality: 60 },   // ~5-15KB per image (grid thumbnails)
  viewer: { width: 1400, quality: 82 },      // ~80-200KB (main viewer, good quality)
  full: null,                                 // original resolution (download only)
};

/**
 * Get the URL for rendering a photo with optional size optimization.
 * - If storagePath is already a full URL (signed URL), appends transform params
 * - For imported photos that still have the path, use asset-documents bucket
 * - For native drone uploads, use inspection-photos bucket render endpoint
 * - Falls back to a placeholder for seeded/demo data
 */
export function getPhotoPublicUrl(storagePath: string, size: ImageSize = 'full'): string {
  const preset = IMAGE_PRESETS[size];

  // Already a full URL (signed URL from fetchInspectionPhotos)
  if (storagePath.startsWith('https://') || storagePath.startsWith('http://')) {
    // For signed URLs, we can append width/height/quality as query params
    // to leverage Supabase's on-the-fly image transformation via the render endpoint.
    if (preset && storagePath.includes('supabase.co/storage/')) {
      const separator = storagePath.includes('?') ? '&' : '?';
      return `${storagePath}${separator}width=${preset.width}&quality=${preset.quality}`;
    }
    return storagePath;
  }

  // Imported photos path (shouldn't reach here if fetchInspectionPhotos resolved it)
  if (storagePath.startsWith('inspection-imports/')) {
    if (preset) {
      const { data } = supabase.storage
        .from('asset-documents')
        .getPublicUrl(storagePath, { transform: { width: preset.width, quality: preset.quality } });
      return data.publicUrl;
    }
    const { data } = supabase.storage
      .from('asset-documents')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  }

  // Native drone uploads → inspection-photos bucket
  const hasRealFile = storagePath.match(/\.(jpg|jpeg|png)$/i);
  if (hasRealFile) {
    if (preset) {
      const { data } = supabase.storage
        .from('inspection-photos')
        .getPublicUrl(storagePath, { transform: { width: preset.width, quality: preset.quality } });
      return data.publicUrl;
    }
    const { data } = supabase.storage
      .from('inspection-photos')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  }

  // No placeholder — return empty string for unknown/seeded paths
  return '';
}

/**
 * Get a signed URL for a photo (async, use for imported photos that need auth).
 * Returns the signed URL string or empty string on failure.
 * Supports image transforms for optimized delivery.
 */
export async function getPhotoSignedUrl(storagePath: string, size: ImageSize = 'full'): Promise<string> {
  const bucket = storagePath.startsWith('inspection-imports/')
    ? 'asset-documents'
    : 'inspection-photos';

  const preset = IMAGE_PRESETS[size];
  const options = preset
    ? { transform: { width: preset.width, quality: preset.quality } }
    : undefined;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600, options);

  if (error || !data?.signedUrl) return '';
  return data.signedUrl;
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
    staleTime: 30 * 60 * 1000, // 30 min — signed URLs are valid for 1h
    gcTime: 60 * 60 * 1000,    // 1h garbage collection
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Lazy signed URL hook — resolves signed URLs for imported photos AFTER the
 * initial photo list has rendered. This eliminates the blocking waterfall
 * where fetching photos waited for all signed URLs before returning data.
 *
 * Usage: call this with the photos array from useInspectionPhotos. It returns
 * a Map<photoId, signedUrl> that updates asynchronously.
 */
export function useSignedUrls(photos: InspectionPhotoRow[]) {
  const importedPhotos = photos.filter(p => p.storagePath.startsWith('inspection-imports/'));
  const pathsKey = importedPhotos.map(p => p.id).sort().join(',');

  return useQuery({
    queryKey: ['signed-urls', pathsKey],
    queryFn: async (): Promise<Map<string, string>> => {
      if (importedPhotos.length === 0) return new Map();
      const BATCH_SIZE = 50;
      const urlMap = new Map<string, string>();

      for (let i = 0; i < importedPhotos.length; i += BATCH_SIZE) {
        const batch = importedPhotos.slice(i, i + BATCH_SIZE);
        const paths = batch.map(p => p.storagePath);
        try {
          const { data: signedData } = await supabase.storage
            .from('asset-documents')
            .createSignedUrls(paths, 3600);

          if (signedData) {
            for (let j = 0; j < signedData.length; j++) {
              const url = signedData[j]?.signedUrl;
              if (url) {
                urlMap.set(batch[j]!.id, url);
              }
            }
          }
        } catch {
          // Silent fallback
        }
      }
      return urlMap;
    },
    enabled: importedPhotos.length > 0,
    staleTime: 45 * 60 * 1000, // 45 min (signed URLs valid 1h)
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
