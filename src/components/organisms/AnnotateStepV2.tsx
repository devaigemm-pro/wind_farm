import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import { useCreateAnnotation, useUpdateAnnotation, useDeleteAnnotation, useCampaignInspectionIds, useMultiAnnotations } from '@/hooks/useAnnotations';
import { useInspectionPhotos, getPhotoPublicUrl, getFaceShort } from '@/hooks/useInspectionPhotos';
import { useUpdateVerticalBlade } from '@/hooks/useInspectionMutations';
import { useTogglePhotoTag, useMarkPhotoViewed } from '@/hooks/usePhotoTags';
import { useAnnotationTypes } from '@/hooks/useAnnotationTypes';
import { supabase } from '@/lib/supabase';
import type { Inspection } from '@/types';
import { BLADE_POSITION_LABELS } from '@/types';

// ─── Face short → DB value mapping ───────────────────────────────────────────
const FACE_SHORT_TO_DB: Record<string, string> = {
  LE: 'leading_edge',
  TE: 'trailing_edge',
  SS: 'suction_side',
  PS: 'pressure_side',
};

export interface AnnotateStepV2Props {
  inspectionId: string;
  inspection?: Inspection;
  campaignId?: string | null;
  savedThumbId?: string | null;
  savedBlade?: string | null;
  onSelectionChange?: (thumbId: string, blade: string) => void;
}

// ─── Thumbnail data derived from inspection_photo ────────────────────────────
interface ThumbnailData {
  id: string;
  src: string;
  viewerSrc: string;
  blade: string;
  face: string;
  hasAnnotation: boolean;
  isTagged: boolean;
  bladeRootDistance: number | null;
  distanceToBlade: number | null;
}

