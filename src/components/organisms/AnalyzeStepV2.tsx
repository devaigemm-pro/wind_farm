import { useState, useMemo, useCallback, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import { useUpdateAnnotation, useDeleteAnnotation, useCampaignInspectionIds, useMultiAnnotations } from '@/hooks/useAnnotations';
import { useQueryClient } from '@tanstack/react-query';
import { useInspectionPhotos, getFaceShort, getPhotoPublicUrl } from '@/hooks/useInspectionPhotos';
import { useDefects } from '@/hooks/useDefects';
import { useCreateDefect } from '@/hooks/useDefectMutations';
import { useAnnotationTypes } from '@/hooks/useAnnotationTypes';
import { supabase } from '@/lib/supabase';
import type { Inspection, DefectType, Severity } from '@/types';

export interface AnalyzeStepV2Props {
  inspectionId: string;
  inspection?: Inspection;
  campaignId?: string | null;
  preselectedDefectId?: string;
  onOpenPhoto?: (photoId: string, blade: string) => void;
}

// ─── Local defect interface for this component ───────────────────────────────
interface Defect {
  id: string;
  annotationId: string;
  photoId: string;
  type: string;
  cat: number;
  blade: string;
  face: string;
  root: number;
  size: string;
  note: string;
  rootCause: string;
  nextStep: string;
  thumbnailUrl?: string;
  imageUrl?: string;
}

// ─── Legacy thumbnail → blade/face mapping (for old annotations with t1-t18 IDs) ─
function deriveBladeFaceLegacy(thumbnailId: string): { blade: string; face: string } {
  const num = parseInt(thumbnailId.replace('t', ''), 10);
  if (num >= 1 && num <= 4) return { blade: 'A', face: 'LE' };
  if (num >= 5 && num <= 6) return { blade: 'A', face: 'SS' };
  if (num >= 7 && num <= 9) return { blade: 'B', face: 'LE' };
  if (num >= 10 && num <= 12) return { blade: 'B', face: 'SS' };
  if (num >= 13 && num <= 15) return { blade: 'C', face: 'LE' };
  if (num >= 16 && num <= 18) return { blade: 'C', face: 'SS' };
  return { blade: '?', face: '?' };
}

export function AnalyzeStepV2({ inspectionId, inspection, campaignId: propCampaignId, preselectedDefectId, onOpenPhoto }: AnalyzeStepV2Props) {
  // Auth role for supervisor restrictions
  const { role } = useAuth();
  const { t } = useLanguage();

  // Fetch ALL inspections of the campaign
  const campaignId = propCampaignId ?? inspection?.campaign_id ?? null;
  const { data: campaignInspIds = [] } = useCampaignInspectionIds(campaignId);

  // Load annotations from ALL inspections in the campaign
  const { data: dbAnnotations, isLoading: annotationsLoading } = useMultiAnnotations(
    campaignInspIds.length > 0 ? campaignInspIds : (inspectionId ? [inspectionId] : [])
  );
  const updateAnnotation = useUpdateAnnotation(inspectionId);
  const queryClient = useQueryClient();

  // Fetch photos (ALL blades of the campaign) to build blade/face lookup
  const { data: photos = [], isLoading: photosLoading } = useInspectionPhotos(campaignId, null);

  // Build bladeId → position letter mapping from photos (uses real blade.position)
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

  // Build a photo lookup map: photoId → { blade, face }
  const photoLookup = useMemo(() => {
    const map: Record<string, { blade: string; face: string; storagePath: string; bladeRootDistance: number | null; distanceToBlade: number | null }> = {};
    for (const photo of photos) {
      map[photo.id] = {
        blade: bladePositionMap[photo.bladeId] ?? 'A',
        face: getFaceShort(photo.face),
        storagePath: photo.storagePath,
        bladeRootDistance: photo.bladeRootDistance,
        distanceToBlade: photo.distanceToBlade,
      };
    }
    return map;
  }, [photos, bladePositionMap]);

  // Derive blade/face from thumbnailId — supports both UUID (real photos) and legacy t1-t18 format
  function deriveBladeFace(thumbnailId: string): { blade: string; face: string } {
    if (photoLookup[thumbnailId]) return photoLookup[thumbnailId];
    return deriveBladeFaceLegacy(thumbnailId);
  }

  // Map DB annotations to Defect[] format, assigning sequential IDs per blade
  const defectsFromDb = useMemo<Defect[]>(() => {
    if (!dbAnnotations || dbAnnotations.length === 0) return [];
    const counters: Record<string, number> = {};
    return dbAnnotations.map((a) => {
      const derived = deriveBladeFace(a.thumbnailId);
      const blade = derived.blade;
      const face = a.side || derived.face;
      counters[blade] = (counters[blade] || 0) + 1;
      const id = `${blade}${counters[blade]}`;
      return {
        id,
        annotationId: a.id,
        photoId: a.thumbnailId,
        type: a.type,
        cat: a.category,
        blade,
        face,
        root: (() => {
          const ph = photoLookup[a.thumbnailId];
          if (ph && ph.bladeRootDistance != null) {
            const dtb = ph.distanceToBlade || 5;
            const vertCoverage = 2 * dtb * Math.tan((56.7 * Math.PI / 180) / 2) / 6;
            const offset = (a.y / 100) * vertCoverage;
            return Math.round((ph.bladeRootDistance + offset) * 10) / 10;
          }
          return Math.round(a.y * 0.43 * 10) / 10;
        })(),
        size: `${Math.round(a.w)} x ${Math.round(a.h)} cm`,
        note: a.note.replace(/^\[oval\]/, '').replace(/^\[pencil\].*?\|\|\|/, '').replace(/^\[pencil\].*$/, ''),
        rootCause: a.rootCause || '',
        nextStep: a.nextStep || '',
        thumbnailUrl: photoLookup[a.thumbnailId]?.storagePath
          ? getPhotoPublicUrl(photoLookup[a.thumbnailId]!.storagePath, 'thumbnail')
          : undefined,
        imageUrl: photoLookup[a.thumbnailId]?.storagePath
          ? getPhotoPublicUrl(photoLookup[a.thumbnailId]!.storagePath, 'viewer')
          : undefined,
      };
    });
  }, [dbAnnotations, photoLookup]);

  const defects = defectsFromDb;

  // ─── Load confirmed defects from DB (persisted) ─────────────────────────
  const { data: savedDefects = [] } = useDefects(inspectionId);
  const createDefect = useCreateDefect();
  const { data: annotationTypes = [] } = useAnnotationTypes();

  // Derive confirmedIds from saved defects (description field stores annotationId)
  // AND from annotations with is_defect = true (backup persistence method)
  const confirmedIds = useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    for (const d of savedDefects) {
      if (d.description) ids.add(d.description);
    }
    // Also include annotations flagged as is_defect (in case defect insert failed due to RLS)
    for (const a of (dbAnnotations ?? [])) {
      if ((a as any).isDefect) ids.add(a.id);
    }
    return ids;
  }, [savedDefects, dbAnnotations]);

  const [selectedBlade, setSelectedBlade] = useState<string>('A');
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);
  const [expandedBlades, setExpandedBlades] = useState<Set<string>>(new Set(['A', 'B', 'C']));
  const [bladeNotes, setBladeNotes] = useState<Record<string, string>>({ A: '', B: '', C: '' });

  // Defect editor state
  const [defectType, setDefectType] = useState('');
  const [category, setCategory] = useState(0);
  const [rootDistance, setRootDistance] = useState('');
  const [bladeFace, setBladeFace] = useState('');
  const [note, setNote] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [markingAnalyzed, setMarkingAnalyzed] = useState(false);

  // ─── Derived: pending (left panel) vs confirmed (right panel) ────────────
  const pendingDefects = useMemo(() => defects.filter(d => !confirmedIds.has(d.annotationId)), [defects, confirmedIds]);
  const confirmedDefects = useMemo(() => defects.filter(d => confirmedIds.has(d.annotationId)), [defects, confirmedIds]);

  const pendingBladeCounts = useMemo(() => ({
    A: pendingDefects.filter(d => d.blade === 'A').length,
    B: pendingDefects.filter(d => d.blade === 'B').length,
    C: pendingDefects.filter(d => d.blade === 'C').length,
  }), [pendingDefects]);

  const confirmedBladeCounts = useMemo(() => ({
    A: confirmedDefects.filter(d => d.blade === 'A').length,
    B: confirmedDefects.filter(d => d.blade === 'B').length,
    C: confirmedDefects.filter(d => d.blade === 'C').length,
  }), [confirmedDefects]);

  // Current blade's pending annotations for left panel
  const currentBladePending = useMemo(
    () => pendingDefects.filter(d => d.blade === selectedBlade),
    [pendingDefects, selectedBlade]
  );

  const selectedDefect = defects.find(d => d.annotationId === selectedDefectId) || null;

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleDefectSelect = useCallback((defect: Defect) => {
    setSelectedDefectId(defect.annotationId);
    setDefectType(defect.type);
    setCategory(defect.cat);
    setRootDistance(String(defect.root));
    setBladeFace(defect.face);
    setNote(defect.note);
    setRootCause(defect.rootCause);
    setNextStep(defect.nextStep);
  }, []);

  const handleClear = useCallback(() => {
    setDefectType('');
    setCategory(0);
    setRootDistance('');
    setBladeFace('');
    setNote('');
    setRootCause('');
    setNextStep('');
    setSelectedDefectId(null);
  }, []);

  // Preselect defect from step 4 edit navigation
  useEffect(() => {
    if (preselectedDefectId && defectsFromDb.length > 0) {
      const defect = defectsFromDb.find(d => d.annotationId === preselectedDefectId);
      if (defect) {
        handleDefectSelect(defect);
        setSelectedBlade(defect.blade);
      }
    }
  }, [preselectedDefectId, defectsFromDb, handleDefectSelect]);

  const handleSaveDefect = async () => {
    if (role === 'supervisor') return;
    if (!selectedDefectId) return;
    setSaveStatus('saving');
    try {
      const rootDistNum = parseFloat(rootDistance) || 0;
      // Update the annotation fields (preserve original x/y position — never overwrite drawing coords)
      await updateAnnotation.mutateAsync({
        id: selectedDefectId,
        type: defectType,
        category: category,
        note: note,
        rootCause: rootCause,
        nextStep: nextStep,
        side: bladeFace,
      });
      // Create a defect record in DB to persist the confirmed status
      // description stores the annotationId for the link
      // Only create if not already confirmed (avoid duplicates on re-save)
      if (!confirmedIds.has(selectedDefectId)) {
        const defectTypeMap: Record<string, DefectType> = {
          'LE EROSION': 'le_erosion',
          'VORTEX (MISSING PANELS)': 'vortex',
          'PAINT DAMAGES': 'paint_defect',
          'CRACK': 'crack',
          'BLADES WITH HYDRAULIC OIL': 'other',
          'OTHER ADD-ONS MISSING': 'other',
        };
        // Try to create defect record (may fail due to RLS)
        try {
          // Get annotation dimensions for defect size
          const annotation = (dbAnnotations ?? []).find(a => a.id === selectedDefectId);
          await createDefect.mutateAsync({
            inspection_id: inspectionId,
            type: (defectTypeMap[defectType] || 'other') as DefectType,
            severity: (category || 3) as Severity,
            distance_from_root: rootDistNum,
            description: selectedDefectId, // stores annotationId for persistence
            width_cm: annotation ? Math.round(annotation.w) : undefined,
            height_cm: annotation ? Math.round(annotation.h) : undefined,
          });
        } catch {
          // RLS may block insert — fall through, is_defect flag on annotation is the backup
        }
        // Also mark annotation as confirmed defect (always succeeds, no RLS issue)
        const db = supabase as any;
        await db.from('annotation').update({ is_defect: true }).eq('id', selectedDefectId);
      }
      await queryClient.invalidateQueries({ queryKey: ['annotations-multi'] });
      await queryClient.invalidateQueries({ queryKey: ['annotations', inspectionId] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-annotations'] });
      await queryClient.invalidateQueries({ queryKey: ['defects', inspectionId] });
      handleClear();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  // Bulk save all pending annotations for the selected blade
  const handleBulkSave = async () => {
    if (role === 'supervisor') return;
    const pending = currentBladePending;
    if (pending.length === 0) return;
    setSaveStatus('saving');
    try {
      const defectTypeMap: Record<string, DefectType> = {
        'LE EROSION': 'le_erosion',
        'VORTEX (MISSING PANELS)': 'vortex',
        'PAINT DAMAGES': 'paint_defect',
        'CRACK': 'crack',
        'BLADES WITH HYDRAULIC OIL': 'other',
        'OTHER ADD-ONS MISSING': 'other',
      };
      for (const d of pending) {
        await updateAnnotation.mutateAsync({
          id: d.annotationId,
          type: d.type,
          category: d.cat,
          note: d.note,
          rootCause: d.rootCause,
          nextStep: d.nextStep,
          side: d.face,
        });
        await createDefect.mutateAsync({
          inspection_id: inspectionId,
          type: (defectTypeMap[d.type] || 'other') as DefectType,
          severity: (d.cat || 3) as Severity,
          distance_from_root: d.root,
          description: d.annotationId,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['annotations-multi'] });
      await queryClient.invalidateQueries({ queryKey: ['annotations', inspectionId] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-annotations'] });
      await queryClient.invalidateQueries({ queryKey: ['defects', inspectionId] });
      handleClear();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  // Mark selected annotation as analyzed: removes it from left panel AND deletes it from DB
  const deleteAnnotation = useDeleteAnnotation(inspectionId);
  const handleMarkAsAnalyzed = async () => {
    if (role === 'supervisor') return;
    if (!selectedDefectId) return;
    setMarkingAnalyzed(true);
    try {
      await deleteAnnotation.mutateAsync(selectedDefectId);
      await queryClient.invalidateQueries({ queryKey: ['annotations-multi'] });
      await queryClient.invalidateQueries({ queryKey: ['annotations', inspectionId] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-annotations'] });
      handleClear();
    } catch (err) {
      console.error('[AnalyzeStep] Failed to mark as analyzed:', err);
    } finally {
      setMarkingAnalyzed(false);
    }
  };

  // ─── Drag & Drop ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, annotationId: string) => {
    e.dataTransfer.setData('text/plain', annotationId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const annotationId = e.dataTransfer.getData('text/plain');
    if (!annotationId) return;
    const defect = defects.find(d => d.annotationId === annotationId);
    if (defect) handleDefectSelect(defect);
  }, [defects, handleDefectSelect]);

  const toggleBladeExpand = (blade: string) => {
    setExpandedBlades(prev => {
      const next = new Set(prev);
      if (next.has(blade)) next.delete(blade);
      else next.add(blade);
      return next;
    });
  };

  // Loading state
  if (annotationsLoading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-gray-200 border-t-[#5A8F5A] animate-spin" />
          <span className="text-[13px] text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (!annotationsLoading && (!dbAnnotations || dbAnnotations.length === 0) && !inspectionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-12">
        <BarChart2 size={48} className="text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-600 m-0">No defects to analyze</h3>
        <p className="text-sm text-gray-400 m-0 text-center max-w-[400px]">
          Complete the annotation step first to generate analysis data. Photos must be uploaded and annotated before analysis can begin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#F7F8FA] p-3 gap-3 font-['Inter',sans-serif] items-stretch">
      {/* ═══ LEFT PANEL: Pending Annotations (compact sidebar) ═══ */}
      <div className="flex-[1.4] min-w-[300px] max-w-[380px] flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 overflow-y-auto flex-1">
          <div className="flex justify-between items-center mb-3">
            <h5 className="text-lg font-semibold text-gray-800 m-0">{t('analyze.annotations')}</h5>
            {currentBladePending.length > 0 && (
              <button
                className="px-2.5 py-1 bg-[#5A8F5A] text-white border-none rounded text-[11px] font-bold cursor-pointer tracking-wide"
                onClick={handleBulkSave}
                disabled={role === 'supervisor'}
              >
                {t('analyze.saveAsDefects')} ({currentBladePending.length})
              </button>
            )}
          </div>

          {/* Blade tabs with badges */}
          <div className="flex gap-2 mb-4">
            {(['A', 'B', 'C'] as const).map((b) => (
              <BladeTab
                key={b}
                blade={b}
                count={pendingBladeCounts[b]}
                selected={selectedBlade === b}
                onClick={() => { setSelectedBlade(b); setSelectedDefectId(null); }}
              />
            ))}
          </div>

          {/* Pending annotations thumbnails — draggable */}
          {currentBladePending.length === 0 ? (
            <div className="border border-gray-200 rounded-md p-3 mb-3">
              <p className="text-[13px] text-gray-400 m-0 text-center">
                {t('analyze.allConfirmed')} {selectedBlade}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3 max-h-80 overflow-y-auto">
              {currentBladePending.map((d) => (
                <div
                  key={d.annotationId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, d.annotationId)}
                  onClick={() => handleDefectSelect(d)}
                  className={cn(
                    'w-20 h-20 rounded-md overflow-hidden cursor-grab relative flex items-center justify-center',
                    selectedDefectId === d.annotationId
                      ? 'border-2 border-[#5A8F5A] bg-[rgba(90,143,90,0.1)]'
                      : 'border border-gray-200 bg-gray-50'
                  )}
                >
                  {(d.thumbnailUrl || d.imageUrl) ? (
                    <img src={d.thumbnailUrl || d.imageUrl} alt={d.type} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-gray-400 text-center p-1">{d.type}</span>
                  )}
                  <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold text-white bg-black/60 rounded-sm px-1 py-px">
                    {d.id}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Preview area for selected annotation */}
          {selectedDefect && !confirmedIds.has(selectedDefect.annotationId) ? (
            <div className="flex-1 min-h-[140px] border border-gray-200 rounded-lg flex flex-col overflow-hidden bg-white">
              <div className="flex justify-between items-start px-3 py-2.5 border-b border-gray-200 bg-white">
                <div>
                  <div className="text-sm font-bold text-gray-800">{selectedDefect.type}</div>
                  <div className="text-[13px] font-semibold text-gray-800">{t('analyze.categoryLabel')}: {selectedDefect.cat}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-800">{selectedDefect.blade} - {selectedDefect.face} - {selectedDefect.root}m</div>
                  <div className="text-[13px] text-gray-400">{selectedDefect.size}</div>
                </div>
              </div>
              <div className="relative flex-1 min-h-[120px] bg-[#222] overflow-hidden">
                {selectedDefect.imageUrl ? (
                  <img src={selectedDefect.imageUrl} alt="defect preview" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#333] flex items-center justify-center">
                    <span className="text-gray-500 text-xs">{t('defectImage.noImage')}</span>
                  </div>
                )}
                <div className="absolute bottom-2.5 left-2.5">
                  <button
                    className="px-3 py-1 bg-white/90 border border-gray-200 rounded text-xs font-bold cursor-pointer text-[#5A8F5A]"
                    onClick={() => { if (selectedDefect && onOpenPhoto) onOpenPhoto(selectedDefect.photoId, selectedDefect.blade); }}
                  >
                    {t('analyze.open')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-[140px] border border-gray-200 rounded-md flex items-center justify-center bg-gray-50">
              <p className="text-[13px] text-gray-400 m-0 text-center">
                {t('analyze.selectOrDrag')}
              </p>
            </div>
          )}
        </div>
      </div>


      {/* ═══ CENTER PANEL: Defect Editor (main area) ═══ */}
      <div className="flex-[2] flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-w-0" onDragOver={handleDragOver} onDrop={handleDrop}>
        <div className="p-4 flex flex-col flex-1 min-h-0">
          <h5 className="text-sm font-semibold text-gray-800 mb-2 shrink-0">{t('analyze.defectEditor')}</h5>

          {/* Defect image — uses object-contain to show full without crop */}
          <div className="relative flex-1 min-h-0 mb-3 rounded-xl overflow-hidden bg-[#1a1a1a]">
            {selectedDefect?.imageUrl ? (
              <img src={selectedDefect.imageUrl} alt="defect" loading="lazy" className="w-full h-full object-contain" />
            ) : photosLoading ? (
              <div className="w-full h-full bg-[#2a2a2a] rounded-md flex items-center justify-center">
                <div className="w-7 h-7 border-3 border-gray-600 border-t-[#5A8F5A] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="w-full h-full bg-[#2a2a2a] rounded-md flex items-center justify-center">
                <span className="text-gray-500 text-[13px]">
                  {selectedDefect ? t('defectImage.noImage') : t('analyze.dropAnnotation')}
                </span>
              </div>
            )}
            {selectedDefect && (
              <>
                <span className="absolute bottom-1.5 left-1.5 bg-black/65 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-sm">
                  {selectedDefect.root}m
                </span>
                <span className="absolute bottom-1.5 right-1.5 bg-black/65 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-sm">
                  {selectedDefect.face}
                </span>
              </>
            )}
          </div>

          {/* Form fields */}
          <div className="flex flex-col gap-2 shrink-0">
            {/* Type */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-400">{t('analyze.type')}</label>
              <select
                className="w-full px-2.5 py-2 border border-gray-200 rounded text-[13px] text-gray-800 bg-white outline-none cursor-pointer"
                value={defectType}
                onChange={(e) => setDefectType(e.target.value)}
              >
                <option value="">{t('analyze.select')}</option>
                {annotationTypes.map(at => (
                  <option key={at.id} value={at.name}>{at.name}</option>
                ))}
              </select>
            </div>

            {/* Category + Root distance + Blade face row */}
            <div className="flex gap-3 items-end">
              <div className="flex flex-col gap-1 flex-shrink-0">
                <label className="text-[11px] font-medium text-gray-400">{t('analyze.category')}</label>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((c) => {
                    const isActive = category === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={cn(
                          'w-[34px] h-[34px] border-[1.5px] text-[13px] font-semibold cursor-pointer outline-none',
                          isActive
                            ? 'bg-[#5A8F5A] text-white border-[#5A8F5A]'
                            : 'bg-white text-gray-800 border-gray-200',
                          c === 1 && 'rounded-l',
                          c === 5 && 'rounded-r'
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] font-medium text-gray-400">{t('annotate.rootDistance')}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="w-full px-2.5 py-2 border border-gray-200 rounded text-[13px] text-gray-800 bg-white outline-none"
                  value={rootDistance}
                  onChange={(e) => setRootDistance(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] font-medium text-gray-400">{t('analyze.bladeFace')}</label>
                <select
                  className="w-full px-2.5 py-2 border border-gray-200 rounded text-[13px] text-gray-800 bg-white outline-none cursor-pointer"
                  value={bladeFace}
                  onChange={(e) => setBladeFace(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="LE">LE</option>
                  <option value="SS">SS</option>
                  <option value="TE">TE</option>
                  <option value="PS">PS</option>
                </select>
              </div>
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-400">{t('analyze.noteLabel')}</label>
              <div className="relative flex items-center">
                <input
                  className="w-full px-2.5 py-2 pr-7 border border-gray-200 rounded text-[13px] text-gray-800 bg-white outline-none"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('defects.descriptionPlaceholder')}
                />
                {note && (
                  <button className="absolute right-1.5 bg-transparent border-none cursor-pointer text-base text-gray-400 p-0.5 leading-none" onClick={() => setNote('')}>
                    &times;
                  </button>
                )}
              </div>
            </div>

            {/* Root cause */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-400">{t('analyze.rootCause')}</label>
              <div className="relative flex items-center">
                <input
                  className="w-full px-2.5 py-2 pr-7 border border-gray-200 rounded text-[13px] text-gray-800 bg-white outline-none"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder={t('defects.causePlaceholder')}
                />
                {rootCause && (
                  <button className="absolute right-1.5 bg-transparent border-none cursor-pointer text-base text-gray-400 p-0.5 leading-none" onClick={() => setRootCause('')}>
                    &times;
                  </button>
                )}
              </div>
            </div>

            {/* Next step */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-400">{t('analyze.nextStep')}</label>
              <div className="relative flex items-center">
                <input
                  className="w-full px-2.5 py-2 pr-7 border border-gray-200 rounded text-[13px] text-gray-800 bg-white outline-none"
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder={t('defects.actionPlaceholder')}
                />
                {nextStep && (
                  <button className="absolute right-1.5 bg-transparent border-none cursor-pointer text-base text-gray-400 p-0.5 leading-none" onClick={() => setNextStep('')}>
                    &times;
                  </button>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 justify-end mt-1">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 border-none rounded text-xs font-bold cursor-pointer tracking-wide"
                onClick={handleClear}
              >
                {t('analyze.clear')}
              </button>
              <button
                className={cn(
                  'px-4 py-2 bg-[#5A8F5A] text-white border-none rounded text-xs font-bold tracking-wide',
                  selectedDefectId && role !== 'supervisor'
                    ? 'opacity-100 cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                )}
                onClick={handleSaveDefect}
                disabled={!selectedDefectId || saveStatus === 'saving' || role === 'supervisor'}
              >
                {saveStatus === 'saving' ? t('analyze.saving') : saveStatus === 'saved' ? t('analyze.saved') : t('analyze.saveAsDefect')}
              </button>
              <button
                className={cn(
                  'px-4 py-2 bg-red-500 text-white border-none rounded text-xs font-bold tracking-wide',
                  selectedDefectId && role !== 'supervisor' && !markingAnalyzed
                    ? 'opacity-100 cursor-pointer hover:bg-red-600'
                    : 'opacity-40 cursor-not-allowed'
                )}
                onClick={handleMarkAsAnalyzed}
                disabled={!selectedDefectId || role === 'supervisor' || markingAnalyzed}
              >
                {markingAnalyzed ? '...' : 'MARK AS ANALYZED'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL: Summary and Reviews ═══ */}
      <div className="flex-[1.4] min-w-[320px] max-w-[400px] flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-semibold text-gray-800">{t('analyze.summaryTitle')}</h5>
            <span className="text-xs font-bold text-[#5A8F5A] bg-[#5A8F5A]/10 px-2 py-0.5 rounded-full">
              {confirmedDefects.length} confirmed
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5 text-center">
              <p className="text-lg font-bold text-gray-800">{pendingDefects.length}</p>
              <p className="text-[10px] text-gray-400 font-medium uppercase">Pending</p>
            </div>
            <div className="flex-1 bg-[#5A8F5A]/5 rounded-lg px-2.5 py-1.5 text-center">
              <p className="text-lg font-bold text-[#5A8F5A]">{confirmedDefects.length}</p>
              <p className="text-[10px] text-gray-400 font-medium uppercase">Confirmed</p>
            </div>
          </div>
        </div>

        <div className="p-3 overflow-y-auto flex-1">
          {(['A', 'B', 'C'] as const).map((blade) => {
            const bladeDefects = confirmedDefects.filter(d => d.blade === blade);
            const isExpanded = expandedBlades.has(blade);
            return (
              <div key={blade} className="border-b border-gray-100 mb-0.5">
                <button onClick={() => toggleBladeExpand(blade)} className="w-full flex justify-between items-center py-2 px-1 bg-transparent border-none cursor-pointer text-[13px] font-medium text-gray-700">
                  <span>{t('turbineDetail.filterBlade')} {blade}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-600">{confirmedBladeCounts[blade]}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" className={cn('fill-gray-400 transition-transform duration-200', isExpanded && 'rotate-180')}><path d="M7 10l5 5 5-5z" /></svg>
                  </div>
                </button>
                {isExpanded && bladeDefects.length > 0 && (
                  <div className="pb-2">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr>
                          <th className="py-0.5 px-1 text-left font-bold text-[9px] text-gray-400 border-b border-gray-100">#</th>
                          <th className="py-0.5 px-1 text-left font-bold text-[9px] text-gray-400 border-b border-gray-100">{t('analyze.type')}</th>
                          <th className="py-0.5 px-1 text-left font-bold text-[9px] text-gray-400 border-b border-gray-100">{t('results.face')}</th>
                          <th className="py-0.5 px-1 text-left font-bold text-[9px] text-gray-400 border-b border-gray-100">{t('analyze.category')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bladeDefects.map((d) => (
                          <tr key={d.id} onClick={() => handleDefectSelect(d)} className={cn('cursor-pointer hover:bg-gray-50', selectedDefectId === d.annotationId && 'bg-[rgba(90,143,90,0.08)]')}>
                            <td className="py-0.5 px-1 text-[11px] text-gray-700">{d.id}</td>
                            <td className="py-0.5 px-1 text-[11px] text-gray-700 truncate max-w-[100px]">{d.type}</td>
                            <td className="py-0.5 px-1 text-[11px] text-gray-700">{d.face}</td>
                            <td className="py-0.5 px-1 text-[11px] text-gray-700">{d.cat}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── BladeTab sub-component ──────────────────────────────────────────────────
function BladeTab({ blade, count, selected, onClick }: { blade: string; count: number; selected: boolean; onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={cn(
          'px-3.5 py-1.5 rounded border text-[13px] font-semibold cursor-pointer transition-all duration-150',
          selected
            ? 'border-[#5A8F5A] bg-[#5A8F5A] text-white'
            : 'border-gray-200 bg-white text-gray-800'
        )}
      >
        {t('turbineDetail.filterBlade')} {blade}
      </button>
      <span className="absolute -top-1.5 -right-1.5 bg-[#FF4081] text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center">
        {count}
      </span>
    </div>
  );
}
