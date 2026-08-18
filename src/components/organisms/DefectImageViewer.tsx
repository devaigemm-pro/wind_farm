import { ImageIcon } from 'lucide-react';
import { useLanguage } from '@/components/design-system';

export interface DefectImageViewerProps {
  imageUrl: string | null;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCompare: () => void;
  annotX?: number;
  annotY?: number;
  annotW?: number;
  annotH?: number;
  annotAngle?: number;
}

export function DefectImageViewer({
  imageUrl,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onCompare,
  annotX,
  annotY,
  annotW,
  annotH,
  annotAngle,
}: DefectImageViewerProps) {
  const { t } = useLanguage();

  const hasAnnotation = annotX != null && annotY != null && annotW != null && annotH != null;

  function handleWheel(e: React.WheelEvent) {
    if (e.deltaY < 0) {
      onZoomIn();
    } else {
      onZoomOut();
    }
  }

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '250px',
    overflow: 'hidden',
    borderRadius: '4px',
    backgroundColor: 'var(--color-neutral-100)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const placeholderStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    color: '#9E9E9E',
  };

  const bottomBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '8px',
  };

  const compareBtnStyle: React.CSSProperties = {
    padding: '6px 16px',
    backgroundColor: 'transparent',
    color: '#5A8F5A',
    border: '1px solid #5A8F5A',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: 'var(--font-family-sans)',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    letterSpacing: '0.025em',
  };

  const zoomGroupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #5A8F5A',
    borderRadius: '4px',
    overflow: 'hidden',
  };

  const zoomBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: '#5A8F5A',
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
    textTransform: 'lowercase' as const,
  };

  return (
    <div>
      <div style={containerStyle} onWheel={handleWheel}>
        {imageUrl ? (
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '100%' }}>
            <img
              src={imageUrl}
              alt="Defect photograph"
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '250px',
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease',
              }}
              crossOrigin="anonymous"
            />
            {/* Annotation overlay - same SVG logic as DefectCompareViewer */}
            {hasAnnotation && (() => {
              const rad = (annotAngle || 0) * (Math.PI / 180);
              const halfW = annotW! / 2;
              const halfH = annotH! / 2;
              const startX = annotX! - halfW * Math.cos(rad);
              const startY = annotY! - halfW * Math.sin(rad);
              const endX = annotX! + halfW * Math.cos(rad);
              const endY = annotY! + halfW * Math.sin(rad);
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
                <svg
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', transform: `scale(${zoomLevel})`, transformOrigin: 'center' }}
                >
                  <line x1={`${p1x}%`} y1={`${p1y}%`} x2={`${p2x}%`} y2={`${p2y}%`} stroke="#FF0000" strokeWidth="2.5" />
                  <line x1={`${p2x}%`} y1={`${p2y}%`} x2={`${p3x}%`} y2={`${p3y}%`} stroke="#FF0000" strokeWidth="2.5" />
                  <line x1={`${p3x}%`} y1={`${p3y}%`} x2={`${p4x}%`} y2={`${p4y}%`} stroke="#FF0000" strokeWidth="2.5" />
                  <line x1={`${p4x}%`} y1={`${p4y}%`} x2={`${p1x}%`} y2={`${p1y}%`} stroke="#FF0000" strokeWidth="2.5" />
                </svg>
              );
            })()}
          </div>
        ) : (
          <div style={placeholderStyle}>
            <ImageIcon size={32} />
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-family-sans)' }}>
              {t('defectImage.noImage')}
            </span>
          </div>
        )}
      </div>

      {/* Bottom bar: Compare left, Zoom right */}
      <div style={bottomBarStyle}>
        <button type="button" style={compareBtnStyle} onClick={onCompare}>
          {t('defectImage.compare')}
        </button>

        <div style={zoomGroupStyle}>
          <button type="button" style={zoomBtnStyle} onClick={onZoomOut} aria-label="Zoom out">
            -
          </button>
          <span style={zoomLabelStyle}>
            x{zoomLevel.toFixed(2)}
          </span>
          <button type="button" style={zoomBtnLastStyle} onClick={onZoomIn} aria-label="Zoom in">
            +
          </button>
        </div>
      </div>
    </div>
  );
}