export function AnnotateStepV2({ inspectionId, inspection, campaignId: propCampaignId, savedThumbId, savedBlade, onSelectionChange }: AnnotateStepV2Props) {
  const { role } = useAuth();
  const { t } = useLanguage();

  // ─── Fetch ALL inspections of the campaign ─────────────────────────────────
  const campaignId = propCampaignId ?? inspection?.campaign_id ?? null;
  const { data: campaignInspIds = [] } = useCampaignInspectionIds(campaignId);

  // ─── Load annotations from ALL inspections in the campaign ─────────────────
  const { data: dbAnnotations = [], isLoading: annotationsLoading } = useMultiAnnotations(
    campaignInspIds.length > 0 ? campaignInspIds : (inspectionId ? [inspectionId] : [])
  );
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation(inspectionId);
  const deleteAnnotation = useDeleteAnnotation(inspectionId);
  const { data: annotationTypes = [] } = useAnnotationTypes();
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Fetch photos from inspection_photo table (ALL blades of the campaign) ─
  const { data: photos = [], isLoading: photosLoading } = useInspectionPhotos(campaignId, null);

  // ─── Build bladeId → position letter mapping ──────────────────────────────
  const bladePositionMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const posLetters: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };
    for (const photo of photos) {
      if (!map[photo.bladeId]) {
        map[photo.bladeId] = posLetters[photo.bladePosition] ?? String(photo.bladePosition);
      }
    }
    return map;
  }, [photos]);

  // Reverse map: position letter → bladeId (for updating photo blade assignment)
  const letterToBladeId = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const [bladeId, letter] of Object.entries(bladePositionMap)) {
      if (!map[letter]) map[letter] = bladeId;
    }
    return map;
  }, [bladePositionMap]);

  // ─── Blade serial numbers from photo data ───────────────────────────────────
  const bladeSerials: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    const posL: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };
    for (const photo of photos) {
      const posLetter = posL[photo.bladePosition] ?? String(photo.bladePosition);
      if (photo.bladeSerialNumber && !map[posLetter]) {
        map[posLetter] = photo.bladeSerialNumber;
      }
    }
    return map;
  }, [photos]);

  // ─── Tagged photos from BD ──────────────────────────────────────────────────
  const toggleTag = useTogglePhotoTag();
  const markViewed = useMarkPhotoViewed();
  const taggedPhotos = useMemo(() => {
    return new Set(photos.filter(p => p.isTagged).map(p => p.id));
  }, [photos]);

  // ─── Derive thumbnails from real photo data ────────────────────────────────
  const thumbnails = useMemo<ThumbnailData[]>(() => {
    if (!photos || photos.length === 0) return [];
    const annotatedPhotoIds = new Set(dbAnnotations.map((a) => a.thumbnailId));
    return photos.map((photo) => ({
      id: photo.id,
      src: photo.thumbnailUrl || getPhotoPublicUrl(photo.storagePath, 'thumbnail'),
      viewerSrc: getPhotoPublicUrl(photo.storagePath, 'viewer'),
      blade: bladePositionMap[photo.bladeId] ?? 'A',
      face: getFaceShort(photo.face),
      hasAnnotation: annotatedPhotoIds.has(photo.id),
      isTagged: taggedPhotos.has(photo.id),
      bladeRootDistance: photo.bladeRootDistance,
      distanceToBlade: photo.distanceToBlade,
    }));
  }, [photos, dbAnnotations, bladePositionMap, taggedPhotos]);

  // ─── Helper: compute root distance from photo metadata + annotation Y ───
  function computeRootDistance(thumbnailId: string, yPercent: number): number {
    const thumb = thumbnails.find(t => t.id === thumbnailId);
    if (thumb && thumb.bladeRootDistance != null) {
      const dtb = thumb.distanceToBlade || 5;
      const vertCoverage = 2 * dtb * Math.tan((56.7 * Math.PI / 180) / 2) / 6;
      const offset = (yPercent / 100) * vertCoverage;
      return Math.round((thumb.bladeRootDistance + offset) * 10) / 10;
    }
    return Math.round(yPercent * 0.43 * 10) / 10;
  }

  // Group DB annotations by thumbnail_id for rendering
  const savedAnnotations = useMemo(() => {
    const grouped: Record<string, { id: string; x: number; y: number; w: number; h: number; angle: number; type: string; category: number; note: string }[]> = {};
    for (const ann of dbAnnotations) {
      if (!grouped[ann.thumbnailId]) grouped[ann.thumbnailId] = [];
      grouped[ann.thumbnailId]!.push({
        id: ann.id,
        x: ann.x,
        y: ann.y,
        w: ann.w,
        h: ann.h,
        angle: ann.angle,
        type: ann.type,
        category: ann.category,
        note: ann.note,
      });
    }
    return grouped;
  }, [dbAnnotations]);

  const [fastForward, setFastForward] = useState(false);
  const [selectedBlades, setSelectedBlades] = useState<Set<string>>(new Set(['A', 'B', 'C']));
  const [selectedFaces, setSelectedFaces] = useState<Set<string>>(new Set(['SS', 'PS', 'LE', 'TE']));
  const [selectedThumbnail, setSelectedThumbnail] = useState<string>(savedThumbId || '');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedDefectBlade, setSelectedDefectBlade] = useState<string>(savedBlade || 'A');

  // Right panel state
  const [changeBladeExpanded, setChangeBladeExpanded] = useState(false);
  const [comparisonExpanded, setComparisonExpanded] = useState(true);
  const [turbineInfoExpanded, setTurbineInfoExpanded] = useState(true);
  const [showBladeConfirm, setShowBladeConfirm] = useState(false);
  const storageKey = `vertical-blade-${inspectionId}`;
  const [verticalBlade, setVerticalBlade] = useState<string>(() => {
    const dbVal = (inspection as any)?.vertical_blade;
    if (dbVal && ['A', 'B', 'C'].includes(dbVal)) return dbVal;
    return localStorage.getItem(storageKey) || 'A';
  });
  const [pendingVerticalBlade, setPendingVerticalBlade] = useState<string>(() => {
    const dbVal = (inspection as any)?.vertical_blade;
    if (dbVal && ['A', 'B', 'C'].includes(dbVal)) return dbVal;
    return localStorage.getItem(storageKey) || 'A';
  });
  const updateVerticalBladeMutation = useUpdateVerticalBlade(inspectionId);

  // Sync verticalBlade from inspection data or localStorage when it loads
  useEffect(() => {
    const dbBlade = (inspection as any)?.vertical_blade;
    if (dbBlade && ['A', 'B', 'C'].includes(dbBlade)) {
      setVerticalBlade(dbBlade);
      setPendingVerticalBlade(dbBlade);
    } else {
      const stored = localStorage.getItem(storageKey);
      if (stored && ['A', 'B', 'C'].includes(stored)) {
        setVerticalBlade(stored);
        setPendingVerticalBlade(stored);
      }
    }
  }, [inspection, storageKey]);

  const [showEditPopover, setShowEditPopover] = useState(false);
  const [showAnnotationPopover, setShowAnnotationPopover] = useState(false);
  const [annotationClickPos, setAnnotationClickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [annotationType, setAnnotationType] = useState('LE EROSION');
  const [annotationCategory, setAnnotationCategory] = useState(2);
  const [annotationNote, setAnnotationNote] = useState('');
  const [annotationSuggestionsOpen, setAnnotationSuggestionsOpen] = useState(false);

  const thumbnailAnnotations = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [thumbId, anns] of Object.entries(savedAnnotations)) {
      counts[thumbId] = anns.length;
    }
    return counts;
  }, [savedAnnotations]);

  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);
  const [drawConfirmed, setDrawConfirmed] = useState(false);
  const [drawPhase, setDrawPhase] = useState<'idle' | 'drawing-line' | 'expanding'>('idle');
  const [drawWidth, setDrawWidth] = useState(3);
  const [drawShape, setDrawShape] = useState<'rect' | 'oval'>('rect');
  const isMouseDownRef = useRef(false);
  const viewerImgRef = useRef<HTMLImageElement | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

  // ─── Image transition ──────────────────────────────────────────────────────
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const prevThumbRef = useRef<string>('');

  const computeImageRect = useCallback(() => {
    const img = viewerImgRef.current;
    const container = viewerContainerRef.current;
    if (!img || !container || !img.naturalWidth || !img.naturalHeight) {
      const cw = container?.clientWidth || 1;
      const ch = container?.clientHeight || 1;
      return { offsetX: 0, offsetY: 0, width: cw, height: ch };
    }
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const containerAR = cw / ch;
    const imageAR = img.naturalWidth / img.naturalHeight;
    let imgWidth: number, imgHeight: number, offsetX: number, offsetY: number;
    if (imageAR > containerAR) {
      imgWidth = cw; imgHeight = cw / imageAR; offsetX = 0; offsetY = (ch - imgHeight) / 2;
    } else {
      imgHeight = ch; imgWidth = ch * imageAR; offsetX = (cw - imgWidth) / 2; offsetY = 0;
    }
    return { offsetX, offsetY, width: imgWidth, height: imgHeight };
  }, []);

  const [, setLayoutTick] = useState(0);

  const getImageRect = useCallback((_containerRect: DOMRect) => {
    return computeImageRect();
  }, [computeImageRect]);

  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editBlade, setEditBlade] = useState('B');
  const [editSide, setEditSide] = useState('LE');
  const [editRootDistance, setEditRootDistance] = useState(0);
  const [editDistanceToBlade, setEditDistanceToBlade] = useState(4.2);
  const [metaBlade, setMetaBlade] = useState('A');
  const [metaSide, setMetaSide] = useState('LE');
  const [metaRootDist, setMetaRootDist] = useState(0);
  const [metaDistBlade, setMetaDistBlade] = useState(0);

  const recalcImgContentStyle = useCallback(() => {
    setLayoutTick(t => t + 1);
  }, []);

  // ─── Image zoom & pan ───────────────────────────────────────────────────────
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.5, 6.0));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const next = Math.max(prev - 0.5, 1.0);
      if (next === 1.0) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);
  const handleZoomReset = useCallback(() => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // ─── Image adjustments ─────────────────────────────────────────────────────
  const [imgContrast, setImgContrast] = useState(1);
  const [imgBrightness, setImgBrightness] = useState(1);
  const [imgSaturation, setImgSaturation] = useState(1);
  const [showImageAdjust, setShowImageAdjust] = useState(false);
  const [showBladeOverlay, setShowBladeOverlay] = useState(false);

  // Reset loaded state when thumbnail changes
  useEffect(() => {
    if (selectedThumbnail && selectedThumbnail !== prevThumbRef.current) {
      setViewerLoaded(false);
      setZoomLevel(1.0);
      setPanOffset({ x: 0, y: 0 });
      prevThumbRef.current = selectedThumbnail;
    }
  }, [selectedThumbnail]);

  // Keep imgContentStyle in sync with container size
  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      recalcImgContentStyle();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [recalcImgContentStyle]);

  // Preload adjacent images
  const preloadCache = useRef<Set<string>>(new Set());
  const preloadImage = useCallback((src: string) => {
    if (!src || preloadCache.current.has(src)) return;
    preloadCache.current.add(src);
    const img = new Image();
    img.src = src;
  }, []);

  const filteredThumbnails = useMemo(() => {
    return thumbnails.filter(t => {
      if (selectedBlades.size > 0 && !selectedBlades.has(t.blade)) return false;
      if (selectedFaces.size > 0 && !selectedFaces.has(t.face)) return false;
      if (categoryFilter === 'unseen') return !t.hasAnnotation && !t.isTagged && !((thumbnailAnnotations[t.id] ?? 0) > 0);
      if (categoryFilter === 'tagged') return t.isTagged;
      if (categoryFilter === 'annots') return t.hasAnnotation || ((thumbnailAnnotations[t.id] ?? 0) > 0);
      return true;
    });
  }, [selectedBlades, selectedFaces, categoryFilter, thumbnailAnnotations, thumbnails]);

  const groupedThumbnails = useMemo(() => {
    const faceOrder = ['LE', 'TE', 'PS', 'SS'];
    const bladeOrder = ['A', 'B', 'C'];
    const groups: Record<string, ThumbnailData[]> = {};
    for (const blade of bladeOrder) {
      for (const face of faceOrder) {
        const serial = bladeSerials[blade];
        const label = serial ? `${blade} (${serial}) - ${face}` : `${blade} - ${face}`;
        const items = filteredThumbnails.filter(t => t.blade === blade && t.face === face);
        if (items.length > 0) {
          groups[label] = items;
        }
      }
    }
    return groups;
  }, [filteredThumbnails, bladeSerials]);

  // Auto-select first thumbnail
  useEffect(() => {
    if (thumbnails.length > 0 && !selectedThumbnail) {
      const firstGroup = Object.values(groupedThumbnails)[0];
      const firstVisible = firstGroup?.[0];
      const target = firstVisible || thumbnails[0]!;
      setSelectedThumbnail(target.id);
      setSelectedDefectBlade(target.blade);
      if (target.bladeRootDistance != null) setMetaRootDist(Math.round(target.bladeRootDistance));
      if (target.distanceToBlade != null) setMetaDistBlade(Math.round(target.distanceToBlade));
      onSelectionChange?.(target.id, target.blade);
      markViewed.mutate({ photoId: target.id, campaignId });
    }
  }, [thumbnails, groupedThumbnails]);

  // Navigation helpers
  const flatFilteredThumbs = useMemo(() => {
    const flat: ThumbnailData[] = [];
    for (const thumbs of Object.values(groupedThumbnails)) {
      flat.push(...thumbs);
    }
    return flat;
  }, [groupedThumbnails]);

  const currentThumbIndex = flatFilteredThumbs.findIndex(t => t.id === selectedThumbnail);

  const groupBoundaries = useMemo(() => {
    const boundaries: number[] = [];
    let offset = 0;
    for (const thumbs of Object.values(groupedThumbnails)) {
      boundaries.push(offset);
      offset += thumbs.length;
    }
    return boundaries;
  }, [groupedThumbnails]);

  // Preload next/prev viewer images
  useEffect(() => {
    if (flatFilteredThumbs.length === 0 || currentThumbIndex < 0) return;
    const prevIdx = currentThumbIndex > 0 ? currentThumbIndex - 1 : flatFilteredThumbs.length - 1;
    const nextIdx = currentThumbIndex < flatFilteredThumbs.length - 1 ? currentThumbIndex + 1 : 0;
    preloadImage(flatFilteredThumbs[prevIdx]?.viewerSrc ?? '');
    preloadImage(flatFilteredThumbs[nextIdx]?.viewerSrc ?? '');
    const next2Idx = (currentThumbIndex + 2) % flatFilteredThumbs.length;
    preloadImage(flatFilteredThumbs[next2Idx]?.viewerSrc ?? '');
  }, [currentThumbIndex, flatFilteredThumbs, preloadImage]);

  // Escape key cancels drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawPhase !== 'idle' || drawStart || drawEnd) {
          setDrawPhase('idle');
          setDrawStart(null);
          setDrawEnd(null);
          setDrawConfirmed(false);
          setDrawWidth(3);
          isMouseDownRef.current = false;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawPhase, drawStart, drawEnd]);

  // Auto-scroll selected thumbnail into view
  useEffect(() => {
    if (selectedThumbnail) {
      const el = document.getElementById(`thumb-${selectedThumbnail}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedThumbnail]);

  // ─── Turbine info ──────────────────────────────────────────────────────────
  const turbine = inspection?.blade?.turbine ?? inspection?.turbine;
  const turbineId = turbine?.id ?? (inspection as any)?.turbine_id ?? null;
  const turbineModel = (turbine as any)?.model ?? '—';
  const turbinePower = (turbine as any)?.power_kw ? `${(turbine as any).power_kw} kW` : '—';
  const turbineCommissioning = (turbine as any)?.powering_date
    ? new Date((turbine as any).powering_date).toLocaleDateString()
    : '—';

  // ─── Comparison inspections ────────────────────────────────────────────────
  const { data: turbineInspections = [] } = useQuery({
    queryKey: ['turbine-inspections-comparison', turbineId],
    queryFn: async () => {
      if (!turbineId) return [];
      const { data, error } = await supabase
        .from('inspection')
        .select('id, scheduled_date, status, campaign_id')
        .or(`turbine_id.eq.${turbineId}`)
        .order('scheduled_date', { ascending: false })
        .limit(10);
      if (error || !data) return [];
      return data as { id: string; scheduled_date: string; status: string; campaign_id: string | null }[];
    },
    enabled: !!turbineId,
    staleTime: 5 * 60_000,
  });

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (photosLoading || annotationsLoading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-[3px] border-gray-200 border-t-[#5A8F5A] animate-spin" />
          <span className="text-[13px] text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  const annotsCount = thumbnails.filter(t => t.hasAnnotation || ((thumbnailAnnotations[t.id] ?? 0) > 0)).length;

  // Compute image rect for annotation layer
  const imgRect = computeImageRect();
  const imgContentStyle = {
    top: `${imgRect.offsetY}px`,
    left: `${imgRect.offsetX}px`,
    width: `${imgRect.width}px`,
    height: `${imgRect.height}px`,
  };
  const taggedCount = thumbnails.filter(t => t.isTagged).length;
  const unseenCount = thumbnails.filter(t => !t.hasAnnotation && !t.isTagged && !((thumbnailAnnotations[t.id] ?? 0) > 0)).length;
  const viewedCount = photos.filter(p => p.isViewed).length;
  const reviewProgress = thumbnails.length > 0 ? Math.round((viewedCount / thumbnails.length) * 100) : 0;

  // Sync right panel when thumbnail changes
  const handleThumbnailSelect = (thumbId: string) => {
    setSelectedThumbnail(thumbId);
    markViewed.mutate({ photoId: thumbId, campaignId });
    const thumb = thumbnails.find(t => t.id === thumbId);
    if (thumb) {
      setSelectedDefectBlade(thumb.blade);
      setMetaBlade(thumb.blade);
      setMetaSide(thumb.face);
      if (thumb.bladeRootDistance != null) setMetaRootDist(Math.round(thumb.bladeRootDistance));
      if (thumb.distanceToBlade != null) setMetaDistBlade(Math.round(thumb.distanceToBlade));
      onSelectionChange?.(thumbId, thumb.blade);
    }
  };

  const handlePrevPhoto = () => {
    if (flatFilteredThumbs.length === 0) return;
    if (fastForward) {
      const prevIndex = (currentThumbIndex - 3 + flatFilteredThumbs.length) % flatFilteredThumbs.length;
      handleThumbnailSelect(flatFilteredThumbs[prevIndex]!.id);
    } else {
      const prevIndex = currentThumbIndex > 0 ? currentThumbIndex - 1 : flatFilteredThumbs.length - 1;
      handleThumbnailSelect(flatFilteredThumbs[prevIndex]!.id);
    }
  };

  const handleNextPhoto = () => {
    if (flatFilteredThumbs.length === 0) return;
    if (fastForward) {
      const nextIndex = (currentThumbIndex + 3) % flatFilteredThumbs.length;
      handleThumbnailSelect(flatFilteredThumbs[nextIndex]!.id);
    } else {
      const nextIndex = currentThumbIndex < flatFilteredThumbs.length - 1 ? currentThumbIndex + 1 : 0;
      handleThumbnailSelect(flatFilteredThumbs[nextIndex]!.id);
    }
  };

  const handleToggleFlag = () => {
    if (role === 'supervisor') return;
    if (!selectedThumbnail) return;
    const currentlyTagged = taggedPhotos.has(selectedThumbnail);
    toggleTag.mutate({ photoId: selectedThumbnail, isTagged: !currentlyTagged });
  };

  const currentThumb = thumbnails.find(t => t.id === selectedThumbnail);
  const selectedBladeLabel = `${pendingVerticalBlade} - ${bladeSerials[pendingVerticalBlade] || ''}`;

  const toggleBlade = (blade: string) => {
    setSelectedBlades(prev => {
      const next = new Set(prev);
      if (next.has(blade)) next.delete(blade);
      else next.add(blade);
      return next;
    });
  };

  const toggleFace = (face: string) => {
    setSelectedFaces(prev => {
      const next = new Set(prev);
      if (next.has(face)) next.delete(face);
      else next.add(face);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F7F8FA] relative min-w-[1100px]">
      {/* ═══ TOP: VIEWER + TOOLBAR (takes most of the space) ═══ */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* ─── Compact left filter panel ─── */}
        <div className="w-[200px] min-w-[200px] flex flex-col bg-white border-r border-gray-100 overflow-hidden shadow-sm">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Fast forward + progress */}
            <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
              <span className="text-[11px] text-gray-500 font-medium">{t('annotate.fastForwardMode')}</span>
              <label className="relative inline-flex cursor-pointer">
                <input
                  type="checkbox"
                  checked={fastForward}
                  onChange={() => setFastForward(!fastForward)}
                  className="absolute opacity-0 w-0 h-0"
                />
                <span className={cn(
                  'w-8 h-[18px] rounded-full relative transition-colors duration-200',
                  fastForward ? 'bg-[#5A8F5A]' : 'bg-gray-300'
                )}>
                  <span className={cn(
                    'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-[left] duration-200',
                    fastForward ? 'left-[16px]' : 'left-[2px]'
                  )} />
                </span>
              </label>
            </div>

            {/* Progress bar */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Progress</span>
                <span className="text-[11px] font-bold text-[#5A8F5A]">{reviewProgress}%</span>
              </div>
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#5A8F5A] rounded-full transition-[width] duration-300" style={{ width: `${reviewProgress}%` }} />
              </div>
            </div>
            {/* Blade + Face filters — compact */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex gap-px mb-1.5">
                {['A', 'B', 'C'].map((blade) => (
                  <button
                    key={blade}
                    onClick={() => toggleBlade(blade)}
                    className={cn(
                      'flex-1 py-1 text-[10px] font-bold cursor-pointer outline-none border border-[#5A8F5A] transition-all',
                      selectedBlades.has(blade) ? 'bg-[#5A8F5A] text-white' : 'bg-white text-[#5A8F5A]',
                      blade === 'A' && 'rounded-l',
                      blade === 'C' && 'rounded-r'
                    )}
                  >
                    {blade}
                  </button>
                ))}
              </div>
              <div className="flex gap-px">
                {['SS', 'PS', 'LE', 'TE'].map((face, idx) => (
                  <button
                    key={face}
                    onClick={() => toggleFace(face)}
                    className={cn(
                      'flex-1 py-1 text-[10px] font-bold cursor-pointer outline-none border border-[#5A8F5A] transition-all',
                      selectedFaces.has(face) ? 'bg-[#5A8F5A] text-white' : 'bg-white text-[#5A8F5A]',
                      idx === 0 && 'rounded-l',
                      idx === 3 && 'rounded-r'
                    )}
                  >
                    {face}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filters — compact pills */}
            <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-gray-100">
              <button
                onClick={() => setCategoryFilter(categoryFilter === 'unseen' ? null : 'unseen')}
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition-all',
                  categoryFilter === 'unseen' ? 'border-[#5A8F5A] bg-[#5A8F5A]/10 text-[#5A8F5A]' : 'border-gray-200 text-gray-500'
                )}
              >
                {unseenCount} unseen
              </button>
              <button
                onClick={() => setCategoryFilter(categoryFilter === 'tagged' ? null : 'tagged')}
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition-all',
                  categoryFilter === 'tagged' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-500'
                )}
              >
                {taggedCount} tagged
              </button>
              <button
                onClick={() => setCategoryFilter(categoryFilter === 'annots' ? null : 'annots')}
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition-all',
                  categoryFilter === 'annots' ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500'
                )}
              >
                {annotsCount} annots
              </button>
            </div>

          {/* Thumbnails grid */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {Object.entries(groupedThumbnails).map(([group, thumbs]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-gray-800 my-1">{group}</p>
                <div className="grid grid-cols-3 gap-1">
                  {thumbs.map(t => (
                    <div
                      key={t.id}
                      id={`thumb-${t.id}`}
                      onClick={() => handleThumbnailSelect(t.id)}
                      className={cn(
                        'relative aspect-[4/3] rounded-sm overflow-hidden cursor-pointer bg-gray-300',
                        selectedThumbnail === t.id ? 'border-[3px] border-[#5A8F5A]' : 'border-[3px] border-transparent'
                      )}
                    >
                      <img
                        src={t.src}
                        alt="thumbnail"
                        className="w-full h-full object-cover rounded-sm"
                        loading="lazy"
                        draggable={false}
                      />
                      {(thumbnailAnnotations[t.id] ?? 0) > 0 && (
                        <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                          {thumbnailAnnotations[t.id]}
                        </div>
                      )}
                      {taggedPhotos.has(t.id) && (
                        <div className="absolute top-1 left-1 w-3 h-3 rounded-full bg-yellow-400 border-2 border-white shadow" />
                      )}
                    </div>
                  ))}
                </div>
                <hr className="border-none border-t border-gray-100 my-2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ MAIN VIEWER ═══ */}
      <div className="flex-1 flex flex-col overflow-auto relative annotate-viewer">
        {/* Image toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-gray-100 min-h-[40px] gap-2">
          {/* Left: nav buttons + flag */}
          <div className="flex items-center gap-1">
            <div className="flex">
              <button
                className="flex items-center justify-center w-8 h-[30px] border border-[#5A8F5A] bg-transparent cursor-pointer p-0 rounded-l"
                title={t('annotate.previous')}
                onClick={handlePrevPhoto}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#5A8F5A"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
              </button>
              <button
                className="flex items-center justify-center w-8 h-[30px] border border-[#5A8F5A] border-l-0 bg-transparent cursor-pointer p-0 rounded-r"
                title={t('annotate.next')}
                onClick={handleNextPhoto}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#5A8F5A"><path d="m6 18 8.5-6L6 6zM16 6v12h2V6z" /></svg>
              </button>
            </div>
            {role !== 'supervisor' && (
              <button
                className={cn(
                  'flex items-center justify-center w-8 h-[30px] border border-yellow-400 rounded cursor-pointer p-0',
                  taggedPhotos.has(selectedThumbnail) ? 'bg-yellow-400/20' : 'bg-transparent'
                )}
                title={t('annotate.flag')}
                onClick={handleToggleFlag}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFEB3B"><path d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z" /></svg>
              </button>
            )}
            {/* Shape toggle: rect / oval */}
            {role !== 'supervisor' && (
              <div className="flex border border-[#5A8F5A] rounded overflow-hidden ml-1">
                <button
                  onClick={() => setDrawShape('rect')}
                  className={cn(
                    'p-1 px-2 border-none cursor-pointer flex items-center',
                    drawShape === 'rect' ? 'bg-[#5A8F5A]' : 'bg-transparent'
                  )}
                  title={t('annotate.rectangle')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={drawShape === 'rect' ? '#fff' : '#5A8F5A'}><path d="M3 5v14h18V5H3zm16 12H5V7h14v10z" /></svg>
                </button>
                <button
                  onClick={() => setDrawShape('oval')}
                  className={cn(
                    'p-1 px-2 border-none border-l border-l-[#5A8F5A] cursor-pointer flex items-center',
                    drawShape === 'oval' ? 'bg-[#5A8F5A]' : 'bg-transparent'
                  )}
                  title={t('annotate.oval')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={drawShape === 'oval' ? '#fff' : '#5A8F5A'}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" /></svg>
                </button>
              </div>
            )}
          </div>

          {/* Center: metadata info */}
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <span className="text-xs text-gray-800 select-none">
              <span>{t('annotate.blade')}</span><strong>{metaBlade}-{bladeSerials[metaBlade]}</strong>
              <span className="mx-1.5 text-gray-500">|</span>
              <span>{t('annotate.side')}</span><strong>{metaSide}</strong>
              <span className="mx-1.5 text-gray-500">|</span>
              <span>{t('annotate.bladeRootDistance')}</span><strong>{metaRootDist} m</strong>
              <span className="mx-1.5 text-gray-500">|</span>
              <span>{t('annotate.distanceToBlade')}</span><strong>{metaDistBlade} m</strong>
            </span>
            <div className="relative">
              {role !== 'supervisor' && (
                <button
                  className="px-3 py-0.5 border border-[#5A8F5A] rounded bg-transparent text-[#5A8F5A] text-xs font-medium cursor-pointer"
                  onClick={() => setShowEditPopover(!showEditPopover)}
                >
                  Edit
                </button>
              )}
              {/* Edit popover */}
              {showEditPopover && (
                <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 bg-white rounded-lg p-6 min-w-[300px] shadow-[0_5px_5px_-3px_rgba(0,0,0,0.2),0_8px_10px_1px_rgba(0,0,0,0.14),0_3px_14px_2px_rgba(0,0,0,0.12)]">
                  {/* Blade */}
                  <span className="block text-sm font-semibold text-gray-800 mb-2">Blade</span>
                  <div className="flex mb-4">
                    {['A', 'B', 'C'].map((b, idx) => (
                      <button
                        key={b}
                        onClick={() => setEditBlade(b)}
                        className={cn(
                          'py-1.5 px-4 border border-[#5A8F5A] text-sm font-semibold cursor-pointer outline-none',
                          editBlade === b ? 'bg-[#5A8F5A] text-white' : 'bg-white text-[#5A8F5A]',
                          idx === 0 && 'rounded-l',
                          idx === 2 && 'rounded-r',
                          idx > 0 && '-ml-px'
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>

                  {/* Side */}
                  <span className="block text-sm font-semibold text-gray-800 mb-2">Side</span>
                  <div className="flex mb-4">
                    {['PS', 'SS', 'LE', 'TE'].map((s, idx) => (
                      <button
                        key={s}
                        onClick={() => setEditSide(s)}
                        className={cn(
                          'py-1.5 px-4 border border-[#5A8F5A] text-sm font-semibold cursor-pointer outline-none',
                          editSide === s ? 'bg-[#5A8F5A] text-white' : 'bg-white text-[#5A8F5A]',
                          idx === 0 && 'rounded-l',
                          idx === 3 && 'rounded-r',
                          idx > 0 && '-ml-px'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Blade root distance */}
                  <span className="block text-sm font-semibold text-gray-800 mb-2">Blade root distance (m)</span>
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={editRootDistance}
                      onChange={e => setEditRootDistance(Number(e.target.value))}
                      className="flex-1 accent-[#5A8F5A]"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={editRootDistance}
                      onChange={e => setEditRootDistance(Number(e.target.value))}
                      className="w-[70px] py-1.5 px-2 border border-gray-100 rounded text-sm text-gray-800 outline-none text-center bg-white"
                    />
                  </div>

                  {/* Distance to blade */}
                  <span className="block text-sm font-semibold text-gray-800 mb-2">Distance to blade (m)</span>
                  <div className="mb-4">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={editDistanceToBlade}
                      onChange={e => setEditDistanceToBlade(Number(e.target.value))}
                      className="w-[70px] py-1.5 px-2 border border-gray-100 rounded text-sm text-gray-800 outline-none text-center bg-white"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button className="px-5 py-2 bg-gray-200 text-gray-800 border-none rounded text-sm font-semibold cursor-pointer" onClick={() => setShowEditPopover(false)}>{t('button.cancel')}</button>
                    <button className="px-5 py-2 bg-[#5A8F5A] text-white border-none rounded text-sm font-semibold cursor-pointer" onClick={async () => {
                      setMetaBlade(editBlade);
                      setMetaSide(editSide);
                      setMetaRootDist(editRootDistance);
                      setMetaDistBlade(editDistanceToBlade);
                      setShowEditPopover(false);
                      // Persist changes to inspection_photo in DB
                      if (selectedThumbnail) {
                        const photo = photos.find(p => p.id === selectedThumbnail);
                        if (photo) {
                          try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const db = supabase as any;
                            const { data: currentRow } = await db
                              .from('inspection_photo')
                              .select('metadata')
                              .eq('id', selectedThumbnail)
                              .single();
                            const currentMeta = (currentRow?.metadata as Record<string, unknown>) || {};
                            const updates: Record<string, unknown> = {
                              metadata: {
                                ...currentMeta,
                                blade_root_distance: editRootDistance,
                                distance_to_blade: editDistanceToBlade,
                              },
                            };
                            const newBladeId = letterToBladeId[editBlade];
                            if (newBladeId && newBladeId !== photo.bladeId) {
                              updates.blade_id = newBladeId;
                            }
                            const newFace = FACE_SHORT_TO_DB[editSide];
                            if (newFace && newFace !== photo.face) {
                              updates.face = newFace;
                            }
                            await db
                              .from('inspection_photo')
                              .update(updates)
                              .eq('id', selectedThumbnail);
                          } catch (err) {
                            console.error('[AnnotateStepV2] Failed to persist photo edit:', err);
                          }
                        }
                      }
                    }}>{t('button.save')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: zoom + adjustments + download + delete */}
          <div className="flex items-center gap-1">
            {/* Zoom controls */}
            <div className="flex items-center border border-[#5A8F5A] rounded overflow-hidden mr-1">
              <button onClick={handleZoomOut} className="px-2 py-1 bg-transparent border-none border-r border-r-[#5A8F5A] cursor-pointer text-sm font-semibold text-[#5A8F5A] leading-none" title={t('annotate.zoomOut')}>−</button>
              <button onClick={handleZoomReset} className="px-2 py-1 bg-transparent border-none border-r border-r-[#5A8F5A] cursor-pointer text-[11px] text-[#5A8F5A] leading-none min-w-[40px] text-center" title={t('annotate.resetZoom')}>x{zoomLevel.toFixed(1)}</button>
              <button onClick={handleZoomIn} className="px-2 py-1 bg-transparent border-none cursor-pointer text-sm font-semibold text-[#5A8F5A] leading-none" title={t('annotate.zoomIn')}>+</button>
            </div>
            <button
              className={cn(
                'flex items-center justify-center w-8 h-[30px] border border-[#5A8F5A] rounded bg-transparent cursor-pointer p-0',
                showBladeOverlay && 'border-[#5A8F5A] bg-[rgba(90,143,90,0.1)]'
              )}
              title={t('annotate.bladeFaceView')}
              onClick={() => setShowBladeOverlay(v => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={showBladeOverlay ? '#5A8F5A' : '#555'}><path d="M7.47 21.49C4.2 19.93 1.86 16.76 1.5 13H0c.51 6.16 5.66 11 11.95 11 .23 0 .44-.02.66-.03L8.8 20.15l-1.33 1.34zM12.05 0c-.23 0-.44.02-.66.04l3.81 3.81 1.33-1.33C19.8 4.07 22.14 7.24 22.5 11H24c-.51-6.16-5.66-11-11.95-11zM16 14h2V8c0-1.11-.9-2-2-2h-6v2h6v6zm-8 2V4H6v2H4v2h2v8c0 1.1.9 2 2 2h8v2h2v-2h2v-2H8z" /></svg>
            </button>
            <button
              className={cn(
                'flex items-center justify-center w-8 h-[30px] border border-[#5A8F5A] rounded bg-transparent cursor-pointer p-0',
                showImageAdjust && 'border-[#5A8F5A] bg-[rgba(90,143,90,0.1)]'
              )}
              title={t('annotate.imageAdjustments')}
              onClick={() => setShowImageAdjust(v => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={showImageAdjust ? '#5A8F5A' : '#555'}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z" /></svg>
            </button>
            <button
              className="flex items-center justify-center w-8 h-[30px] border border-[#5A8F5A] rounded bg-transparent cursor-pointer p-0"
              title={t('annotate.downloadPhoto')}
              onClick={() => {
                if (!currentThumb) return;
                const url = currentThumb.viewerSrc;
                const filename = currentThumb.id + '.jpg';
                fetch(url)
                  .then(res => res.blob())
                  .then(blob => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(a.href);
                  })
                  .catch(() => {
                    window.open(url, '_blank');
                  });
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#5A8F5A"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96M17 13l-5 5-5-5h3V9h4v4z" /></svg>
            </button>
            {role !== 'supervisor' && (
              <button className="flex items-center justify-center w-8 h-[30px] border border-red-400 rounded bg-transparent cursor-pointer p-0" title={t('annotate.deletePhoto')} onClick={async () => {
                if (!selectedThumbnail) return;
                if (!window.confirm(t('annotate.confirmDeletePhoto') || 'Are you sure you want to delete this photo?')) return;
                try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const db = supabase as any;
                  const photo = photos.find(p => p.id === selectedThumbnail);
                  await db.from('annotation').delete().eq('thumbnail_id', selectedThumbnail);
                  await db.from('inspection_photo').delete().eq('id', selectedThumbnail);
                  if (photo && photo.storagePath && photo.storagePath.startsWith('inspection-imports/')) {
                    const originalPath = photo.storagePath.includes('?') ? photo.storagePath.split('?')[0] : photo.storagePath;
                    if (originalPath && !originalPath.startsWith('http')) {
                      const lastSlash = originalPath.lastIndexOf('/');
                      const dir = originalPath.substring(0, lastSlash);
                      const filename = originalPath.substring(lastSlash + 1);
                      await supabase.storage.from('asset-documents').remove([originalPath, `${dir}/thumb_${filename}`]);
                    }
                  }
                  window.location.reload();
                } catch (err) {
                  console.error('[AnnotateStepV2] Failed to delete photo:', err);
                }
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#F15959"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Image viewer with annotation drawing */}
        <div
          ref={viewerContainerRef}
          className={cn(
            'flex-[1_0_0] flex items-center justify-center bg-[#1a1a1a] overflow-hidden min-w-[600px] min-h-[400px] relative',
            drawPhase === 'expanding' ? 'cursor-ns-resize' : 'cursor-crosshair'
          )}
          onWheel={(e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
              setZoomLevel(prev => Math.min(prev + 0.25, 6.0));
            } else {
              setZoomLevel(prev => {
                const next = Math.max(prev - 0.25, 1.0);
                if (next === 1.0) setPanOffset({ x: 0, y: 0 });
                return next;
              });
            }
          }}
          onContextMenu={(e) => { if (zoomLevel > 1) e.preventDefault(); }}
          onMouseDown={(e) => {
            if (showAnnotationPopover) return;
            if ((e.button === 1 || e.button === 2) && zoomLevel > 1) {
              e.preventDefault();
              setIsPanning(true);
              panStartRef.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
              return;
            }
            if (e.button !== 0) return;
            if (role === 'supervisor') return;
            const rect = e.currentTarget.getBoundingClientRect();
            const imgRect = getImageRect(rect);
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;
            const imgX = Math.max(0, Math.min(100, ((rawX - imgRect.offsetX - imgRect.width / 2 - panOffset.x) / zoomLevel + imgRect.width / 2) / imgRect.width * 100));
            const imgY = Math.max(0, Math.min(100, ((rawY - imgRect.offsetY - imgRect.height / 2 - panOffset.y) / zoomLevel + imgRect.height / 2) / imgRect.height * 100));

            if (drawPhase === 'expanding') {
              setDrawConfirmed(true);
              setDrawPhase('idle');
              setShowAnnotationPopover(true);
            } else {
              isMouseDownRef.current = true;
              setDrawStart({ x: imgX, y: imgY });
              setDrawEnd(null);
              setDrawConfirmed(false);
              setDrawWidth(3);
              setDrawPhase('drawing-line');
              setShowEditPopover(false);
            }
          }}
          onMouseMove={(e) => {
            if (isPanning && panStartRef.current) {
              const dx = e.clientX - panStartRef.current.x;
              const dy = e.clientY - panStartRef.current.y;
              setPanOffset({ x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy });
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const imgRect = getImageRect(rect);
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;
            const imgX = Math.max(0, Math.min(100, ((rawX - imgRect.offsetX - imgRect.width / 2 - panOffset.x) / zoomLevel + imgRect.width / 2) / imgRect.width * 100));
            const imgY = Math.max(0, Math.min(100, ((rawY - imgRect.offsetY - imgRect.height / 2 - panOffset.y) / zoomLevel + imgRect.height / 2) / imgRect.height * 100));

            if (drawPhase === 'drawing-line' && drawStart && isMouseDownRef.current) {
              setDrawEnd({ x: imgX, y: imgY });
            } else if (drawPhase === 'expanding' && drawStart && drawEnd) {
              const dx = drawEnd.x - drawStart.x;
              const dy = drawEnd.y - drawStart.y;
              const lineLen = Math.sqrt(dx * dx + dy * dy);
              if (lineLen > 0) {
                const cx = (drawStart.x + drawEnd.x) / 2;
                const cy = (drawStart.y + drawEnd.y) / 2;
                const nx = -dy / lineLen;
                const ny = dx / lineLen;
                const projDist = Math.abs((imgX - cx) * nx + (imgY - cy) * ny);
                setDrawWidth(Math.max(projDist * 2, 2));
              }
            }
          }}
          onMouseUp={(e) => {
            isMouseDownRef.current = false;
            if (isPanning) {
              setIsPanning(false);
              panStartRef.current = null;
              return;
            }
            if (drawPhase === 'drawing-line' && drawStart && drawEnd) {
              const dx = drawEnd.x - drawStart.x;
              const dy = drawEnd.y - drawStart.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 1) {
                setDrawPhase('expanding');
              } else {
                setDrawStart(null);
                setDrawEnd(null);
                setDrawPhase('idle');
              }
            }
          }}
          onMouseLeave={() => {
            if (isPanning) {
              setIsPanning(false);
              panStartRef.current = null;
            }
          }}
        >
          {currentThumb ? (
            <>
              {/* Thumbnail placeholder */}
              <img
                src={currentThumb.src}
                alt=""
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-opacity duration-150 ease-out"
                style={{
                  filter: `blur(2px) contrast(${imgContrast}) brightness(${imgBrightness}) saturate(${imgSaturation})`,
                  opacity: viewerLoaded ? 0 : 1,
                  transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                  transformOrigin: 'center',
                }}
                draggable={false}
              />
              {/* Full resolution image */}
              <img
                key={currentThumb.id}
                src={currentThumb.viewerSrc}
                alt="inspection view"
                onLoad={(e) => {
                  setViewerLoaded(true);
                  const img = e.currentTarget;
                  viewerImgRef.current = img;
                  recalcImgContentStyle();
                }}
                className="w-full h-full object-contain pointer-events-none select-none transition-opacity duration-200 ease-in"
                style={{
                  filter: `contrast(${imgContrast}) brightness(${imgBrightness}) saturate(${imgSaturation})`,
                  opacity: viewerLoaded ? 1 : 0,
                  transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                  transformOrigin: 'center',
                }}
                draggable={false}
              />
            </>
          ) : (
            <div className="w-full h-full bg-[#222] flex items-center justify-center pointer-events-none">
              <span className="text-gray-500 text-sm">Select an image to view</span>
            </div>
          )}

          {/* ─── Image Adjustment Panel (floating, top-right) ─────────────── */}
          {showImageAdjust && (
            <div className="absolute top-3 right-3 z-20 bg-white rounded-lg py-4 px-5 shadow-lg min-w-[220px] pointer-events-auto">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-semibold text-gray-800">Image Adjustments</span>
                <button onClick={() => setShowImageAdjust(false)} className="bg-none border-none cursor-pointer p-0.5 flex items-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#888"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                </button>
              </div>
              <div className="mb-3.5">
                <span className="text-xs text-gray-500 block mb-1">{t('annotate.contrast')}</span>
                <input type="range" min="0" max="2" step="0.1" value={imgContrast} onChange={e => setImgContrast(Number(e.target.value))} className="w-full accent-[#5A8F5A]" />
                <span className="text-[11px] text-gray-500 float-right">{imgContrast.toFixed(1)}</span>
              </div>
              <div className="mb-3.5">
                <span className="text-xs text-gray-500 block mb-1">{t('annotate.brightness')}</span>
                <input type="range" min="0" max="2" step="0.1" value={imgBrightness} onChange={e => setImgBrightness(Number(e.target.value))} className="w-full accent-[#5A8F5A]" />
                <span className="text-[11px] text-gray-500 float-right">{imgBrightness.toFixed(1)}</span>
              </div>
              <div className="mb-3.5">
                <span className="text-xs text-gray-500 block mb-1">{t('annotate.saturation')}</span>
                <input type="range" min="0" max="10" step="0.5" value={imgSaturation} onChange={e => setImgSaturation(Number(e.target.value))} className="w-full accent-[#5A8F5A]" />
                <span className="text-[11px] text-gray-500 float-right">{imgSaturation.toFixed(1)}</span>
              </div>
              <button onClick={() => { setImgContrast(1); setImgBrightness(1); setImgSaturation(1); }} className="w-full py-1.5 px-3 text-xs font-semibold border-none rounded cursor-pointer bg-gray-200 text-gray-800">
                Reset
              </button>
            </div>
          )}

          {/* ─── Blade Face Overlay (floating, top-left) ─────────────── */}
          {showBladeOverlay && (
            <div className="absolute top-2 left-2 z-[25] pointer-events-auto">
              <div className="bg-white rounded-lg shadow-lg p-3 px-4 w-[240px] relative">
                <div className="flex justify-end mb-1.5">
                  <button onClick={() => setShowBladeOverlay(false)} className="bg-none border-none cursor-pointer p-0.5 flex items-center">
                    <svg width="14" height="14" viewBox="0 0 352 512" fill="#888"><path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z" /></svg>
                  </button>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  {/* SS button - top */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const blade = currentThumb?.blade || 'A';
                      const target = thumbnails.find(t => t.face === 'SS' && t.blade === blade) || thumbnails.find(t => t.face === 'SS');
                      if (target) handleThumbnailSelect(target.id);
                    }}
                    className={cn(
                      'py-1 px-3 text-[11px] font-semibold border-none rounded cursor-pointer',
                      currentThumb?.face === 'SS' ? 'bg-[#00A6FF] text-white' : 'bg-gray-100 text-[#00A6FF]'
                    )}
                  >SS</button>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const blade = currentThumb?.blade || 'A';
                        const target = thumbnails.find(t => t.face === 'LE' && t.blade === blade) || thumbnails.find(t => t.face === 'LE');
                        if (target) handleThumbnailSelect(target.id);
                      }}
                      className={cn(
                        'py-1 px-3 text-[11px] font-semibold border-none rounded cursor-pointer',
                        currentThumb?.face === 'LE' ? 'bg-[#00A6FF] text-white' : 'bg-gray-100 text-[#00A6FF]'
                      )}
                    >LE</button>
                    <img src="/airfoil.png" alt="blade" className="w-[140px] h-14 object-contain pointer-events-none" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const blade = currentThumb?.blade || 'A';
                        const target = thumbnails.find(t => t.face === 'TE' && t.blade === blade) || thumbnails.find(t => t.face === 'TE');
                        if (target) handleThumbnailSelect(target.id);
                      }}
                      className={cn(
                        'py-1 px-3 text-[11px] font-semibold border-none rounded cursor-pointer',
                        currentThumb?.face === 'TE' ? 'bg-[#00A6FF] text-white' : 'bg-gray-100 text-[#00A6FF]'
                      )}
                    >TE</button>
                  </div>
                  {/* PS button - bottom */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const blade = currentThumb?.blade || 'A';
                      const target = thumbnails.find(t => t.face === 'PS' && t.blade === blade) || thumbnails.find(t => t.face === 'PS');
                      if (target) handleThumbnailSelect(target.id);
                    }}
                    className={cn(
                      'py-1 px-3 text-[11px] font-semibold border-none rounded cursor-pointer',
                      currentThumb?.face === 'PS' ? 'bg-[#00A6FF] text-white' : 'bg-gray-100 text-[#00A6FF]'
                    )}
                  >PS</button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Annotation Layer ─────────────────────────────────────────── */}
          <div
            className="absolute pointer-events-none z-[5]"
            style={{
              top: imgContentStyle.top,
              left: imgContentStyle.left,
              width: imgContentStyle.width,
              height: imgContentStyle.height,
              transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
              transformOrigin: 'center',
            }}
          >
            {viewerLoaded && (savedAnnotations[selectedThumbnail] || []).map((ann, idx) => {
              const rad = (ann.angle || 0) * (Math.PI / 180);
              const halfW = ann.w / 2;
              const startX = ann.x - halfW * Math.cos(rad);
              const startY = ann.y - halfW * Math.sin(rad);
              const endX = ann.x + halfW * Math.cos(rad);
              const endY = ann.y + halfW * Math.sin(rad);
              const halfH = ann.h / 2;
              const nx = -Math.sin(rad);
              const ny = Math.cos(rad);
              const p1x = startX + nx * halfH;
              const p1y = startY + ny * halfH;
              const p2x = endX + nx * halfH;
              const p2y = endY + ny * halfH;
              const p3x = endX - nx * halfH;
              const p3y = endY - ny * halfH;
              const p4x = startX - nx * halfH;
              const p4y = startY - ny * halfH;
              const minX = Math.min(p1x, p2x, p3x, p4x);
              const minY = Math.min(p1y, p2y, p3y, p4y);
              const maxY = Math.max(p1y, p2y, p3y, p4y);

              return (
                <div key={idx} className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Label */}
                  <div
                    className="absolute -translate-x-1/2 -translate-y-full -mt-1 flex items-center gap-1 pointer-events-auto z-[1]"
                    style={{ left: `${ann.x}%`, top: `${minY}%` }}
                  >
                    <div className="bg-white/[0.92] rounded px-2.5 py-1 flex items-center gap-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
                      <span className="text-[13px] font-bold text-gray-800 whitespace-nowrap">{ann.type}</span>
                      {role !== 'supervisor' && (
                        <button
                          onClick={() => {
                            setAnnotationType(ann.type);
                            setAnnotationCategory(ann.category);
                            setAnnotationNote(ann.note.replace('[oval]', ''));
                            setDrawShape(ann.note.startsWith('[oval]') ? 'oval' : 'rect');
                            setDrawStart({ x: startX, y: startY });
                            setDrawEnd({ x: endX, y: endY });
                            setDrawWidth(ann.h);
                            setDrawConfirmed(true);
                            setEditingAnnotationId(ann.id);
                            setShowAnnotationPopover(true);
                          }}
                          className="bg-none border-none cursor-pointer p-0.5 flex items-center"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#555"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {/* SVG shape */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    {ann.note.startsWith('[oval]') ? (
                      <ellipse
                        cx={`${ann.x}%`} cy={`${ann.y}%`}
                        rx={`${halfW}%`} ry={`${halfH}%`}
                        fill="rgba(255, 102, 0, 0.08)" stroke="#FF6600" strokeWidth="2.5"
                        style={{ transformOrigin: `${ann.x}% ${ann.y}%`, transform: `rotate(${ann.angle}deg)` }}
                      />
                    ) : (
                      <>
                        <line x1={`${p1x}%`} y1={`${p1y}%`} x2={`${p2x}%`} y2={`${p2y}%`} stroke="#FF6600" strokeWidth="2.5" />
                        <line x1={`${p2x}%`} y1={`${p2y}%`} x2={`${p3x}%`} y2={`${p3y}%`} stroke="#FF6600" strokeWidth="2.5" />
                        <line x1={`${p3x}%`} y1={`${p3y}%`} x2={`${p4x}%`} y2={`${p4y}%`} stroke="#FF6600" strokeWidth="2.5" />
                        <line x1={`${p4x}%`} y1={`${p4y}%`} x2={`${p1x}%`} y2={`${p1y}%`} stroke="#FF6600" strokeWidth="2.5" />
                      </>
                    )}
                  </svg>
                  {/* Size label */}
                  <div className="absolute pointer-events-none mt-0.5" style={{ left: `${minX}%`, top: `${maxY}%` }}>
                    <span className="text-[13px] font-semibold text-white italic whitespace-nowrap [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
                      {Math.round(ann.w * 1.5)} x {Math.round(ann.h * 1.3)} cm
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Current drawing */}
            {drawStart && (() => {
              if (!drawEnd) return null;
              const dx = drawEnd.x - drawStart.x;
              const dy = drawEnd.y - drawStart.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 1) return null;
              const isLine = drawPhase === 'drawing-line';

              if (isLine) {
                return (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <line
                      x1={`${drawStart.x}%`} y1={`${drawStart.y}%`}
                      x2={`${drawEnd.x}%`} y2={`${drawEnd.y}%`}
                      stroke="#FF3300" strokeWidth="2.5" strokeLinecap="round"
                    />
                  </svg>
                );
              }

              const rad = Math.atan2(dy, dx);
              const nx = -Math.sin(rad);
              const ny = Math.cos(rad);
              const halfH = drawWidth / 2;
              const p1x = drawStart.x + nx * halfH;
              const p1y = drawStart.y + ny * halfH;
              const p2x = drawEnd.x + nx * halfH;
              const p2y = drawEnd.y + ny * halfH;
              const p3x = drawEnd.x - nx * halfH;
              const p3y = drawEnd.y - ny * halfH;
              const p4x = drawStart.x - nx * halfH;
              const p4y = drawStart.y - ny * halfH;
              const w = dist;

              return (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  <line
                    x1={`${drawStart.x}%`} y1={`${drawStart.y}%`}
                    x2={`${drawEnd.x}%`} y2={`${drawEnd.y}%`}
                    stroke="#FF3300" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7"
                  />
                  {drawShape === 'rect' ? (
                    <>
                      <line x1={`${p1x}%`} y1={`${p1y}%`} x2={`${p2x}%`} y2={`${p2y}%`} stroke="#FF3300" strokeWidth="2.5" />
                      <line x1={`${p2x}%`} y1={`${p2y}%`} x2={`${p3x}%`} y2={`${p3y}%`} stroke="#FF3300" strokeWidth="2.5" />
                      <line x1={`${p3x}%`} y1={`${p3y}%`} x2={`${p4x}%`} y2={`${p4y}%`} stroke="#FF3300" strokeWidth="2.5" />
                      <line x1={`${p4x}%`} y1={`${p4y}%`} x2={`${p1x}%`} y2={`${p1y}%`} stroke="#FF3300" strokeWidth="2.5" />
                    </>
                  ) : (
                    <ellipse
                      cx={`${(drawStart.x + drawEnd.x) / 2}%`}
                      cy={`${(drawStart.y + drawEnd.y) / 2}%`}
                      rx={`${w / 2}%`}
                      ry={`${halfH}%`}
                      fill="rgba(255, 51, 0, 0.15)"
                      stroke="#FF3300"
                      strokeWidth="2.5"
                      style={{ transformOrigin: `${(drawStart.x + drawEnd.x) / 2}% ${(drawStart.y + drawEnd.y) / 2}%`, transform: `rotate(${Math.atan2(dy, dx) * (180 / Math.PI)}deg)` }}
                    />
                  )}
                </svg>
              );
            })()}
          </div>{/* end annotation layer */}
        </div>

        {/* Create/Edit annotation popover */}
        {showAnnotationPopover && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-lg p-6 min-w-[360px] max-w-[500px] shadow-[0_5px_5px_-3px_rgba(0,0,0,0.2),0_8px_10px_1px_rgba(0,0,0,0.14),0_3px_14px_2px_rgba(0,0,0,0.12)]">
            <h5 className="text-lg font-semibold text-gray-800 mb-4">
              {editingAnnotationId !== null ? t('annotate.editAnnotation') : t('annotate.createAnnotation')}
            </h5>

            {/* Type selector */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">{t('annotate.type')}</label>
              <select
                className="w-full py-2 px-2.5 border border-gray-100 rounded text-[13px] text-gray-800 bg-white cursor-pointer outline-none"
                value={annotationType}
                onChange={e => setAnnotationType(e.target.value)}
              >
                {annotationTypes.map(at => (
                  <option key={at.id} value={at.name}>{at.name}</option>
                ))}
                {annotationTypes.length === 0 && (
                  <option value="LE EROSION">LE EROSION</option>
                )}
              </select>
            </div>

            {/* AI Suggestions accordion */}
            <div className="border border-gray-100 rounded mb-3">
              <button onClick={() => setAnnotationSuggestionsOpen(!annotationSuggestionsOpen)} className="w-full flex items-center justify-between py-2 px-3 bg-none border-none cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#5A8F5A"><path d="M7.5 5.6 10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 0 0-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41z" /></svg>
                  <span className="text-[13px] text-gray-800">Automatic category suggestions</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#8A9099" className={cn('transition-transform duration-200', annotationSuggestionsOpen && 'rotate-180')}><path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" /></svg>
              </button>
              {annotationSuggestionsOpen && (
                <div className="px-3 py-2 text-xs text-gray-800 leading-relaxed border-t border-gray-100">
                  <p className="mb-2">A <b>{annotationType}</b> annotation placed on the <b>{metaSide}</b> at <b>{43 - metaRootDist} m from the tip</b> is usually categorized <b>2</b>.</p>
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-1">Shell: cracks in longitudinal direction</td>
                        <td className="text-right font-semibold">2</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] text-gray-500 italic">CORE Insight cannot be liable for this category suggestion, set it according to your experience.</p>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="mb-3">
              <p className="text-[13px] text-gray-800 mb-1.5">{t('annotate.category')}</p>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((c, idx) => (
                  <button
                    key={c}
                    onClick={() => setAnnotationCategory(c)}
                    className={cn(
                      'py-1.5 px-4 border border-[#5A8F5A] text-sm font-semibold cursor-pointer outline-none',
                      annotationCategory === c ? 'bg-[#5A8F5A] text-white' : 'bg-white text-[#5A8F5A]',
                      idx === 0 && 'rounded-l',
                      idx === 4 && 'rounded-r',
                      idx > 0 && '-ml-px'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">{t('annotate.note')}</label>
              <textarea
                value={annotationNote}
                onChange={e => setAnnotationNote(e.target.value)}
                placeholder={t('annotate.notePlaceholder')}
                className="w-full py-2 px-2.5 border border-gray-100 rounded text-[13px] text-gray-800 bg-white outline-none min-h-[40px] resize-y font-[inherit]"
              />
            </div>

            {/* Error message */}
            {saveError && (
              <div className="py-2 px-2.5 mb-2 bg-red-50 text-red-600 rounded text-xs">
                Error: {saveError}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                className="px-5 py-2 bg-gray-200 text-gray-800 border-none rounded text-sm font-semibold cursor-pointer"
                onClick={() => { setShowAnnotationPopover(false); setDrawStart(null); setDrawEnd(null); setDrawConfirmed(false); setDrawPhase('idle'); setDrawWidth(3); setEditingAnnotationId(null); setSaveError(null); }}
              >
                {t('button.cancel')}
              </button>
              {editingAnnotationId !== null && (
                <button
                  className="px-5 py-2 bg-[#F15959] text-white border-none rounded text-sm font-semibold cursor-pointer"
                  onClick={() => {
                    deleteAnnotation.mutate(editingAnnotationId);
                    setDrawStart(null);
                    setDrawEnd(null);
                    setDrawConfirmed(false);
                    setDrawPhase('idle');
                    setDrawWidth(3);
                    setEditingAnnotationId(null);
                    setShowAnnotationPopover(false);
                    setAnnotationNote('');
                  }}
                >
                  {t('button.delete')}
                </button>
              )}
              <button
                className="px-5 py-2 bg-[#5A8F5A] text-white border-none rounded text-sm font-semibold cursor-pointer"
                onClick={() => {
                  if (editingAnnotationId !== null) {
                    if (drawStart && drawEnd) {
                      const dx = drawEnd.x - drawStart.x;
                      const dy = drawEnd.y - drawStart.y;
                      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                      const cx = (drawStart.x + drawEnd.x) / 2;
                      const cy = (drawStart.y + drawEnd.y) / 2;
                      const w = Math.sqrt(dx * dx + dy * dy);
                      const h = drawWidth;
                      updateAnnotation.mutate({ id: editingAnnotationId, x: cx, y: cy, w, h, angle, type: annotationType, category: annotationCategory, note: (drawShape === 'oval' ? '[oval]' : '') + annotationNote });
                    }
                  } else {
                    if (drawStart && drawEnd) {
                      const dx = drawEnd.x - drawStart.x;
                      const dy = drawEnd.y - drawStart.y;
                      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                      const cx = (drawStart.x + drawEnd.x) / 2;
                      const cy = (drawStart.y + drawEnd.y) / 2;
                      const w = Math.sqrt(dx * dx + dy * dy);
                      const h = drawWidth;
                      createAnnotation.mutate({
                        inspectionId,
                        thumbnailId: selectedThumbnail,
                        x: cx, y: cy, w, h,
                        angle,
                        type: annotationType,
                        category: annotationCategory,
                        note: (drawShape === 'oval' ? '[oval]' : '') + annotationNote,
                        rootDistance: computeRootDistance(selectedThumbnail, cy),
                      }, {
                        onError: (err) => {
                          setSaveError(err instanceof Error ? err.message : t('annotate.saveFailed'));
                        },
                      });
                    }
                  }
                  setDrawStart(null);
                  setDrawEnd(null);
                  setDrawConfirmed(false);
                  setDrawPhase('idle');
                  setDrawWidth(3);
                  setEditingAnnotationId(null);
                  setShowAnnotationPopover(false);
                  setAnnotationNote('');
                  setSaveError(null);
                }}
              >
                {t('button.save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL (overlay drawer) ═══ */}
      <div className="w-[220px] min-w-[220px] flex flex-col bg-white border-l border-gray-100 overflow-hidden shadow-sm">
        <div className="p-4 overflow-y-auto flex-1">
          {/* ─── Comparison accordion ─── */}
          <div className="border-t border-gray-100 bg-white">
            <button className="w-full flex items-center justify-between py-2.5 px-4 bg-none border-none cursor-pointer outline-none" onClick={() => setComparisonExpanded(!comparisonExpanded)}>
              <span className="text-sm font-medium text-gray-800">Comparison</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#8A9099" className={cn('transition-transform duration-200', comparisonExpanded && 'rotate-180')}><path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" /></svg>
            </button>
            {comparisonExpanded && (
              <div className="px-4 pb-3">
                {turbineInspections.length === 0 ? (
                  <p className="text-[13px] text-gray-500 m-0">No inspections found</p>
                ) : (
                  turbineInspections.map((insp) => (
                    <div key={insp.id} className="flex items-center gap-2 py-1">
                      <input type="checkbox" className="w-4 h-4 accent-[#5A8F5A]" defaultChecked={insp.id === inspectionId} />
                      <span className="text-[13px] text-gray-800 flex-1">
                        {insp.scheduled_date ? new Date(insp.scheduled_date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                      <a href={`/inspections/${insp.id}/workflow?step=2`} target="_blank" rel="noopener noreferrer" className="text-[#5A8F5A] flex">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3z" /></svg>
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ─── Turbine Information accordion ─── */}
          <div className="border-t border-gray-100 bg-white">
            <button className="w-full flex items-center justify-between py-2.5 px-4 bg-none border-none cursor-pointer outline-none" onClick={() => setTurbineInfoExpanded(!turbineInfoExpanded)}>
              <span className="text-sm font-medium text-gray-800">Turbine information</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#8A9099" className={cn('transition-transform duration-200', turbineInfoExpanded && 'rotate-180')}><path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" /></svg>
            </button>
            {turbineInfoExpanded && (
              <div className="px-4 pb-3">
                <p className="text-[13px] text-gray-800 my-1">Model: <b>{turbineModel}</b></p>
                <p className="text-[13px] text-gray-800 my-1">Power: <b>{turbinePower}</b></p>
                <p className="text-[13px] text-gray-800 my-1">Commissioning date: <b>{turbineCommissioning}</b></p>
              </div>
            )}
          </div>
        </div>

        {/* Change vertical blade accordion */}
        {role !== 'supervisor' && (
          <div className="border-t border-gray-100 bg-white">
            <button className="w-full flex items-center justify-between py-2.5 px-4 bg-none border-none cursor-pointer outline-none" onClick={() => setChangeBladeExpanded(!changeBladeExpanded)}>
              <span className="text-sm text-gray-800">Change vertical blade</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#8A9099" className={cn('transition-transform duration-200', changeBladeExpanded && 'rotate-180')}><path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" /></svg>
            </button>
            {changeBladeExpanded && (
              <div className="px-4 pb-4">
                <div className="flex gap-2 items-center mb-2">
                  <select
                    className="flex-1 py-2 px-2.5 border border-gray-100 rounded text-[13px] text-gray-800 bg-white cursor-pointer outline-none"
                    value={pendingVerticalBlade}
                    onChange={e => setPendingVerticalBlade(e.target.value)}
                  >
                    <option value="A">A - 82518</option>
                    <option value="B">B - 82517</option>
                    <option value="C">C - 82509</option>
                  </select>
                  <button className="px-5 py-2 bg-[#5A8F5A] text-white border-none rounded text-[13px] font-semibold cursor-pointer" onClick={() => setShowBladeConfirm(true)}>
                    {t('button.save')}
                  </button>
                </div>
                <p className="text-xs text-gray-500 m-0">
                  {t('annotate.bladeOrderCW')}<b> {t('annotate.clockwise')}</b>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Turbine Hub Diagram */}
        <div className="bg-white pt-4 border-t border-gray-300 flex justify-center pb-4">
          <div className="mx-auto relative">
            <svg width="147" height="140" viewBox="0 0 98 93" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M43.9217 49.1806C44.0764 50.1206 43.9217 54.5387 43.9217 54.5387C43.9217 54.5387 44.4631 55.0557 47.0155 55.0557C49.5679 55.0557 50.032 54.5387 50.032 54.5387C50.032 54.5387 50.264 1.52972 50.264 1.38138C50.264 1.23304 50.1094 0.958366 49.7226 1.00536C49.3359 1.05236 49.3359 1.14637 49.1812 1.56937C49.0265 1.99237 48.021 7.5854 45.4686 21.7325C42.9161 35.8796 41.524 38.6996 42.1428 42.5536C43.3421 46.8776 43.767 48.2406 43.9217 49.1806Z" fill={selectedDefectBlade === verticalBlade ? '#5A8F5A' : '#EDEDED'} stroke="black" strokeWidth="1.5" />
              <path d="M54.3899 57.1826C53.4985 56.8466 49.7498 54.5036 49.7498 54.5036C49.7498 54.5036 49.0313 54.714 47.7551 56.9244C46.4789 59.1349 46.6946 59.7953 46.6946 59.7953C46.6946 59.7953 92.4857 86.5007 92.6142 86.5749C92.7426 86.649 93.0578 86.6524 93.2105 86.294C93.3632 85.9356 93.2818 85.8886 92.9928 85.5431C92.7038 85.1976 88.3628 81.5304 77.3873 72.2463C66.4118 62.9623 64.6657 60.3467 61.0186 58.9555C56.6742 57.8322 55.2814 57.5187 54.3899 57.1826Z" fill={(() => { const blades = ['A', 'B', 'C']; const idx = Math.max(0, blades.indexOf(verticalBlade)); return selectedDefectBlade === blades[(idx + 1) % 3] ? '#5A8F5A' : '#EDEDED'; })()} stroke="black" strokeWidth="1.5" />
              <path d="M43.7069 62.4702C44.3764 61.7926 48.0416 59.3209 48.0416 59.3209L44.4501 54.3775C44.4501 54.3775 1.42855 85.3477 1.30853 85.4349C1.18852 85.5221 1.05723 85.8087 1.32257 86.0939C1.58791 86.3792 1.66396 86.3239 2.09711 86.2004C2.53025 86.077 7.64609 83.6029 20.5916 77.3524C33.5371 71.1019 36.6369 70.5706 39.3911 67.8047C42.1844 64.2929 43.0373 63.1479 43.7069 62.4702Z" fill={(() => { const blades = ['A', 'B', 'C']; const idx = Math.max(0, blades.indexOf(verticalBlade)); return selectedDefectBlade === blades[(idx + 2) % 3] ? '#5A8F5A' : '#EDEDED'; })()} stroke="black" strokeWidth="1.5" />
              <circle cx="46.9366" cy="57.0105" r="3.93249" fill="#D9D9D9" stroke="black" />
            </svg>
            <div className="absolute top-[5%] w-[40%] left-[6%]">
              <p className="text-[11px] whitespace-nowrap text-ellipsis overflow-hidden text-right m-0">
                {verticalBlade} - {bladeSerials[verticalBlade] || ''}
              </p>
            </div>
            <div className="absolute top-[68%] w-[30%] left-[-28%]">
              <p className="text-[11px] whitespace-nowrap text-ellipsis overflow-hidden text-right m-0">
                {(() => { const blades = ['A', 'B', 'C']; const idx = Math.max(0, blades.indexOf(verticalBlade)); const lb = blades[(idx + 2) % 3]!; return `${lb} - ${bladeSerials[lb] || ''}`; })()}
              </p>
            </div>
            <div className="absolute top-[68%] w-[30%] left-[98%]">
              <p className="text-[11px] whitespace-nowrap text-ellipsis overflow-hidden text-left m-0">
                {(() => { const blades = ['A', 'B', 'C']; const idx = Math.max(0, blades.indexOf(verticalBlade)); const rb = blades[(idx + 1) % 3]!; return `${rb} - ${bladeSerials[rb] || ''}`; })()}
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>{/* ← cierre del flex-1 flex (top area) */}

      {/* ═══ CONFIRMATION MODAL ═══ */}
      {showBladeConfirm && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-6 max-w-[420px] w-[90%] shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
            <div className="text-lg font-bold text-gray-800 mb-4">{t('annotate.updateVerticalBlade')}</div>
            <div className="text-sm text-gray-800 leading-relaxed mb-5">
              <p className="mb-3">{t('annotate.verticalBladeWarning')}</p>
              <b>{t('annotate.confirmVerticalBlade')} &ldquo;{selectedBladeLabel}&rdquo;?</b>
            </div>
            <div className="flex justify-end gap-3">
              <button className="px-5 py-2 bg-gray-200 text-gray-800 border-none rounded text-sm font-semibold cursor-pointer" onClick={() => setShowBladeConfirm(false)}>{t('button.cancel')}</button>
              <button className="px-5 py-2 bg-[#F15959] text-white border-none rounded text-sm font-semibold cursor-pointer" onClick={() => { setVerticalBlade(pendingVerticalBlade); localStorage.setItem(storageKey, pendingVerticalBlade); updateVerticalBladeMutation.mutate(pendingVerticalBlade); setShowBladeConfirm(false); }}>{t('general.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function CategoryBtn({ label, count, color, active, onClick }: { label: string; count: number; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-row items-center justify-center gap-2 py-2 px-3 border rounded cursor-pointer outline-none',
        active ? 'border-[#5A8F5A] bg-[rgba(90,143,90,0.1)]' : 'border-gray-100 bg-white'
      )}
    >
      <div
        className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-xs font-bold preserve-bg"
        style={{ background: color }}
      >
        {count}
      </div>
      <span className={cn('text-xs font-semibold uppercase', active ? 'text-[#5A8F5A]' : 'text-gray-800')}>{label}</span>
    </button>
  );
}
