import { useState, useMemo, useCallback } from 'react';
import { BarChart2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import { useUpdateAnnotation, useDeleteAnnotation, useCampaignInspectionIds, useMultiAnnotations } from '@/hooks/useAnnotations';
import { useQueryClient } from '@tanstack/react-query';
import { useInspectionPhotos, getFaceShort, getPhotoPublicUrl } from '@/hooks/useInspectionPhotos';
import { useDefects } from '@/hooks/useDefects';
import { useCreateDefect } from '@/hooks/useDefectMutations';
import { supabase } from '@/lib/supabase';
import type { Inspection, DefectType, Severity } from '@/types';

export interface AnalyzeStepProps {
  inspectionId: string;
  inspection?: Inspection;
  campaignId?: string | null;
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

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#5A8F5A',
  primaryDark: '#4A7A4A',
  text: '#333B46',
  muted: '#8A9099',
  border: '#E0E0E0',
  bg: '#FFFFFF',
  bgLight: '#F5F7FA',
  selected: 'rgba(90, 143, 90, 0.10)',
  selectedBorder: '#5A8F5A',
};

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

export function AnalyzeStep({ inspectionId, inspection, campaignId: propCampaignId, onOpenPhoto }: AnalyzeStepProps) {
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
    const map: Record<string, { blade: string; face: string; storagePath: string }> = {};
    for (const photo of photos) {
      map[photo.id] = { blade: bladePositionMap[photo.bladeId] ?? 'A', face: getFaceShort(photo.face), storagePath: photo.storagePath };
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
        root: Math.round(a.y * 0.43 * 10) / 10,
        size: `${Math.round(a.w)} x ${Math.round(a.h)} cm`,
        note: a.note,
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

  const handleSaveDefect = async () => {
    if (role === 'supervisor') return;
    if (!selectedDefectId) return;
    setSaveStatus('saving');
    try {
      const rootDistNum = parseFloat(rootDistance) || 0;
      const yFromRoot = rootDistNum / 0.43;
      // Update the annotation fields
      await updateAnnotation.mutateAsync({
        id: selectedDefectId,
        type: defectType,
        category: category,
        y: yFromRoot,
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
          await createDefect.mutateAsync({
            inspection_id: inspectionId,
            type: (defectTypeMap[defectType] || 'other') as DefectType,
            severity: (category || 3) as Severity,
            distance_from_root: rootDistNum,
            description: selectedDefectId, // stores annotationId for persistence
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #eee', borderTopColor: '#5A8F5A', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 13, color: '#888' }}>Loading...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (!annotationsLoading && (!dbAnnotations || dbAnnotations.length === 0) && !inspectionId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 48 }}>
        <BarChart2 size={48} color="#ccc" />
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#555', margin: 0 }}>No defects to analyze</h3>
        <p style={{ fontSize: 14, color: '#888', margin: 0, textAlign: 'center', maxWidth: 400 }}>
          Complete the annotation step first to generate analysis data. Photos must be uploaded and annotated before analysis can begin.
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* ═══ LEFT PANEL: Pending Annotations ═══ */}
      <div style={panelStyle}>
        <div style={panelInner}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h5 style={{ ...panelTitle, margin: 0 }}>{t('analyze.annotations')}</h5>
            {currentBladePending.length > 0 && (
              <button
                style={{ ...saveBtnStyle, fontSize: 11, padding: '5px 10px' }}
                onClick={handleBulkSave}
                disabled={role === 'supervisor'}
              >
                {t('analyze.saveAsDefects')} ({currentBladePending.length})
              </button>
            )}
          </div>
          {/* Blade tabs with badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: C.muted, margin: 0, textAlign: 'center' }}>
                {t('analyze.allConfirmed')} {selectedBlade}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, maxHeight: 320, overflowY: 'auto' }}>
              {currentBladePending.map((d) => (
                <div
                  key={d.annotationId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, d.annotationId)}
                  onClick={() => handleDefectSelect(d)}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 6,
                    border: selectedDefectId === d.annotationId ? `2px solid ${C.selectedBorder}` : `1px solid ${C.border}`,
                    background: selectedDefectId === d.annotationId ? C.selected : C.bgLight,
                    overflow: 'hidden',
                    cursor: 'grab',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {(d.thumbnailUrl || d.imageUrl) ? (
                    <img src={d.thumbnailUrl || d.imageUrl} alt={d.type} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 10, color: C.muted, textAlign: 'center', padding: 4 }}>{d.type}</span>
                  )}
                  <span style={{
                    position: 'absolute', bottom: 2, left: 2,
                    fontSize: 9, fontWeight: 700, color: '#fff',
                    background: 'rgba(0,0,0,0.6)', borderRadius: 3, padding: '1px 4px',
                  }}>{d.id}</span>
                </div>
              ))}
            </div>
          )}

          {/* Preview area for selected annotation */}
          {selectedDefect && !confirmedIds.has(selectedDefect.annotationId) ? (
            <div style={previewAreaActiveStyle}>
              <div style={previewHeaderStyle}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{selectedDefect.type}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t('analyze.categoryLabel')}: {selectedDefect.cat}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{selectedDefect.blade} - {selectedDefect.face} - {selectedDefect.root}m</div>
                  <div style={{ fontSize: 13, color: C.muted }}>{selectedDefect.size}</div>
                </div>
              </div>
              <div style={previewImageContainerStyle}>
                {selectedDefect.imageUrl ? (
                  <img src={selectedDefect.imageUrl} alt="defect preview" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#888', fontSize: 12 }}>{t('defectImage.noImage')}</span>
                  </div>
                )}
                <div style={openBtnContainerStyle}>
                  <button style={openBtnStyle} onClick={() => { if (selectedDefect && onOpenPhoto) onOpenPhoto(selectedDefect.photoId, selectedDefect.blade); }}>{t('analyze.open')}</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={previewAreaStyle}>
              <p style={{ fontSize: 13, color: C.muted, margin: 0, textAlign: 'center' }}>
                {t('analyze.selectOrDrag')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Arrow separator */}
      <div style={arrowStyle}>&#x203A;</div>

      {/* ═══ CENTER PANEL: Defect Editor ═══ */}
      <div style={panelStyle} onDragOver={handleDragOver} onDrop={handleDrop}>
        <div style={panelInner}>
          <h5 style={panelTitle}>{t('analyze.defectEditor')}</h5>

          {/* Defect image */}
          <div style={imageContainerStyle}>
            {selectedDefect?.imageUrl ? (
              <img src={selectedDefect.imageUrl} alt="defect" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
            ) : photosLoading ? (
              <div style={{ width: '100%', height: '100%', background: '#2a2a2a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 28, height: 28, border: '3px solid #555', borderTopColor: '#5A8F5A', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#2a2a2a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#888', fontSize: 13 }}>
                  {selectedDefect ? t('defectImage.noImage') : t('analyze.dropAnnotation')}
                </span>
              </div>
            )}
            {selectedDefect && (
              <>
                <span style={overlayBottomLeft}>{selectedDefect.root}m</span>
                <span style={overlayBottomRight}>{selectedDefect.face}</span>
              </>
            )}
          </div>

          {/* Form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Type */}
            <div style={fieldGroup}>
              <label style={labelStyle}>{t('analyze.type')}</label>
              <select style={selectInputStyle} value={defectType} onChange={(e) => setDefectType(e.target.value)}>
                <option value="">{t('analyze.select')}</option>
                <option value="LE EROSION">{t('defect.leErosion')}</option>
                <option value="VORTEX (MISSING PANELS)">{t('defect.vortex')}</option>
                <option value="PAINT DAMAGES">{t('defect.paintDamages')}</option>
                <option value="OTHER ADD-ONS MISSING">{t('defect.addOnsMissing')}</option>
                <option value="BLADES WITH HYDRAULIC OIL">{t('defect.hydraulicOil')}</option>
                <option value="CRACK">{t('defect.crack')}</option>
              </select>
            </div>

            {/* Category + Root distance + Blade face row */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ ...fieldGroup, flex: 0 }}>
                <label style={labelStyle}>{t('analyze.category')}</label>
                <div style={{ display: 'flex', gap: 0 }}>
                  {[1, 2, 3, 4, 5].map((c) => {
                    const isActive = category === c;
                    return (
                      <button key={c} onClick={() => setCategory(c)}
                        style={{
                          ...catBtnStyle,
                          ...(isActive ? catBtnActiveStyle : {}),
                          borderRadius: c === 1 ? '4px 0 0 4px' : c === 5 ? '0 4px 4px 0' : 0,
                        }}>{c}</button>
                    );
                  })}
                </div>
              </div>
              <div style={{ ...fieldGroup, flex: 1 }}>
                <label style={labelStyle}>{t('annotate.rootDistance')}</label>
                <input type="number" step="0.1" min="0" style={textInputStyle} value={rootDistance} onChange={(e) => setRootDistance(e.target.value)} />
              </div>
              <div style={{ ...fieldGroup, flex: 1 }}>
                <label style={labelStyle}>{t('analyze.bladeFace')}</label>
                <select style={selectInputStyle} value={bladeFace} onChange={(e) => setBladeFace(e.target.value)}>
                  <option value="">—</option>
                  <option value="LE">LE</option>
                  <option value="SS">SS</option>
                  <option value="TE">TE</option>
                  <option value="PS">PS</option>
                </select>
              </div>
            </div>

            {/* Note */}
            <div style={fieldGroup}>
              <label style={labelStyle}>{t('analyze.noteLabel')}</label>
              <div style={inputWithClearStyle}>
                <input style={{ ...textInputStyle, paddingRight: 28 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('defects.descriptionPlaceholder')} />
                {note && <button style={clearIconBtn} onClick={() => setNote('')}>&times;</button>}
              </div>
            </div>

            {/* Root cause */}
            <div style={fieldGroup}>
              <label style={labelStyle}>{t('analyze.rootCause')}</label>
              <div style={inputWithClearStyle}>
                <input style={{ ...textInputStyle, paddingRight: 28 }} value={rootCause} onChange={(e) => setRootCause(e.target.value)} placeholder={t('defects.causePlaceholder')} />
                {rootCause && <button style={clearIconBtn} onClick={() => setRootCause('')}>&times;</button>}
              </div>
            </div>

            {/* Next step */}
            <div style={fieldGroup}>
              <label style={labelStyle}>{t('analyze.nextStep')}</label>
              <div style={inputWithClearStyle}>
                <input style={{ ...textInputStyle, paddingRight: 28 }} value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder={t('defects.actionPlaceholder')} />
                {nextStep && <button style={clearIconBtn} onClick={() => setNextStep('')}>&times;</button>}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={clearBtnStyle} onClick={handleClear}>{t('analyze.clear')}</button>
              <button
                style={{ ...saveBtnStyle, opacity: selectedDefectId && role !== 'supervisor' ? 1 : 0.5, cursor: selectedDefectId && role !== 'supervisor' ? 'pointer' : 'not-allowed' }}
                onClick={handleSaveDefect}
                disabled={!selectedDefectId || saveStatus === 'saving' || role === 'supervisor'}
              >
                {saveStatus === 'saving' ? t('analyze.saving') : saveStatus === 'saved' ? t('analyze.saved') : t('analyze.saveAsDefect')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Arrow separator */}
      <div style={arrowStyle}>&#x203A;</div>

      {/* ═══ RIGHT PANEL: Summary and Reviews ═══ */}
      <div style={panelStyle}>
        <div style={panelInner}>
          <h5 style={panelTitle}>{t('analyze.summaryTitle')}</h5>

          {/* Blade accordions — show only CONFIRMED defects */}
          {(['A', 'B', 'C'] as const).map((blade) => {
            const bladeDefects = confirmedDefects.filter(d => d.blade === blade);
            const isExpanded = expandedBlades.has(blade);
            return (
              <div key={blade} style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
                <button onClick={() => toggleBladeExpand(blade)} style={bladeAccordionBtn}>
                  <span>{t('turbineDetail.filterBlade')} {blade}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{confirmedBladeCounts[blade]}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={C.muted}
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div style={{ paddingBottom: 8 }}>
                    {bladeDefects.length === 0 ? (
                      <p style={{ fontSize: 12, color: C.muted, margin: '4px 0', paddingLeft: 4 }}>{t('analyze.noConfirmed')}</p>
                    ) : (
                      <table style={summaryTableStyle}>
                        <thead>
                          <tr>
                            <th style={summaryThStyle}>#</th>
                            <th style={summaryThStyle}>{t('analyze.type')}</th>
                            <th style={summaryThStyle}>{t('results.face')}</th>
                            <th style={summaryThStyle}>{t('analyze.category')}</th>
                            <th style={summaryThStyle}>{t('results.rootM')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bladeDefects.map((d) => (
                            <tr key={d.id}
                              onClick={() => handleDefectSelect(d)}
                              style={{
                                cursor: 'pointer',
                                backgroundColor: selectedDefectId === d.annotationId ? C.selected : undefined,
                              }}>
                              <td style={summaryTdStyle}>{d.id}</td>
                              <td style={summaryTdStyle}>{d.type}</td>
                              <td style={summaryTdStyle}>{d.face}</td>
                              <td style={summaryTdStyle}>{d.cat}</td>
                              <td style={summaryTdStyle}>{d.root}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {/* Blade notes */}
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        style={{ ...textInputStyle, fontSize: 12, minHeight: 48, resize: 'vertical' }}
                        placeholder={t('analyze.bladeNotes').replace('{blade}', blade)}
                        value={bladeNotes[blade]}
                        onChange={(e) => setBladeNotes(prev => ({ ...prev, [blade]: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* SubAsset section */}
          <div style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
            <div style={bladeAccordionBtn}>
              <span>{t('subassets.title')}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{confirmedDefects.length}</span>
            </div>
            <div style={{ padding: '4px 0 8px' }}>
              <textarea
                style={{ ...textInputStyle, fontSize: 12, minHeight: 48, resize: 'vertical' }}
                placeholder={t('analyze.subassetNotes')}
              />
            </div>
          </div>

          {/* Mark as analyzed button — deletes selected annotation */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              style={{
                ...saveBtnStyle,
                padding: '10px 24px',
                fontSize: 13,
                opacity: selectedDefectId && role !== 'supervisor' && !markingAnalyzed ? 1 : 0.5,
                cursor: selectedDefectId && role !== 'supervisor' && !markingAnalyzed ? 'pointer' : 'not-allowed',
              }}
              onClick={handleMarkAsAnalyzed}
              disabled={!selectedDefectId || role === 'supervisor' || markingAnalyzed}
            >
              {markingAnalyzed ? 'REMOVING...' : 'MARK AS ANALYZED'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BladeTab sub-component ──────────────────────────────────────────────────
function BladeTab({ blade, count, selected, onClick }: { blade: string; count: number; selected: boolean; onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onClick} style={{
        padding: '6px 14px',
        borderRadius: 4,
        border: `1px solid ${selected ? C.primary : C.border}`,
        background: selected ? C.primary : C.bg,
        color: selected ? '#fff' : C.text,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}>
        {t('turbineDetail.filterBlade')} {blade}
      </button>
      <span style={{
        position: 'absolute', top: -6, right: -6,
        background: '#FF4081', color: '#fff',
        fontSize: 10, fontWeight: 700,
        width: 18, height: 18,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{count}</span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  height: '100%',
  overflow: 'hidden',
  background: 'var(--color-neutral-100)',
  alignItems: 'stretch',
};

const panelStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: C.bg,
  borderRadius: 8,
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  margin: '8px 4px',
  overflow: 'hidden',
};

const panelInner: React.CSSProperties = {
  padding: 16,
  overflowY: 'auto',
  flex: 1,
};

const panelTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: C.text,
  margin: '0 0 12px',
};

const arrowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  color: C.muted,
  padding: '0 2px',
  userSelect: 'none',
};

const previewAreaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 140,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: C.bgLight,
};

const previewAreaActiveStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 140,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: C.bg,
};

const previewHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '10px 12px',
  borderBottom: `1px solid ${C.border}`,
  background: C.bg,
};

const previewImageContainerStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 120,
  background: '#222',
  overflow: 'hidden',
};

const openBtnContainerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
};

const openBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: 'rgba(255,255,255,0.92)',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  color: C.primary,
};

const imageContainerStyle: React.CSSProperties = {
  position: 'relative',
  height: 160,
  marginBottom: 16,
  borderRadius: 6,
  overflow: 'hidden',
  background: '#1a1a1a',
};

const overlayBottomLeft: React.CSSProperties = {
  position: 'absolute',
  bottom: 6,
  left: 6,
  background: 'rgba(0,0,0,0.65)',
  color: '#fff',
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 3,
};

const overlayBottomRight: React.CSSProperties = {
  position: 'absolute',
  bottom: 6,
  right: 6,
  background: 'rgba(0,0,0,0.65)',
  color: '#fff',
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 3,
};

const fieldGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: C.muted,
};

const textInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 13,
  color: C.text,
  outline: 'none',
  boxSizing: 'border-box',
  background: C.bg,
};

const selectInputStyle: React.CSSProperties = {
  ...textInputStyle,
  cursor: 'pointer',
};

const inputWithClearStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const clearIconBtn: React.CSSProperties = {
  position: 'absolute',
  right: 6,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  color: C.muted,
  padding: 2,
  lineHeight: 1,
};

const catBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  border: `1.5px solid ${C.border}`,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  background: C.bg,
  color: C.text,
  outline: 'none',
};

const catBtnActiveStyle: React.CSSProperties = {
  background: C.primary,
  color: '#fff',
  border: `1.5px solid ${C.primary}`,
};

const clearBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#E0E0E0',
  color: C.text,
  border: 'none',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: 0.3,
};

const saveBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: C.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: 0.3,
};

const bladeAccordionBtn: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 4px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  color: C.text,
};

const summaryTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 11,
};

const summaryThStyle: React.CSSProperties = {
  padding: '5px 4px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 10,
  color: C.muted,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
};

const summaryTdStyle: React.CSSProperties = {
  padding: '5px 4px',
  borderBottom: `1px solid #F0F1F3`,
  fontSize: 11,
  color: C.text,
  whiteSpace: 'nowrap',
};
