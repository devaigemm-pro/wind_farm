import { ImageIcon } from 'lucide-react';

export interface DefectImageViewerProps {
  imageUrl: string | null;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCompare: () => void;
}

export function DefectImageViewer({
  imageUrl,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onCompare,
}: DefectImageViewerProps) {
  function handleWheel(e: React.WheelEvent) {
    // Don't call preventDefault to avoid passive event listener violation
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
    backgroundColor: '#F5F5F5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${zoomLevel})`,
    transformOrigin: 'center',
    transition: 'transform 0.2s ease',
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
    color: '#1976D2',
    border: '1px solid #1976D2',
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
    border: '1px solid #1976D2',
    borderRadius: '4px',
    overflow: 'hidden',
  };

  const zoomBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: '#1976D2',
    border: 'none',
    borderRight: '1px solid #1976D2',
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
          <img src={imageUrl} alt="Defect photograph" style={imageStyle} crossOrigin="anonymous" />
        ) : (
          <div style={placeholderStyle}>
            <ImageIcon size={32} />
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-family-sans)' }}>
              No image available
            </span>
          </div>
        )}
      </div>

      {/* Bottom bar: Compare left, Zoom right */}
      <div style={bottomBarStyle}>
        <button type="button" style={compareBtnStyle} onClick={onCompare}>
          Compare
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
