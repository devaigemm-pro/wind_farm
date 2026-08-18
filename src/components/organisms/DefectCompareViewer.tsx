import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useDefectHistory } from '@/hooks/useDefectHistory';
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

  const { data } = useDefectHistory(bladeId, distanceFromRoot, inspectionId);
  const inspections = data?.inspections ?? [];
  const defects = data?.defects ?? [];

  const selectedDefect: HistoricalDefect | undefined = defects.find(
    (d) => d.inspectionId === selectedInspectionId
  );

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 4.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const hasAnnotation = annotX != null && annotY != null && annotW != null && annotH != null;

  const annotationStyle: React.CSSProperties = hasAnnotation ? {
    position: 'absolute',
    left: `${annotX}%`,
    top: `${annotY}%`,
    width: `${annotW}%`,
    height: `${annotH}%`,
    border: '2px solid #FF0000',
    boxShadow: '0 0 6px rgba(255,0,0,0.5)',
    pointerEvents: 'none',
    transform: annotAngle ? `rotate(${annotAngle}deg)` : undefined,
    transformOrigin: 'top left',
  } : {};

  const severityLabel = `Cat ${defectSeverity}`;
  const formattedDate = currentDate
    ? new Date(currentDate).toLocaleString()
    : 'N/A';

  return (
    <div style={overlayStyle}>
      {/* Close button */}
      <button type="button" style={closeBtnStyle} onClick={onClose} aria-label="Close compare view">
        <X size={24} />
      </button>

      {/* Main grid */}
      <div style={gridStyle}>
        {/* LEFT panel - current inspection */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span style={{ color: '#5A8F5A' }}>{formattedDate}</span>
            <span style={{ textAlign: 'center', fontWeight: 700 }}>Selected</span>
            <span style={{ textAlign: 'right' }}>{severityLabel}</span>
          </div>
          <div style={imageContainerStyle}>
            {currentImage ? (
              <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={currentImage}
                  alt="Current defect"
                  style={{ ...imageStyle, transform: `scale(${zoomLevel})` }}
                  crossOrigin="anonymous"
                />
                {/* Annotation overlay */}
                {hasAnnotation && <div style={annotationStyle} />}
              </div>
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>No image</span>
            )}

            {/* Blade info - bottom left */}
            <div style={infoBlockStyle}>
              <div>Blade : {blade}</div>
              <div>Side : {side}</div>
              <div>Hub : {distanceFromRoot}m</div>
            </div>

            {/* Navigation arrows - bottom left below info */}
            <div style={navArrowsStyle}>
              <div style={arrowGroupStyle}>
                <div style={arrowItemStyle}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="#5A8F5A"><path d="M8 0.5l-7.5 7.5h4.5v8h6v-8h4.5z" /></svg>
                  <span style={arrowLabelStyle}>SS</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="#5A8F5A"><path d="M0.5 8l7.5 7.5v-4.5h8v-6h-8v-4.5z" /></svg>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="#5A8F5A"><path d="M15.5 8l-7.5-7.5v4.5h-8v6h8v4.5z" /></svg>
                  <span style={arrowLabelStyle}>Hub</span>
                </div>
                <div style={arrowItemStyle}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="#5A8F5A"><path d="M8 15.5l7.5-7.5h-4.5v-8h-6v8h-4.5z" /></svg>
                  <span style={arrowLabelStyle}>PS</span>
                </div>
              </div>
            </div>

            {/* Zoom controls - bottom right */}
            <div style={zoomGroupStyle}>
              <button type="button" style={zoomBtnStyle} onClick={handleZoomOut} aria-label="Zoom out">-</button>
              <span style={zoomLabelStyle}>x{zoomLevel.toFixed(2)}</span>
              <button type="button" style={zoomBtnLastStyle} onClick={handleZoomIn} aria-label="Zoom in">+</button>
            </div>
          </div>
        </div>

        {/* RIGHT panel - historical comparison */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <select
              style={selectStyle}
              value={selectedInspectionId}
              onChange={(e) => setSelectedInspectionId(e.target.value)}
              aria-label={t('compare.selectInspection')}
            >
              <option value="">{t('compare.selectInspection')}</option>
              {inspections.map((insp) => (
                <option key={insp.id} value={insp.id}>
                  {insp.label}
                </option>
              ))}
            </select>
            <span style={{ textAlign: 'center', fontWeight: 700 }}>Compare 1</span>
            <span style={{ textAlign: 'right' }}>
              {selectedDefect ? `Cat ${selectedDefect.severity}` : ''}
            </span>
          </div>
          <div style={imageContainerStyle}>
            {selectedDefect ? (
              <img
                src={selectedDefect.imageUrl}
                alt="Historical defect"
                style={{ ...imageStyle, transform: `scale(${zoomLevel})` }}
                crossOrigin="anonymous"
              />
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                {inspections.length === 0
                  ? t('compare.noHistorical')
                  : t('compare.selectInspection')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={bottomBarStyle}>
        <span style={{ fontSize: '12px', textTransform: 'uppercase' }}>
          {defectType.replace(/_/g, ' ')}
        </span>
        <div style={toggleContainerStyle}>
          <span>{t('compare.compareMore')}</span>
          <button
            type="button"
            style={{ ...toggleTrackStyle, backgroundColor: compareMore ? '#5A8F5A' : '#555' }}
            onClick={() => setCompareMore((prev) => !prev)}
            aria-label={t('compare.compareMore')}
            aria-pressed={compareMore}
          >
            <span style={{ ...toggleKnobStyle, left: compareMore ? '18px' : '2px' }} />
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
const closeBtnStyle: React.CSSProperties = { position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '24px', zIndex: 10 };
const bottomBarStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '10px 16px', background: '#2C2C2C', color: 'white', fontSize: '12px', fontFamily: 'var(--font-family-sans)' };
const selectStyle: React.CSSProperties = { background: '#2C2C2C', color: 'white', border: '1px solid #5A8F5A', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontFamily: 'var(--font-family-sans)', cursor: 'pointer' };
const toggleContainerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
const toggleTrackStyle: React.CSSProperties = { position: 'relative', width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer', transition: 'background-color 0.2s', border: 'none', padding: 0 };
const toggleKnobStyle: React.CSSProperties = { position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' };
const zoomGroupStyle: React.CSSProperties = { position: 'absolute', bottom: '12px', right: '12px', display: 'flex', gap: 0, border: '1px solid #5A8F5A', borderRadius: '4px', overflow: 'hidden' };
const zoomBtnStyle: React.CSSProperties = { padding: '4px 10px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRight: '1px solid #5A8F5A', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-family-sans)' };
const zoomBtnLastStyle: React.CSSProperties = { ...zoomBtnStyle, borderRight: 'none' };
const zoomLabelStyle: React.CSSProperties = { ...zoomBtnStyle, cursor: 'default', fontSize: '11px', textTransform: 'lowercase' };
const infoBlockStyle: React.CSSProperties = { position: 'absolute', bottom: '80px', left: '12px', color: '#5A8F5A', fontSize: '12px', fontFamily: 'var(--font-family-sans)', lineHeight: '1.6' };
const navArrowsStyle: React.CSSProperties = { position: 'absolute', bottom: '12px', left: '12px' };
const arrowGroupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' };
const arrowItemStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' };
const arrowLabelStyle: React.CSSProperties = { color: '#5A8F5A', fontSize: '10px', fontWeight: 600, fontFamily: 'var(--font-family-sans)' };
