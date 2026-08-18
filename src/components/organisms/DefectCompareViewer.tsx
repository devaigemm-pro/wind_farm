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

  // ─── Styles ───────────────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    background: '#1a1a1a',
    display: 'flex',
    flexDirection: 'column',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    flex: 1,
    gap: '2px',
    minHeight: 0,
  };

  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const panelHeaderStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '8px 12px',
    background: '#2C2C2C',
    color: 'white',
    fontSize: '12px',
    fontFamily: 'var(--font-family-sans)',
    alignItems: 'center',
  };

  const imageContainerStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    background: '#111',
  };

  const imageStyle: React.CSSProperties = {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    transform: `scale(${zoomLevel})`,
    transformOrigin: 'center',
    transition: 'transform 0.2s ease',
  };

  const annotationBoxStyle: React.CSSProperties = {
    position: 'absolute',
    border: '2px solid #5A8F5A',
    width: '60%',
    height: '40%',
    top: '30%',
    left: '20%',
    pointerEvents: 'none',
  };

  const zoomGroupStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 0,
    border: '1px solid #5A8F5A',
    borderRadius: '4px',
    overflow: 'hidden',
  };

  const zoomBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    background: 'rgba(0,0,0,0.5)',
    color: 'white',
    border: 'none',
    borderRight: '1px solid #5A8F5A',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
  };

  const zoomBtnLastStyle: React.CSSProperties = {
    ...zoomBtnStyle,
    borderRight: 'none',
  };

  const zoomLabelStyle: React.CSSProperties = {
    ...zoomBtnStyle,
    cursor: 'default',
    fontSize: '11px',
  };

  const arrowsStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    display: 'flex',
    gap: '8px',
    color: 'white',
    fontSize: '11px',
    fontFamily: 'var(--font-family-sans)',
  };

  const infoStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '40px',
    right: '12px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '11px',
    fontFamily: 'var(--font-family-sans)',
  };

  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '24px',
    zIndex: 10,
  };

  const bottomBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '10px 16px',
    background: '#2C2C2C',
    color: 'white',
    fontSize: '12px',
    fontFamily: 'var(--font-family-sans)',
  };

  const selectStyle: React.CSSProperties = {
    background: '#2C2C2C',
    color: 'white',
    border: '1px solid #5A8F5A',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    fontFamily: 'var(--font-family-sans)',
    cursor: 'pointer',
  };

  const toggleContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const toggleTrackStyle: React.CSSProperties = {
    position: 'relative',
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    backgroundColor: compareMore ? '#5A8F5A' : '#555',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    border: 'none',
    padding: 0,
  };

  const toggleKnobStyle: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: compareMore ? '18px' : '2px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-neutral-0)',
    transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  };

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
            <span>{formattedDate}</span>
            <span style={{ textAlign: 'center', fontWeight: 700 }}>Selected</span>
            <span style={{ textAlign: 'right' }}>{severityLabel}</span>
          </div>
          <div style={imageContainerStyle}>
            {currentImage ? (
              <>
                <img src={currentImage} alt="Current defect" style={imageStyle} crossOrigin="anonymous" />
                <div style={annotationBoxStyle} />
              </>
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>No image</span>
            )}

            {/* Zoom controls */}
            <div style={zoomGroupStyle}>
              <button type="button" style={zoomBtnStyle} onClick={handleZoomOut} aria-label="Zoom out">
                -
              </button>
              <span style={zoomLabelStyle}>x{zoomLevel.toFixed(2)}</span>
              <button type="button" style={zoomBtnLastStyle} onClick={handleZoomIn} aria-label="Zoom in">
                +
              </button>
            </div>

            {/* Navigation arrows */}
            <div style={arrowsStyle}>
              <span>PS↓</span>
              <span>SS↑</span>
              <span>Hub→</span>
              <span>←</span>
            </div>

            {/* Info overlay */}
            <div style={infoStyle}>
              Blade:{blade} Side:{side} Hub:{distanceFromRoot}m
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
                style={imageStyle}
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
        <span style={{ fontSize: '12px' }}>
          {defectType.replace(/_/g, ' ').toUpperCase()}
        </span>
        <div style={toggleContainerStyle}>
          <span>{t('compare.compareMore')}</span>
          <button
            type="button"
            style={toggleTrackStyle}
            onClick={() => setCompareMore((prev) => !prev)}
            aria-label={t('compare.compareMore')}
            aria-pressed={compareMore}
          >
            <span style={toggleKnobStyle} />
          </button>
        </div>
      </div>
    </div>
  );
}
