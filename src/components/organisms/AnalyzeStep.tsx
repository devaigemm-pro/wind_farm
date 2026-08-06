import { useState, useMemo, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';
import { useAnnotations, useUpdateAnnotation, useCampaignInspectionIds, useMultiAnnotations } from '@/hooks/useAnnotations';
import { useQueryClient } from '@tanstack/react-query';
import { useInspectionPhotos, getFaceShort, getPhotoPublicUrl } from '@/hooks/useInspectionPhotos';
import { BLADE_POSITION_LABELS } from '@/types';
import type { Inspection } from '@/types';

export interface AnalyzeStepProps {
  inspectionId: string;
  inspection?: Inspection;
  campaignId?: string | null;
}

// ─── Local defect interface for this component ───────────────────────────────
interface Defect {
  id: string;
  annotationId: string;
  type: string;
  cat: number;
  blade: string;
  face: string;
  root: number;
  size: string;
  note: string;
  rootCause: string;
  nextStep: string;
  imageUrl?: string;
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#4CAF50',
  primaryDark: '#388E3C',
  text: '#333B46',
  muted: '#8A9099',
  border: '#E0E0E0',
  bg: '#FFFFFF',
  bgLight: '#F5F7FA',
  selected: 'rgba(76, 175, 80, 0.10)',
  selectedBorder: '#4CAF50',
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

export function AnalyzeStep({ inspectionId, inspection, campaignId: propCampaignId }: AnalyzeStepProps) {
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
  const { data: photos = [] } = useInspectionPhotos(campaignId, null);

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
    // If it's in our photo lookup (UUID-based), use that
    if (photoLookup[thumbnailId]) return photoLookup[thumbnailId];
    // Legacy fallback for old t1-t18 style IDs
    return deriveBladeFaceLegacy(thumbnailId);
  }

  // Map DB annotations to Defect[] format, assigning sequential IDs per blade
  const defectsFromDb = useMemo<Defect[]>(() => {
    if (!dbAnnotations || dbAnnotations.length === 0) return [];
    const counters: Record<string, number> = {};
    return dbAnnotations.map((a) => {
      const derived = deriveBladeFace(a.thumbnailId);
      const blade = derived.blade;
      const face = a.side || derived.face; // Use saved side if available, else derive from photo
      counters[blade] = (counters[blade] || 0) + 1;
      const id = `${blade}${counters[blade]}`;
      return {
        id,
        annotationId: a.id,
        type: a.type,
        cat: a.category,
        blade,
        face,
        root: Math.round(a.y * 0.43 * 10) / 10,
        size: `${Math.round(a.w)} x ${Math.round(a.h)} cm`,
        note: a.note,
        rootCause: a.rootCause || '',
        nextStep: a.nextStep || '',
        imageUrl: photoLookup[a.thumbnailId]?.storagePath
          ? getPhotoPublicUrl(photoLookup[a.thumbnailId]!.storagePath)
          : undefined,
      };
    });
  }, [dbAnnotations, photoLookup]);

  // Always use DB data — no fallback to mocks
  const defects = defectsFromDb;

  const [selectedBlade, setSelectedBlade] = useState<string>('A');
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);
  const [expandedBlades, setExpandedBlades] = useState<Set<string>>(new Set(['A', 'B', 'C']));
  const [bladeNotes, setBladeNotes] = useState<Record<string, string>>({ A: '', B: '', C: '' });
  const [zoom, setZoom] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [contrast, setContrast] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [saturation, setSaturation] = useState(1);

  // Defect editor state — empty until a defect is selected
  const [defectType, setDefectType] = useState('');
  const [category, setCategory] = useState(0);
  const [rootDistance, setRootDistance] = useState('');
  const [bladeFace, setBladeFace] = useState('');
  const [note, setNote] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [nextStep, setNextStep] = useState('');

  const bladeCounts = useMemo(() => ({
    A: defects.filter(d => d.blade === 'A').length,
    B: defects.filter(d => d.blade === 'B').length,
    C: defects.filter(d => d.blade === 'C').length,
  }), [defects]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-select first defect when defects load
  useEffect(() => {
    if (defects.length > 0 && !selectedDefectId) {
      const first = defects[0]!;
      setSelectedDefectId(first.annotationId);
      setSelectedBlade(first.blade);
      setDefectType(first.type);
      setCategory(first.cat);
      setRootDistance(String(first.root));
      setBladeFace(first.face);
      setNote(first.note);
      setRootCause(first.rootCause);
      setNextStep(first.nextStep);
    }
  }, [defects]);

  // Loading state
  if (annotationsLoading) {
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

  // Empty state: no annotations in DB and no inspection data
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

  const selectedDefect = defects.find(d => d.annotationId === selectedDefectId) || null;

  const handleDefectSelect = (defect: Defect) => {
    setSelectedDefectId(defect.annotationId);
    setDefectType(defect.type);
    setCategory(defect.cat);
    setRootDistance(String(defect.root));
    setBladeFace(defect.face);
    setNote(defect.note);
    setRootCause(defect.rootCause);
    setNextStep(defect.nextStep);
    setZoom(1.0);
  };

  const handleClear = () => {
    setDefectType('');
    setCategory(0);
    setRootDistance('');
    setBladeFace('');
    setNote('');
    setRootCause('');
    setNextStep('');
    setSelectedDefectId(null);
  };

  const handleSaveDefect = async () => {
    if (!selectedDefectId) return;
    setSaveStatus('saving');
    try {
      const rootDistNum = parseFloat(rootDistance) || 0;
      const yFromRoot = rootDistNum / 0.43; // Convert root distance (m) back to y percentage
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
      // Force refetch to ensure UI updates
      const keysToInvalidate = campaignInspIds.length > 0 ? campaignInspIds : [inspectionId];
      await queryClient.invalidateQueries({ queryKey: ['annotations-multi', ...keysToInvalidate] });
      await queryClient.invalidateQueries({ queryKey: ['annotations', inspectionId] });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  const toggleBladeExpand = (blade: string) => {
    setExpandedBlades(prev => {
      const next = new Set(prev);
      if (next.has(blade)) next.delete(blade);
      else next.add(blade);
      return next;
    });
  };

  return (
    <div style={containerStyle}>
      {/* ═══ LEFT PANEL: Annotations ═══ */}
      <div style={panelStyle}>
        <div style={panelInner}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={panelTitle}>Annotations</h5>
          </div>
          {/* Blade tabs with badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['A', 'B', 'C'] as const).map((b) => (
              <BladeTab
                key={b}
                blade={b}
                count={bladeCounts[b]}
                selected={selectedBlade === b}
                onClick={() => { setSelectedBlade(b); setExpandedBlades(new Set([b])); setSelectedDefectId(null); setZoom(1.0); }}
              />
            ))}
          </div>
          {/* Annotations content */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: C.text, margin: 0 }}>All annotations have been processed</p>
          </div>

          {/* Preview area */}
          {selectedDefect ? (
            <div style={previewAreaActiveStyle}>
              {/* Header with defect info */}
              <div style={previewHeaderStyle}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{selectedDefect.type}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Category: {selectedDefect.cat}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{selectedDefect.blade} - {selectedDefect.face} - {selectedDefect.root}m</div>
                  <div style={{ fontSize: 13, color: C.muted }}>{selectedDefect.size}</div>
                </div>
              </div>
              {/* Image */}
              <div style={previewImageContainerStyle}>
                {selectedDefect.imageUrl ? (
                  <img src={selectedDefect.imageUrl} alt="defect preview" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`, transition: 'transform 0.2s ease', filter: `contrast(${contrast}) brightness(${brightness}) saturate(${saturation})` }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#888', fontSize: 12 }}>No image available</span>
                  </div>
                )}
                {/* Contrast/Brightness toggle button */}
                <button
                  onClick={() => setShowSettings(s => !s)}
                  style={contrastToggleBtnStyle}
                  title="Image settings"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={C.primary}><circle cx="12" cy="12" r="10" fill="none" stroke={C.primary} strokeWidth="2"/><path d="M12 2a10 10 0 0 1 0 20V2z" fill={C.primary}/></svg>
                </button>
                {/* Settings panel */}
                {showSettings && (
                  <div style={settingsPanelStyle}>
                    <button onClick={() => setShowSettings(false)} style={settingsCloseBtn}>&times;</button>
                    <div style={sliderRowStyle}>
                      <span style={sliderLabelStyle}>Contrast</span>
                      <input type="range" min="0" max="2" step="0.1" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} style={sliderStyle} aria-label="Contrast" />
                    </div>
                    <div style={sliderRowStyle}>
                      <span style={sliderLabelStyle}>Brightness</span>
                      <input type="range" min="0" max="2" step="0.1" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} style={sliderStyle} aria-label="Brightness" />
                    </div>
                    <div style={sliderRowStyle}>
                      <span style={sliderLabelStyle}>Saturation</span>
                      <input type="range" min="0" max="10" step="0.5" value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} style={sliderStyle} aria-label="Saturation" />
                    </div>
                    <button onClick={() => { setContrast(1); setBrightness(1); setSaturation(1); }} style={resetBtnStyle}>RESET</button>
                  </div>
                )}
                {/* Zoom controls */}
                <div style={zoomControlsStyle}>
                  <button style={zoomBtnStyle} onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}>-</button>
                  <span style={{ fontSize: 12, color: C.text, padding: '0 8px' }}>x{zoom.toFixed(2)}</span>
                  <button style={zoomBtnStyle} onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}>+</button>
                </div>
                {/* Open button */}
                <div style={openBtnContainerStyle}>
                  <button style={openBtnStyle}>OPEN</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={previewAreaStyle}>
              <p style={{ fontSize: 13, color: C.muted, margin: 0, textAlign: 'center' }}>
                Select an annotation or a defect to view it here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Arrow separator */}
      <div style={arrowStyle}>&#x203A;</div>

      {/* ═══ CENTER PANEL: Defect Editor ═══ */}
      <div style={panelStyle}>
        <div style={panelInner}>
          <h5 style={panelTitle}>Defect Editor</h5>

          {/* Defect image */}
          <div style={imageContainerStyle}>
            {selectedDefect?.imageUrl ? (
              <img src={selectedDefect.imageUrl} alt="defect" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#2a2a2a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#888', fontSize: 13 }}>No image</span>
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
              <label style={labelStyle}>Type</label>
              <select style={selectInputStyle} value={defectType} onChange={(e) => setDefectType(e.target.value)}>
                <option value="LE EROSION">LE EROSION</option>
                <option value="VORTEX (MISSING PANELS)">VORTEX (MISSING PANELS)</option>
                <option value="PAINT DAMAGES">PAINT DAMAGES</option>
                <option value="OTHER ADD-ONS MISSING">OTHER ADD-ONS MISSING</option>
                <option value="BLADES WITH HYDRAULIC OIL">BLADES WITH HYDRAULIC OIL</option>
                <option value="CRACK">CRACK</option>
              </select>
            </div>

            {/* Category + Root distance + Blade face row */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ ...fieldGroup, flex: 0 }}>
                <label style={labelStyle}>Category</label>
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
                <label style={labelStyle}>Root distance (m)</label>
                <input type="number" step="0.1" min="0" style={textInputStyle} value={rootDistance} onChange={(e) => setRootDistance(e.target.value)} />
              </div>
              <div style={{ ...fieldGroup, flex: 1 }}>
                <label style={labelStyle}>Blade face</label>
                <select style={selectInputStyle} value={bladeFace} onChange={(e) => setBladeFace(e.target.value)}>
                  <option value="LE">LE</option>
                  <option value="SS">SS</option>
                  <option value="TE">TE</option>
                  <option value="PS">PS</option>
                </select>
              </div>
            </div>

            {/* AI Suggestions accordion */}
            <details style={accordionStyle}>
              <summary style={accordionSummary}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={C.primary}><path d="M7.5 5.6 10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 0 0-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41z"/></svg>
                  Automatic category suggestions
                </span>
              </summary>
              <div style={{ padding: '8px 12px', fontSize: 12, color: C.text, lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 8px' }}>
                  A <b>LE EROSION</b> annotation placed on the <b>LE</b> at <b>{rootDistance ? `${(43 - Number(rootDistance)).toFixed(2)} m from the tip` : '—'}</b> is usually categorized between <b>3 and 5</b>.
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '4px 0' }}>Down to laminate, protection damaged</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>3</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '4px 0' }}>Through first layer of laminate</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>4</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0' }}>Through laminate</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>5</td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
                  CORE Insight cannot be liable for this category suggestion, set it according to your experience.
                </p>
              </div>
            </details>

            {/* Note */}
            <div style={fieldGroup}>
              <label style={labelStyle}>Note</label>
              <div style={inputWithClearStyle}>
                <input style={{ ...textInputStyle, paddingRight: 28 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visual description of the defect" />
                {note && <button style={clearIconBtn} onClick={() => setNote('')}>&times;</button>}
              </div>
            </div>

            {/* Root cause */}
            <div style={fieldGroup}>
              <label style={labelStyle}>Root cause</label>
              <div style={inputWithClearStyle}>
                <input style={{ ...textInputStyle, paddingRight: 28 }} value={rootCause} onChange={(e) => setRootCause(e.target.value)} placeholder="Probable cause of the defect" />
                {rootCause && <button style={clearIconBtn} onClick={() => setRootCause('')}>&times;</button>}
              </div>
            </div>

            {/* Next step */}
            <div style={fieldGroup}>
              <label style={labelStyle}>Next step</label>
              <div style={inputWithClearStyle}>
                <input style={{ ...textInputStyle, paddingRight: 28 }} value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Recommended action and urgency" />
                {nextStep && <button style={clearIconBtn} onClick={() => setNextStep('')}>&times;</button>}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={clearBtnStyle} onClick={handleClear}>CLEAR</button>
              <button
                style={{ ...saveBtnStyle, opacity: selectedDefectId ? 1 : 0.5, cursor: selectedDefectId ? 'pointer' : 'not-allowed' }}
                onClick={handleSaveDefect}
                disabled={!selectedDefectId || saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? 'SAVING...' : saveStatus === 'saved' ? '✓ SAVED' : 'SAVE AS DEFECT'}
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
          <h5 style={panelTitle}>Summary and Reviews</h5>

          {/* Blade accordions */}
          {(['A', 'B', 'C'] as const).map((blade) => {
            const bladeDefects = defects.filter(d => d.blade === blade);
            const isExpanded = expandedBlades.has(blade);
            return (
              <div key={blade} style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
                <button onClick={() => toggleBladeExpand(blade)} style={bladeAccordionBtn}>
                  <span>Blade {blade} </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{bladeDefects.length}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={C.muted}
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div style={{ paddingBottom: 8 }}>
                    <table style={summaryTableStyle}>
                      <thead>
                        <tr>
                          <th style={summaryThStyle}>#</th>
                          <th style={summaryThStyle}>Type</th>
                          <th style={summaryThStyle}>Face</th>
                          <th style={summaryThStyle}>Category</th>
                          <th style={summaryThStyle}>Root (m)</th>
                          <th style={summaryThStyle}>Copy</th>
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
                            <td style={summaryTdStyle}>
                              <button style={copyIconBtn} title="Copy">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={C.primary}><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12zm-1 4 6 6v10c0 1.1-.9 2-2 2H7.99C6.89 23 6 22.1 6 21l.01-14c0-1.1.89-2 1.99-2zm-1 7h5.5L14 6.5z"/></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Blade notes */}
                    <div style={{ marginTop: 8 }}>
                      <input
                        style={{ ...textInputStyle, fontSize: 12 }}
                        placeholder={`Blade ${blade} notes`}
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
              <span>SubAsset </span>
              <span>{defects.length}</span>
            </div>
            <div style={{ padding: '4px 0 8px' }}>
              <input
                style={{ ...textInputStyle, fontSize: 12 }}
                placeholder="SubAsset notes"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BladeTab sub-component ──────────────────────────────────────────────────
function BladeTab({ blade, count, selected, onClick }: { blade: string; count: number; selected: boolean; onClick: () => void }) {
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
        Blade {blade}
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
  background: '#F5F5F5',
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
  minHeight: 180,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: C.bgLight,
};

const previewAreaActiveStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 180,
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
  minHeight: 160,
  background: '#222',
  overflow: 'hidden',
};

const zoomControlsStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  right: 10,
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(255,255,255,0.92)',
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  padding: '2px 4px',
};

const zoomBtnStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  border: `1px solid ${C.border}`,
  background: C.bg,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  borderRadius: 3,
  color: C.text,
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

const accordionStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  overflow: 'hidden',
};

const accordionSummary: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  color: C.text,
  listStyle: 'none',
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

const copyIconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 2,
  display: 'flex',
  alignItems: 'center',
};

const contrastToggleBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 36,
  height: 36,
  borderRadius: 6,
  border: `1.5px solid ${C.primary}`,
  background: 'rgba(255,255,255,0.92)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 5,
};

const settingsPanelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 220,
  background: 'rgba(255,255,255,0.95)',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
  padding: '28px 16px 12px',
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const settingsCloseBtn: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  background: 'none',
  border: 'none',
  fontSize: 18,
  color: C.primary,
  cursor: 'pointer',
  fontWeight: 700,
};

const sliderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const sliderLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: C.text,
  minWidth: 70,
};

const sliderStyle: React.CSSProperties = {
  flex: 1,
  accentColor: C.primary,
  cursor: 'pointer',
};

const resetBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  background: '#E0E0E0',
  color: C.text,
  border: 'none',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  alignSelf: 'center',
  marginTop: 4,
};
