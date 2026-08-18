import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useDefectHistory } from '@/hooks/useDefectHistory';
import { supabase } from '@/lib/supabase';
import type { HistoricalDefect } from '@/hooks/useDefectHistory';

export interface DefectCompareViewerProps {
  onClose: () => void;
  currentImage: string;
  currentDate: string;
  defectType: string;
  defectSeverity: number;
  distanceFromRoot: number;
  side: string;
  blade: string;
  bladeId: string;
  inspectionId: string;
  annotX?: number;
  annotY?: number;
  annotW?: number;
  annotH?: number;
  annotAngle?: number;
}

interface BladePhoto {
  id: string;
  face: string;
  storagePath: string;
  radialPosition: number;
}

const FACE_DB_TO_SHORT: Record<string, string> = {
  leading_edge: 'LE', trailing_edge: 'TE', pressure_side: 'PS', suction_side: 'SS',
};

export function DefectCompareViewer({
  onClose,
  currentImage,
  currentDate,
  defectType,
  defectSeverity,
  distanceFromRoot,
  side,
  blade,
  bladeId,
  inspectionId,
  annotX,
  annotY,
  annotW,
  annotH,
  annotAngle,
}: DefectCompareViewerProps) {
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>('');
  const { t } = useLanguage();
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [compareMore, setCompareMore] = useState(false);
  const [activeSide, setActiveSide] = useState(side || 'LE');
  const [activeImage, setActiveImage] = useState(currentImage);
  const [activeDistance, setActiveDistance] = useState(distanceFromRoot);
  const [bladePhotos, setBladePhotos] = useState<BladePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedAnnot, setLoadedAnnot] = useState<{ x: number; y: number; w: number; h: number; angle: number } | null>(null);

  // Load blade photos for navigation
  useEffect(() => {
    if (!bladeId) return;
    (async () => {
      const db = supabase as any;

      // Find all photos for this blade (regardless of campaign)
      const { data: photos } = await db
        .from('inspection_photo')
        .select('id, face, storage_path, radial_position')
        .eq('blade_id', bladeId)
        .order('radial_position', { ascending: true });

      if (photos && photos.length > 0) {
        setBladePhotos(photos.map((p: any) => ({
          id: p.id,
          face: FACE_DB_TO_SHORT[p.face] || p.face,
          storagePath: p.storage_path,
          radialPosition: Number(p.radial_position),
        })));
      }
    })();
  }, [bladeId]);

  // Load the defect's annotation (coords + photo) from step 2 ANNOTATE
  useEffect(() => {
    if (!inspectionId) return;
    (async () => {
      const db = supabase as any;
      // Find defects for this inspection
      const { data: defectRows } = await db
        .from('defect')
        .select('description')
        .eq('inspection_id', inspectionId)
        .not('description', 'is', null)
        .limit(20);

      if (!defectRows || defectRows.length === 0) return;

      const annotIds = defectRows.map((d: any) => d.description).filter(Boolean);
      if (annotIds.length === 0) return;

      const { data: annotations } = await db
        .from('annotation')
        .select('id, thumbnail_id, x, y, w, h, angle')
        .in('id', annotIds);

      if (!annotations || annotations.length === 0) return;

      // Use the first annotation (or match by type if possible)
      const ann = annotations[0];
      setLoadedAnnot({ x: Number(ann.x), y: Number(ann.y), w: Number(ann.w), h: Number(ann.h), angle: Number(ann.angle || 0) });

      // If we don't have an image yet, load it from the annotation's photo
      if (!currentImage) {
        const { data: photos } = await db
          .from('inspection_photo')
          .select('storage_path')
          .eq('id', ann.thumbnail_id)
          .limit(1);

        if (photos && photos.length > 0) {
          const { data: signedData } = await (supabase as any).storage
            .from('inspection-imports')
            .createSignedUrl(photos[0].storage_path, 3600);

          if (signedData?.signedUrl) {
            setActiveImage(signedData.signedUrl);
          }
        }
      }
    })();
  }, [inspectionId, currentImage]);

  const getSignedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const { data } = await (supabase as any).storage
      .from('inspection-imports')
      .createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  }, []);

  const navigateToFace = useCallback(async (targetFace: string) => {
    const facePics = bladePhotos.filter((p) => p.face === targetFace);
    if (facePics.length === 0) return;

    // Find closest to current radial distance
    const closest = facePics.reduce((best, p) =>
      Math.abs(p.radialPosition - activeDistance) < Math.abs(best.radialPosition - activeDistance) ? p : best
    );

    setLoading(true);
    const url = await getSignedUrl(closest.storagePath);
    setLoading(false);

    if (url) {
      setActiveImage(url);
      setActiveSide(targetFace);
      setActiveDistance(closest.radialPosition);
    }
  }, [bladePhotos, activeDistance, getSignedUrl]);

  const navigateHub = useCallback(async (direction: 'closer' | 'farther') => {
    const facePics = bladePhotos
      .filter((p) => p.face === activeSide)
      .sort((a, b) => a.radialPosition - b.radialPosition);

    if (facePics.length === 0) return;

    const currentIdx = facePics.findIndex((p) =>
      Math.abs(p.radialPosition - activeDistance) < 1
    );

    let nextIdx: number;
    if (direction === 'closer') {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : 0;
    } else {
      nextIdx = currentIdx < facePics.length - 1 ? currentIdx + 1 : facePics.length - 1;
    }

    const target = facePics[nextIdx];
    if (!target) return;

    setLoading(true);
    const url = await getSignedUrl(target.storagePath);
    setLoading(false);

    if (url) {
      setActiveImage(url);
      setActiveDistance(target.radialPosition);
    }
  }, [bladePhotos, activeSide, activeDistance, getSignedUrl]);

  const { data } = useDefectHistory(bladeId, distanceFromRoot, inspectionId);
  const inspections = data?.inspections ?? [];
  const defects = data?.defects ?? [];

  const selectedDefect: HistoricalDefect | undefined = defects.find(
    (d) => d.inspectionId === selectedInspectionId
  );

  const handleZoomIn = useCallback(() => setZoomLevel((p) => Math.min(p + 0.25, 4.0)), []);
  const handleZoomOut = useCallback(() => setZoomLevel((p) => Math.max(p - 0.25, 0.5)), []);

  const hasAnnotation = (annotX != null && annotY != null && annotW != null && annotH != null) || loadedAnnot != null;

  const effectiveAnnot = (annotX != null && annotY != null) ? { x: annotX, y: annotY, w: annotW!, h: annotH!, angle: annotAngle || 0 } : loadedAnnot;

  const formattedDate = currentDate ? new Date(currentDate).toLocaleString() : 'N/A';

  return (
    <div style={overlayStyle}>
      <button type="button" style={closeBtnStyle} onClick={onClose} aria-label="Close">
        <X size={24} />
      </button>

      <div style={gridStyle}>
        {/* LEFT panel */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span style={{ color: '#5A8F5A' }}>{formattedDate}</span>
            <span style={{ textAlign: 'center', fontWeight: 700 }}>Selected</span>
            <span style={{ textAlign: 'right' }}>Cat {defectSeverity}</span>
          </div>
          <div style={imageContainerStyle}>
            {activeImage ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={activeImage} alt="Defect" style={{ ...imageStyle, transform: `scale(${zoomLevel})`, maxWidth: '100%', maxHeight: 'calc(100vh - 120px)' }} crossOrigin="anonymous" />
                {/* Annotation overlay - same logic as AnnotateStep */}
                {hasAnnotation && effectiveAnnot && (() => {
                  const ann = effectiveAnnot;
                  const rad = (ann.angle || 0) * (Math.PI / 180);
                  const halfW = ann.w / 2;
                  const halfH = ann.h / 2;
                  const startX = ann.x - halfW * Math.cos(rad);
                  const startY = ann.y - halfW * Math.sin(rad);
                  const endX = ann.x + halfW * Math.cos(rad);
                  const endY = ann.y + halfW * Math.sin(rad);
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
                  return (
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
                      <line x1={`${p1x}%`} y1={`${p1y}%`} x2={`${p2x}%`} y2={`${p2y}%`} stroke="#FF0000" strokeWidth="2.5" />
                      <line x1={`${p2x}%`} y1={`${p2y}%`} x2={`${p3x}%`} y2={`${p3y}%`} stroke="#FF0000" strokeWidth="2.5" />
                      <line x1={`${p3x}%`} y1={`${p3y}%`} x2={`${p4x}%`} y2={`${p4y}%`} stroke="#FF0000" strokeWidth="2.5" />
                      <line x1={`${p4x}%`} y1={`${p4y}%`} x2={`${p1x}%`} y2={`${p1y}%`} stroke="#FF0000" strokeWidth="2.5" />
                    </svg>
                  );
                })()}
                {loading && <div style={loadingOverlay}>Loading...</div>}
              </div>
            ) : (
              <span style={emptyText}>No image</span>
            )}

            {/* Info top-left */}
            <div style={infoBlockStyle}>
              <div>Blade : {blade}</div>
              <div>Side : {activeSide}</div>
              <div>Hub : {activeDistance.toFixed(1)}m</div>
            </div>

            {/* Navigation arrows - cross layout, bottom-left */}
            <div style={navContainerStyle}>
              {/* SS label + up arrow */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={navLabelStyle}>SS</span>
                <button type="button" style={navBtnStyle} onClick={() => navigateToFace('SS')}>
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="#5A8F5A"><path d="M8 0.5l-7.5 7.5h4.5v8h6v-8h4.5z" /></svg>
                </button>
              </div>
              {/* Middle row: ← and → Hub */}
              <div style={navMiddleRow}>
                <button type="button" style={navBtnStyle} onClick={() => navigateHub('farther')}>
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="#5A8F5A"><path d="M0.5 8l7.5 7.5v-4.5h8v-6h-8v-4.5z" /></svg>
                </button>
                <button type="button" style={navBtnStyle} onClick={() => navigateHub('closer')}>
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="#5A8F5A"><path d="M15.5 8l-7.5-7.5v4.5h-8v6h8v4.5z" /></svg>
                </button>
                <span style={navLabelStyle}>Hub</span>
              </div>
              {/* Down arrow + PS label */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button type="button" style={navBtnStyle} onClick={() => navigateToFace('PS')}>
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="#5A8F5A"><path d="M8 15.5l7.5-7.5h-4.5v-8h-6v8h-4.5z" /></svg>
                </button>
                <span style={navLabelStyle}>PS</span>
              </div>
            </div>

            {/* Zoom - bottom-right */}
            <div style={zoomGroupStyle}>
              <button type="button" style={zoomBtnStyle} onClick={handleZoomOut}>-</button>
              <span style={zoomLabelStyle}>x{zoomLevel.toFixed(2)}</span>
              <button type="button" style={zoomBtnLastStyle} onClick={handleZoomIn}>+</button>
            </div>
          </div>
        </div>

        {/* RIGHT panel */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <select style={selectStyle} value={selectedInspectionId} onChange={(e) => setSelectedInspectionId(e.target.value)}>
              <option value="">{t('compare.selectInspection')}</option>
              {inspections.map((insp) => (
                <option key={insp.id} value={insp.id}>{insp.label}</option>
              ))}
            </select>
            <span style={{ textAlign: 'center', fontWeight: 700 }}>Compare 1</span>
            <span style={{ textAlign: 'right' }}>{selectedDefect ? `Cat ${selectedDefect.severity}` : ''}</span>
          </div>
          <div style={imageContainerStyle}>
            {selectedDefect ? (
              <img src={selectedDefect.imageUrl} alt="Historical" style={{ ...imageStyle, transform: `scale(${zoomLevel})` }} crossOrigin="anonymous" />
            ) : (
              <span style={emptyText}>
                {inspections.length === 0 ? t('compare.noHistorical') : t('compare.selectInspection')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={bottomBarStyle}>
        <span style={{ fontSize: '12px', textTransform: 'uppercase' }}>{defectType.replace(/_/g, ' ')}</span>
        <div style={toggleContainerStyle}>
          <span>{t('compare.compareMore')}</span>
          <button type="button" style={{ ...toggleTrackBase, backgroundColor: compareMore ? '#5A8F5A' : '#555' }} onClick={() => setCompareMore((p) => !p)}>
            <span style={{ ...toggleKnobBase, left: compareMore ? '18px' : '2px' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 2000, background: '#1a1a1a', display: 'flex', flexDirection: 'column' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, gap: '2px', minHeight: 0 };
const panelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const panelHeaderStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 12px', background: '#2C2C2C', color: 'white', fontSize: '12px', fontFamily: 'var(--font-family-sans)', alignItems: 'center' };
const imageContainerStyle: React.CSSProperties = { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', background: '#111' };
const imageStyle: React.CSSProperties = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transformOrigin: 'center', transition: 'transform 0.2s ease' };
const emptyText: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: '13px' };
const closeBtnStyle: React.CSSProperties = { position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '24px', zIndex: 10 };
const bottomBarStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '10px 16px', background: '#2C2C2C', color: 'white', fontSize: '12px', fontFamily: 'var(--font-family-sans)' };
const selectStyle: React.CSSProperties = { background: '#2C2C2C', color: 'white', border: '1px solid #5A8F5A', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontFamily: 'var(--font-family-sans)', cursor: 'pointer' };
const toggleContainerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
const toggleTrackBase: React.CSSProperties = { position: 'relative', width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer', border: 'none', padding: 0 };
const toggleKnobBase: React.CSSProperties = { position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' };
const zoomGroupStyle: React.CSSProperties = { position: 'absolute', bottom: '12px', right: '12px', display: 'flex', border: '1px solid #5A8F5A', borderRadius: '4px', overflow: 'hidden' };
const zoomBtnStyle: React.CSSProperties = { padding: '4px 10px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRight: '1px solid #5A8F5A', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const zoomBtnLastStyle: React.CSSProperties = { ...zoomBtnStyle, borderRight: 'none' };
const zoomLabelStyle: React.CSSProperties = { ...zoomBtnStyle, cursor: 'default', fontSize: '11px', textTransform: 'lowercase' };
const infoBlockStyle: React.CSSProperties = { position: 'absolute', top: '12px', left: '12px', color: '#5A8F5A', fontSize: '13px', fontFamily: 'var(--font-family-sans)', lineHeight: '1.8', textShadow: '0 1px 3px rgba(0,0,0,0.8)' };
const navContainerStyle: React.CSSProperties = { position: 'absolute', bottom: '16px', left: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' };
const navMiddleRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '24px' };
const navBtnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' };
const navLabelStyle: React.CSSProperties = { color: '#5A8F5A', fontSize: '10px', fontWeight: 700 };
const loadingOverlay: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '14px' };
