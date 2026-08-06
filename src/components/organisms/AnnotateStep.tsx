import { useState, useMemo, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { useAnnotations, useCreateAnnotation, useUpdateAnnotation, useDeleteAnnotation, useCampaignInspectionIds, useMultiAnnotations } from '@/hooks/useAnnotations';
import { useInspectionPhotos, getPhotoPublicUrl, getFaceShort } from '@/hooks/useInspectionPhotos';
import { useUpdateVerticalBlade } from '@/hooks/useInspectionMutations';
import { useTogglePhotoTag, useMarkPhotoViewed } from '@/hooks/usePhotoTags';
import type { Inspection } from '@/types';
import { BLADE_POSITION_LABELS } from '@/types';

export interface AnnotateStepProps {
  inspectionId: string;
  inspection?: Inspection;
  campaignId?: string | null;
  savedThumbId?: string | null;
  savedBlade?: string | null;
  onSelectionChange?: (thumbId: string, blade: string) => void;
}

// ─── Thumbnail data derived from inspection_photo ────────────────────────────
interface ThumbnailData {
  id: string;       // inspection_photo.id
  src: string;      // public URL from storage
  blade: string;    // A, B, C (from blade position)
  face: string;     // SS, PS, LE, TE (short label)
  hasAnnotation: boolean; // derived from annotations
  isTagged: boolean;     // false by default (feature pending)
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#4CAF50',
  primaryLight: 'rgba(76, 175, 80, 0.1)',
  primaryDisabled: 'rgba(76, 175, 80, 0.6)',
  text: '#333B46',
  muted: '#8A9099',
  border: '#C4C4C4',
  borderLight: '#E0E0E0',
  bg: '#FFFFFF',
  bgGray: '#F5F5F5',
  selected: '#4CAF50',
  visited: '#E8E8E8',
};

export function AnnotateStep({ inspectionId, inspection, campaignId: propCampaignId, savedThumbId, savedBlade, onSelectionChange }: AnnotateStepProps) {
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
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Fetch photos from inspection_photo table (ALL blades of the campaign) ─
  const { data: photos = [], isLoading: photosLoading } = useInspectionPhotos(campaignId, null);

  // ─── Build bladeId → position letter mapping ──────────────────────────────
  // Use the real blade position from the DB (1=A, 2=B, 3=C)
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

  // ─── Tagged photos from BD (metadata.tagged field) ──────────────────────────
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
      src: getPhotoPublicUrl(photo.storagePath),
      blade: bladePositionMap[photo.bladeId] ?? 'A',
      face: getFaceShort(photo.face),
      hasAnnotation: annotatedPhotoIds.has(photo.id),
      isTagged: taggedPhotos.has(photo.id),
    }));
  }, [photos, dbAnnotations, bladePositionMap, taggedPhotos]);

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
  
  // Right panel state — empty until a defect is selected
  const [rightPanelType, setRightPanelType] = useState('');
  const [rightPanelCategory, setRightPanelCategory] = useState(0);
  const [rightPanelRootDistance, setRightPanelRootDistance] = useState(0);
  const [rightPanelFace, setRightPanelFace] = useState('');
  const [rightPanelBlade, setRightPanelBlade] = useState('');
  const [changeBladeExpanded, setChangeBladeExpanded] = useState(false);
  const [showBladeConfirm, setShowBladeConfirm] = useState(false);
  const storageKey = `vertical-blade-${inspectionId}`;
  const [verticalBlade, setVerticalBlade] = useState<string>(() => {
    const dbVal = (inspection as any)?.vertical_blade;
    if (dbVal && ['A','B','C'].includes(dbVal)) return dbVal;
    return localStorage.getItem(storageKey) || 'A';
  });
  const [pendingVerticalBlade, setPendingVerticalBlade] = useState<string>(() => {
    const dbVal = (inspection as any)?.vertical_blade;
    if (dbVal && ['A','B','C'].includes(dbVal)) return dbVal;
    return localStorage.getItem(storageKey) || 'A';
  });
  const updateVerticalBladeMutation = useUpdateVerticalBlade(inspectionId);

  // Sync verticalBlade from inspection data or localStorage when it loads
  useEffect(() => {
    const dbBlade = (inspection as any)?.vertical_blade;
    if (dbBlade && ['A','B','C'].includes(dbBlade)) {
      setVerticalBlade(dbBlade);
      setPendingVerticalBlade(dbBlade);
    } else {
      const stored = localStorage.getItem(storageKey);
      if (stored && ['A','B','C'].includes(stored)) {
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
  // Derive thumbnail annotation counts from DB data
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
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editBlade, setEditBlade] = useState('B');
  const [editSide, setEditSide] = useState('LE');
  const [editRootDistance, setEditRootDistance] = useState(0);
  const [editDistanceToBlade, setEditDistanceToBlade] = useState(4.2);
  const [metaBlade, setMetaBlade] = useState('A');
  const [metaSide, setMetaSide] = useState('LE');
  const [metaRootDist, setMetaRootDist] = useState(15);
  const [metaDistBlade, setMetaDistBlade] = useState(6.9);

  const filteredThumbnails = useMemo(() => {
    return thumbnails.filter(t => {
      // Blade filter: if no blades selected, show all; otherwise filter
      if (selectedBlades.size > 0 && !selectedBlades.has(t.blade)) return false;
      // Face filter: if no faces selected, show all; otherwise filter
      if (selectedFaces.size > 0 && !selectedFaces.has(t.face)) return false;
      if (categoryFilter === 'unseen') return !t.hasAnnotation && !t.isTagged && !((thumbnailAnnotations[t.id] ?? 0) > 0);
      if (categoryFilter === 'tagged') return t.isTagged;
      if (categoryFilter === 'annots') return t.hasAnnotation || ((thumbnailAnnotations[t.id] ?? 0) > 0);
      return true;
    });
  }, [selectedBlades, selectedFaces, categoryFilter, thumbnailAnnotations, thumbnails]);

  const groupedThumbnails = useMemo(() => {
    // Order: blade first (starting from verticalBlade), then CW (right, left)
    const faceOrder = ['SS', 'PS', 'LE', 'TE'];
    const allBlades = ['A', 'B', 'C'];
    const idx = Math.max(0, allBlades.indexOf(verticalBlade));
    const bladeOrder = [
      allBlades[idx]!,
      allBlades[(idx + 2) % 3]!,  // right blade (CW)
      allBlades[(idx + 1) % 3]!,  // left blade (CW)
    ];
    
    const groups: Record<string, ThumbnailData[]> = {};
    
    for (const blade of bladeOrder) {
      for (const face of faceOrder) {
        const key = `${blade} - ${face}`;
        const items = filteredThumbnails.filter(t => t.blade === blade && t.face === face);
        if (items.length > 0) {
          groups[key] = items;
        }
      }
    }
    
    return groups;
  }, [filteredThumbnails, verticalBlade]);

  // Auto-select: restore saved selection or pick first VISIBLE thumbnail (from grouped order)
  useEffect(() => {
    if (thumbnails.length > 0 && !selectedThumbnail) {
      const firstGroup = Object.values(groupedThumbnails)[0];
      const firstVisible = firstGroup?.[0];
      const target = firstVisible || thumbnails[0]!;
      setSelectedThumbnail(target.id);
      setSelectedDefectBlade(target.blade);
      setRightPanelBlade(target.blade);
      setRightPanelFace(target.face);
      onSelectionChange?.(target.id, target.blade);
    }
  }, [thumbnails, groupedThumbnails]);

  // Navigation: find current index in filtered list for prev/next
  const flatFilteredThumbs = useMemo(() => {
    const flat: ThumbnailData[] = [];
    for (const thumbs of Object.values(groupedThumbnails)) {
      flat.push(...thumbs);
    }
    return flat;
  }, [groupedThumbnails]);

  const currentThumbIndex = flatFilteredThumbs.findIndex(t => t.id === selectedThumbnail);

  // Auto-scroll selected thumbnail into view in sidebar
  useEffect(() => {
    if (selectedThumbnail) {
      const el = document.getElementById(`thumb-${selectedThumbnail}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedThumbnail]);

  const bladeSerials: Record<string, string> = useMemo(() => {
    // Use the serial numbers from the combobox (same source)
    return { A: '82518', B: '82517', C: '82509' };
  }, []);

  // Loading state while checking photos and annotations
  if (photosLoading || annotationsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #eee', borderTopColor: '#4CAF50', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 13, color: '#888' }}>Loading...</span>
        </div>
      </div>
    );
  }

  // Note: when no photos available, the component renders normally with empty thumbnail list.
  // This shows the full UI structure (sidebar, viewer, panels) ready for when photos arrive.

  const annotsCount = thumbnails.filter(t => t.hasAnnotation || ((thumbnailAnnotations[t.id] ?? 0) > 0)).length;
  const taggedCount = thumbnails.filter(t => t.isTagged).length;
  const unseenCount = thumbnails.filter(t => !t.hasAnnotation && !t.isTagged && !((thumbnailAnnotations[t.id] ?? 0) > 0)).length;
  const viewedCount = photos.filter(p => p.isViewed).length;
  const reviewProgress = thumbnails.length > 0 ? Math.round((viewedCount / thumbnails.length) * 100) : 0;

  // Sync right panel when thumbnail changes
  const handleThumbnailSelect = (thumbId: string) => {
    setSelectedThumbnail(thumbId);
    // Mark photo as viewed in BD (only writes if not already viewed)
    markViewed.mutate({ photoId: thumbId });
    const thumb = thumbnails.find(t => t.id === thumbId);
    if (thumb) {
      setRightPanelBlade(thumb.blade);
      setRightPanelFace(thumb.face);
      setSelectedDefectBlade(thumb.blade);
      // Notify parent to persist selection across step changes
      onSelectionChange?.(thumbId, thumb.blade);
      // Check if there's a saved annotation for this thumbnail
      const thumbAnnotations = savedAnnotations[thumbId];
      if (thumbAnnotations && thumbAnnotations.length > 0) {
        const lastAnn = thumbAnnotations[thumbAnnotations.length - 1]!;
        setRightPanelType(lastAnn.type);
        setRightPanelCategory(lastAnn.category);
      }
    }
  };

  const handlePrevPhoto = () => {
    if (flatFilteredThumbs.length === 0) return;
    const prevIndex = currentThumbIndex > 0 ? currentThumbIndex - 1 : flatFilteredThumbs.length - 1;
    handleThumbnailSelect(flatFilteredThumbs[prevIndex]!.id);
  };

  const handleNextPhoto = () => {
    if (flatFilteredThumbs.length === 0) return;
    const nextIndex = currentThumbIndex < flatFilteredThumbs.length - 1 ? currentThumbIndex + 1 : 0;
    handleThumbnailSelect(flatFilteredThumbs[nextIndex]!.id);
  };

  const handleToggleFlag = () => {
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
    <div style={containerStyle}>
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div style={sidebarStyle}>
        <div style={sidebarInner}>
          {/* Fast forward mode toggle */}
          <div style={fastForwardRow}>
            <span style={{ fontSize: 13, color: C.text }}>Fast forward mode</span>
            <label style={switchLabel}>
              <input
                type="checkbox"
                checked={fastForward}
                onChange={() => setFastForward(!fastForward)}
                style={switchInput}
              />
              <span style={fastForward ? switchTrackActive : switchTrack}>
                <span style={fastForward ? switchThumbActive : switchThumb} />
              </span>
            </label>
          </div>

          <hr style={dividerStyle} />

          {/* Review progress */}
          <div style={{ padding: '8px 16px' }}>
            <p style={{ fontSize: 13, color: C.text, margin: '0 0 6px' }}>
              Review progress: <strong>{reviewProgress}%</strong>
            </p>
            <div style={progressBarBg}>
              <div style={{ ...progressBarFill, width: `${reviewProgress}%` }} />
            </div>
          </div>

          <hr style={dividerStyle} />

          {/* Blade filters */}
          <div style={{ padding: '8px 16px' }}>
            <div style={buttonGroupStyle}>
              {['A', 'B', 'C'].map((blade, idx) => (
                <button
                  key={blade}
                  onClick={() => toggleBlade(blade)}
                  style={{
                    ...btnGroupItem,
                    ...(selectedBlades.has(blade) ? btnGroupItemActive : {}),
                    borderRadius: idx === 0 ? '4px 0 0 4px' : idx === 2 ? '0 4px 4px 0' : 0,
                    marginLeft: idx === 0 ? 0 : -1,
                  }}
                >
                  {blade}
                </button>
              ))}
            </div>

            {/* Edge/Face filters */}
            <div style={{ ...buttonGroupStyle, marginTop: 8 }}>
              {['SS', 'PS', 'LE', 'TE'].map((face, idx) => (
                <button
                  key={face}
                  onClick={() => toggleFace(face)}
                  style={{
                    ...btnGroupItem,
                    ...(selectedFaces.has(face) ? btnGroupItemActive : {}),
                    borderRadius: idx === 0 ? '4px 0 0 4px' : idx === 3 ? '0 4px 4px 0' : 0,
                    marginLeft: idx === 0 ? 0 : -1,
                  }}
                >
                  {face}
                </button>
              ))}
            </div>

            {/* Blade SVG shapes - horizontal layout like SkyVisor original */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, marginLeft: 4 }}>
              <svg width="72" height="24" viewBox="0 0 168 55" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ cursor: 'pointer' }}>
                <g clipPath="url(#clipBlade1)">
                  <path id="blade1" d="M6.89214 13.7447C8.25187 13.7447 42.6982 14.1965 54.4825 14.1965C66.2668 14.1965 121.109 3.80594 121.109 3.80594C121.109 3.80594 130.627 1.54704 139.692 1.09524C143.123 0.92428 152.884 0.99612 161.5 1.21402C161.5 1.21402 167 14.5002 167 27.5002C167 40.5002 161.5 53.7715 161.5 53.7715C73.9018 53.484 6.17695 53.2092 5.53242 53.0486M6.89214 13.7447C5.53242 13.7447 0.999998 18.7142 0.999999 32.719C1 46.7238 3.71945 52.5968 5.53242 53.0486M6.89214 13.7447C6.89214 13.7447 12.331 16.0036 12.331 32.719C12.331 49.4344 5.53242 53.0486 5.53242 53.0486" stroke="black" fill={selectedFaces.has('SS') ? C.primary : 'none'}/>
                </g>
                <defs>
                  <clipPath id="clipBlade1"><rect y="55" width="55" height="168" transform="rotate(-90 0 55)" fill="white"/></clipPath>
                </defs>
              </svg>
              <svg width="72" height="24" viewBox="0 0 170 55" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ cursor: 'pointer' }}>
                <g clipPath="url(#clipBlade2)">
                  <path id="blade2" d="M36.8 3.8051C25.956 2.3905 20.03 1.9981 10.966 1.5463C8.33948 1.41537 5.01498 1.30217 1.5 1.21328C1.5 1.21328 7 11 7 28C7 45 1.5 53.7707 1.5 53.7707C76.6422 54.0174 166.408 54.2733 241 54.4746C241 54.4746 243.5 48.9995 243.5 40.9995C243.5 32.9995 239.853 28.2006 239.853 28.2006C237.587 28.2006 159.629 19.617 157.363 19.1653C155.097 18.7135 73.966 8.3228 73.966 8.3228C73.966 8.3228 47.645 5.2198 36.8 3.8051Z" stroke="black" fill={selectedFaces.has('PS') ? C.primary : 'none'}/>
                </g>
                <defs>
                  <clipPath id="clipBlade2"><rect y="55" width="55" height="170" transform="rotate(-90 0 55)" fill="white"/></clipPath>
                </defs>
              </svg>
              <svg width="76" height="24" viewBox="0 0 179 55" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ cursor: 'pointer' }}>
                <g clipPath="url(#clipBlade3)">
                  <path id="blade3" d="M 170.90919,46.1753 C 166.37503,45.2718 4.1991862,21.780677 1.9326071,21.780677 c 0,0 0.6240202,8.584816 0.6240202,17.084816 0,8.5 0.398657,14.134507 0.398657,14.134507 L 154.58802,53.8554 c 12.69424,0 21.76156,0.9036 23.12191,-1.807 1.35934,-2.7107 -2.26758,-4.9695 -6.80074,-5.8731 z" stroke="black" fill={selectedFaces.has('LE') || selectedFaces.has('TE') ? C.primary : 'none'}/>
                </g>
                <defs>
                  <clipPath id="clipBlade3"><rect y="55" width="55" height="179" transform="rotate(-90 0 55)" fill="white"/></clipPath>
                </defs>
              </svg>
            </div>

            {/* Category filter buttons - SkyVisor style */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <CategoryBtn label="UNSEEN" count={unseenCount} color="#9E9E9E" active={categoryFilter === 'unseen'} onClick={() => setCategoryFilter(categoryFilter === 'unseen' ? null : 'unseen')} />
                <CategoryBtn label="TAGGED" count={taggedCount} color="#FFEB3B" active={categoryFilter === 'tagged'} onClick={() => setCategoryFilter(categoryFilter === 'tagged' ? null : 'tagged')} />
              </div>
              <CategoryBtn label="ANNOTS" count={annotsCount} color="#F44336" active={categoryFilter === 'annots'} onClick={() => setCategoryFilter(categoryFilter === 'annots' ? null : 'annots')} />
            </div>
          </div>

          <hr style={dividerStyle} />

          {/* Thumbnails grid */}
          <div style={thumbnailsContainer}>
            {Object.entries(groupedThumbnails).map(([group, thumbs]) => (
              <div key={group}>
                <p style={thumbnailGroupTitle}>{group}</p>
                <div style={thumbnailGrid}>
                  {thumbs.map(t => (
                    <div
                      key={t.id}
                      id={`thumb-${t.id}`}
                      onClick={() => handleThumbnailSelect(t.id)}
                      style={{
                        ...thumbnailItem,
                        border: selectedThumbnail === t.id ? `3px solid ${C.selected}` : '3px solid transparent',
                      }}
                    >
                      <img
                        src={t.src}
                        alt="thumbnail"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }}
                        loading="lazy"
                        draggable={false}
                      />
                      {(thumbnailAnnotations[t.id] ?? 0) > 0 && (
                        <div style={annotBadgeStyle}>{thumbnailAnnotations[t.id]}</div>
                      )}
                      {taggedPhotos.has(t.id) && (
                        <div style={tagBadgeStyle} />
                      )}
                    </div>
                  ))}
                </div>
                <hr style={{ border: 'none', borderTop: `1px solid ${C.borderLight}`, margin: '8px 0' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ MAIN VIEWER ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Image toolbar bar */}
        <div style={imageBarStyle}>
          {/* Left: nav buttons + flag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex' }}>
              <button style={{ ...navBtnStyle, borderRadius: '4px 0 0 4px' }} title="Previous" onClick={handlePrevPhoto}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={C.primary}><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
              </button>
              <button style={{ ...navBtnStyle, borderRadius: '0 4px 4px 0', borderLeft: 'none' }} title="Next" onClick={handleNextPhoto}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={C.primary}><path d="m6 18 8.5-6L6 6zM16 6v12h2V6z"/></svg>
              </button>
            </div>
            <button style={{ ...flagBtnStyle, background: taggedPhotos.has(selectedThumbnail) ? 'rgba(255, 235, 59, 0.2)' : 'transparent' }} title="Flag" onClick={handleToggleFlag}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFEB3B"><path d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
            </button>
          </div>

          {/* Center: metadata info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
            <span style={metaTextStyle}>
              <span>Blade: </span><strong>{metaBlade}-{bladeSerials[metaBlade]}</strong>
              <span style={metaSep}>|</span>
              <span>Side: </span><strong>{metaSide}</strong>
              <span style={metaSep}>|</span>
              <span>Blade root distance: </span><strong>{metaRootDist} m</strong>
              <span style={metaSep}>|</span>
              <span>Distance to blade: </span><strong>{metaDistBlade} m</strong>
            </span>
            <div style={{ position: 'relative' }}>
              <button style={editBtnStyle} onClick={() => setShowEditPopover(!showEditPopover)}>Edit</button>
              {/* Edit popover anchored to Edit button */}
              {showEditPopover && (
                <div style={editPopoverStyle}>
                  {/* Blade */}
                  <span style={editFieldLabel}>Blade</span>
                  <div style={{ display: 'flex', marginBottom: 16 }}>
                    {['A', 'B', 'C'].map((b, idx) => (
                      <button key={b} onClick={() => setEditBlade(b)} style={{
                        ...editGroupBtn,
                        ...(editBlade === b ? editGroupBtnActive : {}),
                        borderRadius: idx === 0 ? '4px 0 0 4px' : idx === 2 ? '0 4px 4px 0' : 0,
                        marginLeft: idx === 0 ? 0 : -1,
                      }}>{b}</button>
                    ))}
                  </div>

                  {/* Side */}
                  <span style={editFieldLabel}>Side</span>
                  <div style={{ display: 'flex', marginBottom: 16 }}>
                    {['PS', 'SS', 'LE', 'TE'].map((s, idx) => (
                      <button key={s} onClick={() => setEditSide(s)} style={{
                        ...editGroupBtn,
                        ...(editSide === s ? editGroupBtnActive : {}),
                        borderRadius: idx === 0 ? '4px 0 0 4px' : idx === 3 ? '0 4px 4px 0' : 0,
                        marginLeft: idx === 0 ? 0 : -1,
                      }}>{s}</button>
                    ))}
                  </div>

                  {/* Blade root distance */}
                  <span style={editFieldLabel}>Blade root distance (m)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <input
                      type="range"
                      min="0"
                      max="43"
                      step="1"
                      value={editRootDistance}
                      onChange={e => setEditRootDistance(Number(e.target.value))}
                      style={{ flex: 1, accentColor: C.primary }}
                    />
                    <input
                      type="number"
                      min="0"
                      max="43"
                      step="1"
                      value={editRootDistance}
                      onChange={e => setEditRootDistance(Number(e.target.value))}
                      style={editNumberInput}
                    />
                  </div>

                  {/* Distance to blade */}
                  <span style={editFieldLabel}>Distance to blade (m)</span>
                  <div style={{ marginBottom: 16 }}>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={editDistanceToBlade}
                      onChange={e => setEditDistanceToBlade(Number(e.target.value))}
                      style={editNumberInput}
                    />
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button style={cancelBtnStyle} onClick={() => setShowEditPopover(false)}>Cancel</button>
                    <button style={{ ...confirmBtnStyle, background: C.primary }} onClick={() => {
                      setMetaBlade(editBlade);
                      setMetaSide(editSide);
                      setMetaRootDist(editRootDistance);
                      setMetaDistBlade(editDistanceToBlade);
                      setShowEditPopover(false);
                    }}>Save</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: download + delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button style={actionBtnStyle} title="Download photo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill={C.primary}><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96M17 13l-5 5-5-5h3V9h4v4z"/></svg>
            </button>
            <button style={{ ...actionBtnStyle, borderColor: '#F15959', color: '#F15959' }} title="Delete photo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#F15959"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>
            </button>
          </div>
        </div>

        {/* Image viewer with drag-to-draw annotation */}
        <div
          style={{ ...mainViewerStyle, cursor: isDrawing ? 'crosshair' : 'crosshair', position: 'relative' }}
          onMouseDown={(e) => {
            if (showAnnotationPopover) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            setDrawStart({ x, y });
            setDrawEnd({ x, y });
            setIsDrawing(true);
            setShowEditPopover(false);
          }}
          onMouseMove={(e) => {
            if (!isDrawing || !drawStart) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            setDrawEnd({ x, y });
          }}
          onMouseUp={() => {
            if (!isDrawing || !drawStart || !drawEnd) return;
            const w = Math.abs(drawEnd.x - drawStart.x);
            const h = Math.abs(drawEnd.y - drawStart.y);
            if (w > 2 && h > 2) {
              setShowAnnotationPopover(true);
            }
            setIsDrawing(false);
          }}
        >
          {currentThumb ? (
            <img
              src={currentThumb.src}
              alt="inspection view"
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#1a1a1a', pointerEvents: 'none', userSelect: 'none' }}
              draggable={false}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ color: '#888', fontSize: 14 }}>Select an image to view</span>
            </div>
          )}

          {/* Saved annotations for current thumbnail */}
          {(savedAnnotations[selectedThumbnail] || []).map((ann, idx) => (
            <div key={idx} style={{ position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`, width: `${ann.w}%`, height: `${ann.h}%`, pointerEvents: 'none' }}>
              {/* Label with type + edit button */}
              <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'auto' }}>
                <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 4, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#333', whiteSpace: 'nowrap' }}>{ann.type}</span>
                  <button onClick={() => {
                    setAnnotationType(ann.type);
                    setAnnotationCategory(ann.category);
                    setAnnotationNote(ann.note);
                    setDrawStart({ x: ann.x, y: ann.y });
                    setDrawEnd({ x: ann.x + ann.w, y: ann.y + ann.h });
                    setEditingAnnotationId(ann.id);
                    setShowAnnotationPopover(true);
                    // Also load into right panel
                    setRightPanelType(ann.type);
                    setRightPanelCategory(ann.category);
                    setRightPanelRootDistance(Math.round(ann.y * 0.43 * 10) / 10);
                    const thumb = thumbnails.find(t => t.id === selectedThumbnail);
                    if (thumb) {
                      setRightPanelFace(thumb.face);
                      setRightPanelBlade(thumb.blade);
                    }
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#555"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                  </button>
                </div>
              </div>
              {/* Rectangle border */}
              <div style={{ width: '100%', height: '100%', border: '2.5px solid #FFA500', background: 'rgba(255, 165, 0, 0.08)' }} />
              {/* Size label below */}
              <span style={{ position: 'absolute', top: '100%', left: 0, marginTop: 2, fontSize: 13, fontWeight: 600, color: '#fff', fontStyle: 'italic', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                {Math.round(ann.w * 1.5)} x {Math.round(ann.h * 1.3)} cm
              </span>
            </div>
          ))}

          {/* Current drawing rectangle */}
          {drawStart && drawEnd && (drawStart.x !== drawEnd.x || drawStart.y !== drawEnd.y) && (
            <div style={{
              position: 'absolute',
              left: `${Math.min(drawStart.x, drawEnd.x)}%`,
              top: `${Math.min(drawStart.y, drawEnd.y)}%`,
              width: `${Math.abs(drawEnd.x - drawStart.x)}%`,
              height: `${Math.abs(drawEnd.y - drawStart.y)}%`,
              border: '2.5px solid #FFA500',
              background: 'rgba(255, 165, 0, 0.1)',
              pointerEvents: 'none',
            }}>
              <span style={{ position: 'absolute', bottom: -18, left: 0, fontSize: 11, color: '#FFA500', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                {Math.round(Math.abs(drawEnd.x - drawStart.x) * 1.5)} x {Math.round(Math.abs(drawEnd.y - drawStart.y) * 1.3)} cm
              </span>
            </div>
          )}
        </div>

        {/* Create/Edit annotation popover */}
        {showAnnotationPopover && (
          <div style={annotationPopoverStyle}>
            <h5 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>
              {editingAnnotationId !== null ? 'Edit annotation' : 'Create annotation'}
            </h5>

            {/* Type selector */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: C.muted, marginBottom: 4, display: 'block' }}>Type</label>
              <select style={{ ...selectStyle, background: '#FFFFFF' }} value={annotationType} onChange={e => setAnnotationType(e.target.value)}>
                <option value="LONGITUDINAL CRACKS ON LE OR TE BOND LINES">LONGITUDINAL CRACKS ON LE OR TE BOND LINES</option>
                <option value="LE EROSION">LE EROSION</option>
                <option value="VORTEX (MISSING PANELS)">VORTEX (MISSING PANELS)</option>
                <option value="PAINT DAMAGES">PAINT DAMAGES</option>
                <option value="OTHER ADD-ONS MISSING">OTHER ADD-ONS MISSING</option>
                <option value="BLADES WITH HYDRAULIC OIL">BLADES WITH HYDRAULIC OIL</option>
                <option value="CRACK">CRACK</option>
              </select>
            </div>

            {/* AI Suggestions accordion */}
            <div style={{ border: `1px solid ${C.borderLight}`, borderRadius: 4, marginBottom: 12 }}>
              <button onClick={() => setAnnotationSuggestionsOpen(!annotationSuggestionsOpen)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={C.primary}><path d="M7.5 5.6 10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 0 0-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41z"/></svg>
                  <span style={{ fontSize: 13, color: C.text }}>Automatic category suggestions</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={C.muted} style={{ transform: annotationSuggestionsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>
              </button>
              {annotationSuggestionsOpen && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: C.text, lineHeight: 1.5, borderTop: `1px solid ${C.borderLight}` }}>
                  <p style={{ margin: '0 0 8px' }}>A <b>{annotationType}</b> annotation placed on the <b>{metaSide}</b> at <b>{43 - metaRootDist} m from the tip</b> is usually categorized <b>2</b>.</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        <td style={{ padding: '4px 0' }}>Shell: cracks in longitudinal direction</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>2</td>
                      </tr>
                    </tbody>
                  </table>
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: C.muted, fontStyle: 'italic' }}>CORE Insight cannot be liable for this category suggestion, set it according to your experience.</p>
                </div>
              )}
            </div>

            {/* Category */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: C.text, margin: '0 0 6px' }}>Category</p>
              <div style={{ display: 'flex' }}>
                {[1, 2, 3, 4, 5].map((c, idx) => (
                  <button key={c} onClick={() => setAnnotationCategory(c)} style={{
                    ...editGroupBtn,
                    ...(annotationCategory === c ? editGroupBtnActive : {}),
                    borderRadius: idx === 0 ? '4px 0 0 4px' : idx === 4 ? '0 4px 4px 0' : 0,
                    marginLeft: idx === 0 ? 0 : -1,
                  }}>{c}</button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: C.muted, marginBottom: 4, display: 'block' }}>Note</label>
              <textarea
                value={annotationNote}
                onChange={e => setAnnotationNote(e.target.value)}
                placeholder="Note"
                style={{ ...selectStyle, background: '#FFFFFF', minHeight: 40, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Error message */}
            {saveError && (
              <div style={{ padding: '8px 10px', marginBottom: 8, background: '#FEE2E2', color: '#DC2626', borderRadius: 4, fontSize: 12 }}>
                Error: {saveError}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={cancelBtnStyle} onClick={() => { setShowAnnotationPopover(false); setDrawStart(null); setDrawEnd(null); setEditingAnnotationId(null); setSaveError(null); }}>Cancel</button>
              {editingAnnotationId !== null && (
                <button style={{ ...confirmBtnStyle, background: '#F15959' }} onClick={() => {
                  // Delete annotation from DB
                  deleteAnnotation.mutate(editingAnnotationId);
                  setDrawStart(null);
                  setDrawEnd(null);
                  setEditingAnnotationId(null);
                  setShowAnnotationPopover(false);
                  setAnnotationNote('');
                }}>Delete</button>
              )}
              <button style={{ ...confirmBtnStyle, background: C.primary }} onClick={() => {
                if (editingAnnotationId !== null) {
                  // Update existing annotation in DB
                  if (drawStart && drawEnd) {
                    const x = Math.min(drawStart.x, drawEnd.x);
                    const y = Math.min(drawStart.y, drawEnd.y);
                    const w = Math.abs(drawEnd.x - drawStart.x);
                    const h = Math.abs(drawEnd.y - drawStart.y);
                    updateAnnotation.mutate({ id: editingAnnotationId, x, y, w, h, angle: 0, type: annotationType, category: annotationCategory, note: annotationNote });
                  }
                } else {
                  // Create new annotation in DB
                  if (drawStart && drawEnd) {
                    const x = Math.min(drawStart.x, drawEnd.x);
                    const y = Math.min(drawStart.y, drawEnd.y);
                    const w = Math.abs(drawEnd.x - drawStart.x);
                    const h = Math.abs(drawEnd.y - drawStart.y);
                    createAnnotation.mutate({
                      inspectionId,
                      thumbnailId: selectedThumbnail,
                      x, y, w, h,
                      angle: 0,
                      type: annotationType,
                      category: annotationCategory,
                      note: annotationNote,
                    }, {
                      onError: (err) => {
                        setSaveError(err instanceof Error ? err.message : 'Failed to save annotation');
                      },
                    });
                  }
                }
                setDrawStart(null);
                setDrawEnd(null);
                setEditingAnnotationId(null);
                setShowAnnotationPopover(false);
                setAnnotationNote('');
                setSaveError(null);
              }}>Save</button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div style={rightPanelStyle}>
        <div style={rightPanelInner}>
          {/* Defect type selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Defect type</label>
            <select style={selectStyle} value={rightPanelType} onChange={e => setRightPanelType(e.target.value)}>
              <option value="LE EROSION">LE EROSION</option>
              <option value="VORTEX (MISSING PANELS)">VORTEX (MISSING PANELS)</option>
              <option value="PAINT DAMAGES">PAINT DAMAGES</option>
              <option value="OTHER ADD-ONS MISSING">OTHER ADD-ONS MISSING</option>
              <option value="BLADES WITH HYDRAULIC OIL">BLADES WITH HYDRAULIC OIL</option>
              <option value="CRACK">CRACK</option>
              <option value="LONGITUDINAL CRACKS ON LE OR TE BOND LINES">LONGITUDINAL CRACKS ON LE OR TE BOND LINES</option>
            </select>
          </div>

          {/* Category */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Category</label>
            <div style={{ display: 'flex', gap: 0 }}>
              {[1, 2, 3, 4, 5].map((c) => (
                <button key={c} onClick={() => setRightPanelCategory(c)} style={{ ...catBtn, ...(c === rightPanelCategory ? catBtnActive : {}), borderRadius: c === 1 ? '4px 0 0 4px' : c === 5 ? '0 4px 4px 0' : 0 }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Root distance */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Root distance (m)</label>
            <input type="number" style={inputStyle} value={rightPanelRootDistance} onChange={e => setRightPanelRootDistance(Number(e.target.value))} step="0.1" min="0" />
          </div>

          {/* Blade face */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Blade face</label>
            <select style={selectStyle} value={rightPanelFace} onChange={e => setRightPanelFace(e.target.value)}>
              <option value="SS">SS</option>
              <option value="PS">PS</option>
              <option value="LE">LE</option>
              <option value="TE">TE</option>
            </select>
          </div>

          {/* Blade selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Blade</label>
            <select style={selectStyle} value={rightPanelBlade} onChange={e => { setRightPanelBlade(e.target.value); setSelectedDefectBlade(e.target.value); }}>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>

          {/* Save button */}
          <button style={{ ...saveBtnStyle, cursor: 'pointer', background: C.primary }} onClick={() => {
            if (drawStart && drawEnd) {
              const x = Math.min(drawStart.x, drawEnd.x);
              const y = Math.min(drawStart.y, drawEnd.y);
              const w = Math.abs(drawEnd.x - drawStart.x);
              const h = Math.abs(drawEnd.y - drawStart.y);
              if (w > 0 && h > 0) {
                createAnnotation.mutate({
                  inspectionId,
                  thumbnailId: selectedThumbnail,
                  x, y, w, h,
                  angle: 0,
                  type: rightPanelType,
                  category: rightPanelCategory,
                  note: '',
                });
              }
            }
            setDrawStart(null);
            setDrawEnd(null);
          }}>Save</button>
        </div>

        {/* Change vertical blade accordion */}
        <div style={changeBladeAccordionStyle}>
          <button style={changeBladeBtn} onClick={() => setChangeBladeExpanded(!changeBladeExpanded)}>
            <span style={{ fontSize: 14, color: C.text }}>Change vertical blade</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={C.muted} style={{ transform: changeBladeExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>
          </button>
          {changeBladeExpanded && (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <select style={{ ...selectStyle, flex: 1 }} value={pendingVerticalBlade} onChange={e => { setPendingVerticalBlade(e.target.value); }}>
                  <option value="A">A - 82518</option>
                  <option value="B">B - 82517</option>
                  <option value="C">C - 82509</option>
                </select>
                <button style={saveVerticalBtnStyle} onClick={() => setShowBladeConfirm(true)}>Save</button>
              </div>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
                Blade order from the outside is set to<b> clockwise</b>
              </p>
            </div>
          )}
        </div>

        {/* Turbine Hub Diagram */}
        <div style={hubDiagramContainer}>
          <div style={{ margin: '0 auto', position: 'relative' }}>
            <svg width="147" height="140" viewBox="0 0 98 93" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M43.9217 49.1806C44.0764 50.1206 43.9217 54.5387 43.9217 54.5387C43.9217 54.5387 44.4631 55.0557 47.0155 55.0557C49.5679 55.0557 50.032 54.5387 50.032 54.5387C50.032 54.5387 50.264 1.52972 50.264 1.38138C50.264 1.23304 50.1094 0.958366 49.7226 1.00536C49.3359 1.05236 49.3359 1.14637 49.1812 1.56937C49.0265 1.99237 48.021 7.5854 45.4686 21.7325C42.9161 35.8796 41.524 38.6996 42.1428 42.5536C43.3421 46.8776 43.767 48.2406 43.9217 49.1806Z" fill={selectedDefectBlade === verticalBlade ? C.primary : '#EDEDED'} stroke="black" strokeWidth="1.5"/>
              <path d="M54.3899 57.1826C53.4985 56.8466 49.7498 54.5036 49.7498 54.5036C49.7498 54.5036 49.0313 54.714 47.7551 56.9244C46.4789 59.1349 46.6946 59.7953 46.6946 59.7953C46.6946 59.7953 92.4857 86.5007 92.6142 86.5749C92.7426 86.649 93.0578 86.6524 93.2105 86.294C93.3632 85.9356 93.2818 85.8886 92.9928 85.5431C92.7038 85.1976 88.3628 81.5304 77.3873 72.2463C66.4118 62.9623 64.6657 60.3467 61.0186 58.9555C56.6742 57.8322 55.2814 57.5187 54.3899 57.1826Z" fill={(() => { const blades = ['A','B','C']; const idx = Math.max(0, blades.indexOf(verticalBlade)); return selectedDefectBlade === blades[(idx + 2) % 3] ? C.primary : '#EDEDED'; })()} stroke="black" strokeWidth="1.5"/>
              <path d="M43.7069 62.4702C44.3764 61.7926 48.0416 59.3209 48.0416 59.3209L44.4501 54.3775C44.4501 54.3775 1.42855 85.3477 1.30853 85.4349C1.18852 85.5221 1.05723 85.8087 1.32257 86.0939C1.58791 86.3792 1.66396 86.3239 2.09711 86.2004C2.53025 86.077 7.64609 83.6029 20.5916 77.3524C33.5371 71.1019 36.6369 70.5706 39.3911 67.8047C42.1844 64.2929 43.0373 63.1479 43.7069 62.4702Z" fill={(() => { const blades = ['A','B','C']; const idx = Math.max(0, blades.indexOf(verticalBlade)); return selectedDefectBlade === blades[(idx + 1) % 3] ? C.primary : '#EDEDED'; })()} stroke="black" strokeWidth="1.5"/>
              <circle cx="46.9366" cy="57.0105" r="3.93249" fill="#D9D9D9" stroke="black"/>
            </svg>
            <div style={{ position: 'absolute', top: '5%', width: '40%', left: '6%' }}>
              <p style={{ fontSize: 11, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', textAlign: 'right', margin: 0 }}>
                {verticalBlade} - {bladeSerials[verticalBlade] || ''}
              </p>
            </div>
            <div style={{ position: 'absolute', top: '68%', width: '30%', left: '-28%' }}>
              <p style={{ fontSize: 11, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', textAlign: 'right', margin: 0 }}>
                {(() => { const blades = ['A','B','C']; const idx = Math.max(0, blades.indexOf(verticalBlade)); const lb = blades[(idx + 1) % 3]!; return `${lb} - ${bladeSerials[lb] || ''}`; })()}
              </p>
            </div>
            <div style={{ position: 'absolute', top: '68%', width: '30%', left: '98%' }}>
              <p style={{ fontSize: 11, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', textAlign: 'left', margin: 0 }}>
                {(() => { const blades = ['A','B','C']; const idx = Math.max(0, blades.indexOf(verticalBlade)); const rb = blades[(idx + 2) % 3]!; return `${rb} - ${bladeSerials[rb] || ''}`; })()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONFIRMATION MODAL ═══ */}
      {showBladeConfirm && (
        <div style={modalOverlay}>
          <div style={popoverStyle}>
            <div style={popoverTitle}>Update vertical blade</div>
            <div style={popoverQuestion}>
              <p style={{ margin: '0 0 12px' }}>You are about to change the vertical blade, this action will change the blade picture distribution according to the specified blade ordering (CW or CCW).</p>
              <b>Do you confirm setting the vertical blade to &ldquo;{selectedBladeLabel}&rdquo;?</b>
            </div>
            <div style={popoverBtnGroup}>
              <button style={cancelBtnStyle} onClick={() => setShowBladeConfirm(false)}>Cancel</button>
              <button style={confirmBtnStyle} onClick={() => { setVerticalBlade(pendingVerticalBlade); localStorage.setItem(storageKey, pendingVerticalBlade); updateVerticalBladeMutation.mutate(pendingVerticalBlade); setShowBladeConfirm(false); }}>Confirm</button>
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
    <button onClick={onClick} style={{
      ...categoryBtnStyle,
      borderColor: active ? C.primary : C.borderLight,
      background: active ? C.primaryLight : '#FFFFFF',
    }}>
      <div style={{ ...categoryAvatar, background: color }}>{count}</div>
      <span style={{ fontSize: 12, fontWeight: 600, color: active ? C.primary : C.text, textTransform: 'uppercase' as const }}>{label}</span>
    </button>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  overflow: 'hidden',
  background: C.bgGray,
  position: 'relative',
};

const sidebarStyle: React.CSSProperties = {
  width: 260,
  minWidth: 260,
  display: 'flex',
  flexDirection: 'column',
  background: C.bg,
  borderRight: `1px solid ${C.border}`,
  overflow: 'hidden',
};

const sidebarInner: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const fastForwardRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  background: C.bg,
};

const switchLabel: React.CSSProperties = { position: 'relative', display: 'inline-flex', cursor: 'pointer' };
const switchInput: React.CSSProperties = { position: 'absolute', opacity: 0, width: 0, height: 0 };
const switchTrack: React.CSSProperties = { width: 36, height: 20, borderRadius: 10, background: '#ccc', position: 'relative', transition: 'background 0.2s' };
const switchTrackActive: React.CSSProperties = { ...switchTrack, background: C.primary };
const switchThumb: React.CSSProperties = { position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: C.bg, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' };
const switchThumbActive: React.CSSProperties = { ...switchThumb, left: 18 };

const dividerStyle: React.CSSProperties = { border: 'none', borderTop: `1px solid ${C.borderLight}`, margin: 0 };

const progressBarBg: React.CSSProperties = { width: '100%', height: 6, background: '#E0E0E0', borderRadius: 3, overflow: 'hidden' };
const progressBarFill: React.CSSProperties = { height: '100%', background: C.primary, borderRadius: 3, transition: 'width 0.3s ease' };

const buttonGroupStyle: React.CSSProperties = { display: 'flex' };
const btnGroupItem: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  border: `1px solid ${C.primary}`,
  background: C.bg,
  color: C.primary,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 0.15s',
};
const btnGroupItemActive: React.CSSProperties = {
  background: C.primary,
  color: C.bg,
};

const categoryBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '8px 12px',
  border: `1px solid ${C.primary}`,
  borderRadius: 4,
  background: '#FFFFFF',
  cursor: 'pointer',
  outline: 'none',
};
const categoryAvatar: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#FFFFFF',
  fontSize: 12,
  fontWeight: 700,
};

const thumbnailsContainer: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
};
const thumbnailGroupTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: C.text,
  margin: '4px 0 6px',
};
const thumbnailGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 4,
};
const thumbnailItem: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '4/3',
  borderRadius: 3,
  overflow: 'hidden',
  cursor: 'pointer',
  background: '#ddd',
};

const mainViewerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#1a1a1a',
  overflow: 'hidden',
};

const imageBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  background: C.bg,
  borderBottom: `1px solid ${C.borderLight}`,
  minHeight: 40,
  gap: 8,
};

const navBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 30,
  border: `1px solid ${C.primary}`,
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
};

const flagBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 30,
  border: '1px solid #FFEB3B',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
};

const metaTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.text,
  userSelect: 'none',
};

const metaSep: React.CSSProperties = {
  margin: '0 6px',
  color: C.muted,
};

const editBtnStyle: React.CSSProperties = {
  padding: '3px 12px',
  border: `1px solid ${C.primary}`,
  borderRadius: 4,
  background: 'transparent',
  color: C.primary,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 30,
  border: `1px solid ${C.primary}`,
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
};

const rightPanelStyle: React.CSSProperties = {
  width: 240,
  minWidth: 240,
  display: 'flex',
  flexDirection: 'column',
  background: C.bg,
  borderLeft: `1px solid ${C.border}`,
  overflow: 'hidden',
};
const rightPanelInner: React.CSSProperties = {
  padding: 16,
  overflowY: 'auto',
  flex: 1,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: C.muted,
  marginBottom: 4,
};
const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: `1px solid ${C.borderLight}`,
  borderRadius: 4,
  fontSize: 13,
  color: C.text,
  background: C.bg,
  cursor: 'pointer',
  outline: 'none',
  boxSizing: 'border-box',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: `1px solid ${C.borderLight}`,
  borderRadius: 4,
  fontSize: 13,
  color: C.text,
  background: C.bg,
  outline: 'none',
  boxSizing: 'border-box',
};

const catBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  border: `1px solid ${C.borderLight}`,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  background: C.bg,
  color: C.text,
  outline: 'none',
};
const catBtnActive: React.CSSProperties = {
  background: C.primary,
  color: C.bg,
  borderColor: C.primary,
};

const saveBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 20px',
  background: C.primaryDisabled,
  color: C.bg,
  border: 'none',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'not-allowed',
};

const hubDiagramContainer: React.CSSProperties = {
  background: C.bg,
  paddingTop: 16,
  borderTop: `1px solid ${C.border}`,
  display: 'flex',
  justifyContent: 'center',
  paddingBottom: 16,
};

const changeBladeAccordionStyle: React.CSSProperties = {
  borderTop: `1px solid ${C.borderLight}`,
  background: C.bg,
};

const changeBladeBtn: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  outline: 'none',
};

const saveVerticalBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: C.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const modalOverlay: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const popoverStyle: React.CSSProperties = {
  background: C.bg,
  borderRadius: 8,
  padding: 24,
  maxWidth: 420,
  width: '90%',
  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
};

const popoverTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: C.text,
  marginBottom: 16,
};

const popoverQuestion: React.CSSProperties = {
  fontSize: 14,
  color: C.text,
  lineHeight: 1.5,
  marginBottom: 20,
};

const popoverBtnGroup: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#E0E0E0',
  color: '#333B46',
  border: 'none',
  borderRadius: 4,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const confirmBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#F15959',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const editPopoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
  background: '#FFFFFF',
  borderRadius: 8,
  padding: 24,
  minWidth: 300,
  boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
};

const editFieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: C.text,
  marginBottom: 8,
};

const editGroupBtn: React.CSSProperties = {
  padding: '6px 16px',
  border: `1px solid ${C.primary}`,
  background: C.bg,
  color: C.primary,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
  marginLeft: -1,
};

const editGroupBtnActive: React.CSSProperties = {
  background: C.primary,
  color: C.bg,
};

const editNumberInput: React.CSSProperties = {
  width: 70,
  padding: '6px 8px',
  border: `1px solid ${C.borderLight}`,
  borderRadius: 4,
  fontSize: 14,
  color: C.text,
  outline: 'none',
  textAlign: 'center',
  background: '#FFFFFF',
};

const annotationPopoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 60,
  background: '#FFFFFF',
  borderRadius: 8,
  padding: 24,
  minWidth: 360,
  maxWidth: 500,
  boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
};

const annotBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 4,
  right: 4,
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: '#F44336',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const tagBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  left: 4,
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: '#FFEB3B',
  border: '2px solid #fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};
