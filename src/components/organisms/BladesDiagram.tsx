import { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '@/components/design-system';

interface Defect {
  id: string;
  type: string;
  cat: number;
  blade: string;
  side: string;
  root: number;
}

export interface BladesDiagramProps {
  defects: Defect[];
  bladeSerials: Record<string, string>;
  bladeLength?: number;
  selectedDefectId?: string | null;
  onDefectClick?: (defectId: string) => void;
}

const CAT_COLORS: Record<number, string> = {
  5: '#FF0000',
  4: '#FF5500',
  3: '#F29D00',
  2: '#006C7A',
  1: '#008F98',
};

// CATEGORIES_DATA moved inside component for i18n

/**
 * Wind turbine blade diagram with meter scale, defect dots, zoom, and pan.
 * - Zoom from center using translate3d + scale
 * - Drag to pan when zoomed in
 */
export function BladesDiagram({
  defects,
  bladeSerials,
  bladeLength = 43,
  selectedDefectId,
  onDefectClick,
}: BladesDiagramProps) {
  const { t } = useLanguage();
  const CATEGORIES_DATA = [
    { cat: 1, color: '#008F98', damage: t('bladeCat.cosmetic'), action: t('bladeCat.action1'), nextStep: t('bladeCat.continueOp') },
    { cat: 2, color: '#006C7A', damage: t('bladeCat.wearTear'), action: t('bladeCat.action2'), nextStep: t('bladeCat.continueOp') },
    { cat: 3, color: '#F29D00', damage: t('bladeCat.physicalImpacts'), action: t('bladeCat.action3'), nextStep: t('bladeCat.continueOp') },
    { cat: 4, color: '#FF5500', damage: t('bladeCat.seriousDamage'), action: t('bladeCat.action4'), nextStep: t('bladeCat.continueOp') },
    { cat: 5, color: '#FF0000', damage: t('bladeCat.criticalDamage'), action: t('bladeCat.action5'), nextStep: t('bladeCat.stop') },
  ];
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showCategories, setShowCategories] = useState(false);
  const [stableDefects, setStableDefects] = useState<Defect[]>([]);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Debounce defects to avoid rendering with intermediate/incorrect positions
  useEffect(() => {
    if (defects.length === 0) {
      setStableDefects([]);
      return;
    }
    const timer = setTimeout(() => {
      setStableDefects(defects);
    }, 50);
    return () => clearTimeout(timer);
  }, [defects]);

  const blades = ['A', 'B', 'C'] as const;

  // Generate meter marks dynamically based on bladeLength
  const numSegments = 9;
  const segmentSize = bladeLength / numSegments;
  const PX_PER_SEGMENT = 68.9535;
  const totalH = PX_PER_SEGMENT * numSegments;

  const meterMarks: { label: string; height: number }[] = [];
  for (let i = 0; i <= numSegments; i++) {
    const meters = Math.round(segmentSize * i);
    meterMarks.push({
      label: `${meters} m`,
      height: i < numSegments ? PX_PER_SEGMENT : 0,
    });
  }

  const topPx = (rootM: number) => (rootM / bladeLength) * totalH;

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const newZ = Math.max(z - 0.25, 1);
      if (newZ === 1) setPan({ x: 0, y: 0 }); // reset pan when back to default
      return newZ;
    });
  };

  // Drag/pan handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (zoom <= 1) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [zoom]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Info button - top right */}
      <button
        type="button"
        onClick={() => setShowCategories(true)}
        style={infoBtnStyle}
        title={t('blades.defectCategories')}
        aria-label={t('blades.showCategories')}
      >
        <svg focusable="false" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="#fff">
          <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
        </svg>
      </button>

      {/* Categories modal overlay */}
      {showCategories && (
        <div style={overlayStyle} onClick={() => setShowCategories(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg focusable="false" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="#333">
                  <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
                </svg>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#333' }}>{t('blades.defectCategories')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCategories(false)}
                style={closeBtn}
                aria-label={t('general.close')}
              >
                ✕
              </button>
            </div>
            <table style={catTableStyle}>
              <thead>
                <tr style={catTheadRowStyle}>
                  <th style={{ ...catThStyle, width: 80 }}>{t('bladeCat.colCategory')}</th>
                  <th style={{ ...catThStyle, width: 140 }}>{t('bladeCat.colDamage')}</th>
                  <th style={catThStyle}>{t('bladeCat.colAction')}</th>
                  <th style={{ ...catThStyle, width: 100 }}>{t('bladeCat.colNextStep')}</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES_DATA.map((row) => (
                  <tr key={row.cat} style={{ background: row.color }}>
                    <td style={catTdStyle}><span style={{ fontSize: 22, fontWeight: 700 }}>{row.cat}</span></td>
                    <td style={{ ...catTdStyle, fontWeight: 700 }}>{row.damage}</td>
                    <td style={catTdStyle}>{row.action}</td>
                    <td style={{ ...catTdStyle, fontWeight: 700 }}>{row.nextStep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Header row */}
      <div style={headersRowStyle}>
        {blades.map((blade) => (
          <div key={blade} style={headerCellStyle}>
            <span style={bladeLetterStyle}>{blade}</span>
            <span style={serialStyle}>{bladeSerials[blade]}</span>
          </div>
        ))}
      </div>

      {/* Diagram + Zoom side by side */}
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        {/* Viewport with overflow hidden - pan via translate */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            height: totalH + 32,
            touchAction: 'pan-x pan-y',
            flex: 1,
            minWidth: 0,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
        {/*
          Inner container: translate3d for pan + scale for zoom.
          transformOrigin center so zoom expands equally in all directions.
        */}
        <div
          style={{
            width: '100%',
            height: totalH,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: 'center center',
            willChange: 'transform',
            transition: isDragging.current ? 'none' : 'transform 0.25s ease-out',
            cursor: zoom > 1 ? 'grab' : 'auto',
            display: 'flex',
            position: 'relative',
          }}
        >
          {/* Left: meter scale */}
          <div style={{ width: 30, flexShrink: 0 }}>
            {meterMarks.map((mark, idx) => (
              <div
                key={idx}
                style={{ height: mark.height, position: 'relative' }}
              >
                <span style={scaleLabelStyle}>{mark.label}</span>
              </div>
            ))}
          </div>

          {/* Right: blades area */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            {/* Grid lines */}
            {meterMarks.map((_, idx) => {
              const y = meterMarks.slice(0, idx).reduce((s, m) => s + m.height, 0);
              return (
                <div
                  key={`line-${idx}`}
                  style={{
                    position: 'absolute',
                    top: y,
                    left: 0,
                    right: 0,
                    height: 1,
                    background: '#ddd',
                    zIndex: 1,
                  }}
                />
              );
            })}

            {/* Blade columns */}
            <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', zIndex: 2, justifyContent: 'space-evenly' }}>
              {blades.map((blade) => {
                const bladeDefects = stableDefects.filter((d) => d.blade === blade);
                // Calculate blade wrapper width from known SVG aspect ratio (493.5:2338)
                const bladeWidth = totalH * (493.5 / 2338);
                return (
                  <div key={blade} style={{ position: 'relative', width: bladeWidth, height: '100%', flexShrink: 0 }}>
                    <img
                      src="/blade.svg"
                      alt={`Blade ${blade}`}
                      style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
                    />
                    {bladeDefects.map((d, i) => {
                      const isSS = d.side === 'SS' || d.side === 'TE';
                      const color = CAT_COLORS[d.cat] ?? '#F29D00';
                      const isSelected = d.id === selectedDefectId;
                      return (
                        <div
                          key={d.id}
                          onClick={() => onDefectClick?.(d.id)}
                          style={{
                            position: 'absolute',
                            top: topPx(d.root),
                            left: isSS ? '25%' : '75%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: 10,
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            border: `2px solid ${color}`,
                            background: color,
                            boxShadow: isSelected ? 'rgb(0, 166, 255) 0px 0px 0px 4px' : 'none',
                            opacity: 0.8,
                            zIndex: isSelected ? 4 : 3,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}
                          title={`${d.id}: ${d.type} · ${d.root}m`}
                        >
                          {i + 1}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

        {/* Zoom buttons - positioned to the right of blades */}
        <div style={zoomContainerStyle}>
          <button style={zoomBtnStyle} onClick={handleZoomIn} type="button">+</button>
          <button
            style={{
              ...zoomBtnStyle,
              opacity: zoom <= 1 ? 0.4 : 1,
              cursor: zoom <= 1 ? 'default' : 'pointer',
              borderBottom: 'none',
            }}
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            type="button"
          >-</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */

const headersRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-around',
  marginBottom: 4,
  marginLeft: 30,
};

const headerCellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const bladeLetterStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 16,
  color: '#333',
};

const serialStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#888',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 60,
};

const scaleLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: 'rgb(83, 83, 83)',
  lineHeight: '1',
  whiteSpace: 'nowrap',
};

const zoomContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #999',
  borderRadius: 6,
  overflow: 'hidden',
  background: 'var(--color-neutral-0)',
  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
  alignSelf: 'flex-end',
  marginLeft: 6,
  marginBottom: 16,
  flexShrink: 0,
};

const zoomBtnStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-neutral-0)',
  border: 'none',
  borderBottom: '1px solid #ccc',
  cursor: 'pointer',
  fontSize: 20,
  fontWeight: 700,
  color: '#333',
};

const infoBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: '#5A8F5A',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  zIndex: 10,
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--color-neutral-0)',
  borderRadius: 12,
  padding: 24,
  maxWidth: 640,
  width: '90%',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
};

const closeBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 18,
  color: '#555',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const catTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  borderRadius: 8,
  overflow: 'hidden',
};

const catTheadRowStyle: React.CSSProperties = {
  background: '#9E9E9E',
};

const catThStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  textAlign: 'left',
};

const catTdStyle: React.CSSProperties = {
  padding: '12px',
  color: '#fff',
  fontSize: 13,
};
