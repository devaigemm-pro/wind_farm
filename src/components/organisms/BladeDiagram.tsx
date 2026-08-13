import { Maximize2 } from 'lucide-react';
import { useLanguage } from '@/components/design-system';

export interface BladeDiagramProps {
  side: string;
  rootDistance: number;
  bladeLength?: number;
}

export function BladeDiagram({ side, rootDistance, bladeLength = 45 }: BladeDiagramProps) {
  const { t } = useLanguage();
  // Calculate relative position (0 = root, 1 = tip)
  const relativePos = Math.min(Math.max(rootDistance / bladeLength, 0), 1);

  // The blade image is tall (~2338px) so we position the chip relative to height
  const chipTopPercent = 5 + relativePos * 85; // 5% from top to 90%

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const imageContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '180px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
  };

  const bladeImgStyle: React.CSSProperties = {
    height: '100%',
    width: 'auto',
    objectFit: 'contain',
  };

  const defectChipStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${chipTopPercent}%`,
    left: side === 'SS' || side === 'LE' ? '30%' : '65%',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#FFD700',
    border: '2px solid #B8860B',
    transform: 'translate(-50%, -50%)',
    boxShadow: '0 0 4px rgba(0,0,0,0.3)',
  };

  const expandBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: '3px',
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    color: '#FFFFFF',
  };

  return (
    <div
      style={containerStyle}
      role="img"
      aria-label={t('bladeDiagram.ariaLabel').replace('{distance}', String(rootDistance)).replace('{side}', side)}
    >
      <div style={imageContainerStyle}>
        <img
          alt="blade"
          src="/blade.svg"
          style={bladeImgStyle}
        />
        <div style={defectChipStyle} />
        <button type="button" style={expandBtnStyle} aria-label={t('bladeDiagram.expand')}>
          <Maximize2 size={12} />
        </button>
      </div>
    </div>
  );
}
