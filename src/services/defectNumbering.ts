import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Blade position (1/2/3) → letter (A/B/C), used across defect numbering. */
export const BLADE_LETTERS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

export const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Whether a string is a 36-char UUID (defect.description ↔ annotation.id link). */
export function isUuid(value: string): boolean {
  return value.length === 36 && UUID_RE.test(value);
}

/**
 * Reproduce the Analyze step numbering (A1, A34, B4, ...) over the whole
 * campaign, returning a map annotationId → code.
 *
 * Analyze loads ALL annotations of ALL inspections of the CAMPAIGN, ordered by
 * created_at ASC, and keeps a per-blade counter incremented for EVERY
 * annotation (whether or not it is a quotable defect). The blade letter of an
 * annotation is derived from its photo: annotation.thumbnail_id →
 * inspection_photo.id → inspection_photo.blade_id → blade.position (1→A,2→B,3→C).
 *
 * This is the SINGLE source of truth for defect numbering: both the quote flow
 * (quotes.service) and the repair workflow (repair.service) import it so their
 * numbers can never diverge again.
 *
 * The `turbineInspectionIds` seed is expanded internally to the full campaign
 * inspection set, so callers can pass either the turbine's inspection ids or the
 * inspection ids of the defects they are numbering.
 */
export async function buildCampaignAnnotationCodeMap(
  turbineInspectionIds: string[],
): Promise<{ codeMap: Map<string, string>; bladeMap: Map<string, string> }> {
  const codeMap = new Map<string, string>();
  const bladeMap = new Map<string, string>();
  if (turbineInspectionIds.length === 0) return { codeMap, bladeMap };

  // 1. Resolve the full set of inspection IDs for the campaign(s) that the
  //    seed inspections belong to. Analyze numbers over the whole campaign,
  //    which is why numbers can be high (e.g. A34).
  const { data: turbineInsps } = await supabase
    .from('inspection')
    .select('id, campaign_id')
    .in('id', turbineInspectionIds);

  const campaignIds = new Set<string>();
  for (const i of (turbineInsps ?? [])) {
    const cid = (i as { campaign_id: string | null }).campaign_id;
    if (cid) campaignIds.add(cid);
  }

  const allInspectionIds = new Set<string>(turbineInspectionIds);
  if (campaignIds.size > 0) {
    const { data: campaignInsps } = await supabase
      .from('inspection')
      .select('id, campaign_id')
      .in('campaign_id', Array.from(campaignIds));
    for (const i of (campaignInsps ?? [])) {
      allInspectionIds.add((i as { id: string }).id);
    }
  }
  // Defects in inspections without a campaign_id keep the seed inspection set
  // (already seeded above), so they are never lost.

  // 2. Load ALL annotations of that inspection set, ordered EXACTLY like Analyze.
  const { data: annotations } = await supabase
    .from('annotation')
    .select('id, thumbnail_id, inspection_id, created_at')
    .in('inspection_id', Array.from(allInspectionIds))
    .order('created_at', { ascending: true });

  const annRows = (annotations ?? []) as Array<{
    id: string;
    thumbnail_id: string | null;
  }>;
  if (annRows.length === 0) return { codeMap, bladeMap };

  // 3. Build photoId(thumbnail_id) → bladeLetter.
  const thumbnailIds = Array.from(
    new Set(annRows.map((a) => a.thumbnail_id).filter((v): v is string => !!v)),
  );

  const { data: photos } = thumbnailIds.length > 0
    ? await db.from('inspection_photo').select('id, blade_id').in('id', thumbnailIds)
    : { data: [] };
  const photoRows = (photos ?? []) as Array<{ id: string; blade_id: string | null }>;

  const bladeIds = Array.from(
    new Set(photoRows.map((p) => p.blade_id).filter((v): v is string => !!v)),
  );

  const { data: blades } = bladeIds.length > 0
    ? await supabase.from('blade').select('id, position').in('id', bladeIds)
    : { data: [] };
  const bladeRows = (blades ?? []) as Array<{ id: string; position: number | null }>;

  const bladeLetterById = new Map<string, string>();
  for (const b of bladeRows) {
    const pos = Number(b.position) || 0;
    bladeLetterById.set(b.id, BLADE_LETTERS[pos] ?? String(pos));
  }

  const letterByPhotoId = new Map<string, string>();
  for (const p of photoRows) {
    if (p.blade_id) {
      const letter = bladeLetterById.get(p.blade_id);
      if (letter) letterByPhotoId.set(p.id, letter);
    }
  }

  // 4. Reproduce the per-blade counter, incrementing for EVERY annotation.
  const counters: Record<string, number> = {};
  for (const a of annRows) {
    const letter = a.thumbnail_id ? letterByPhotoId.get(a.thumbnail_id) : undefined;
    if (!letter) continue;
    counters[letter] = (counters[letter] || 0) + 1;
    codeMap.set(a.id, `${letter}${counters[letter]}`);
    // The real blade of the defect is the blade of its annotation's photo,
    // NOT inspection.blade_id (which points to a single blade per turbine).
    bladeMap.set(a.id, letter);
  }

  return { codeMap, bladeMap };
}
