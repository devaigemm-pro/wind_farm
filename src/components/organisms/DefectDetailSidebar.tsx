import { useState, useEffect } from 'react';
import { ExternalLink, Pencil, Maximize2 } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import type { DefectDashboardRow } from '@/types';
import { DefectComments } from '@/components/molecules/DefectComments';
import { DefectImageViewer } from './DefectImageViewer';
import { DefectEditForm } from './DefectEditForm';
import type { DefectEditData } from './DefectEditForm';

export interface DefectDetailSidebarProps {
  defect: DefectDashboardRow | null;
  onResolvedToggle: (id: string, resolved: boolean) => void;
  onDefectUpdate: (id: string, data: { type: string; category: number; rootDistance: number; side: string; notes: string; rootCause: string; nextStep: string }) => void;
  onDefectDelete: (id: string) => void;
  onDefectClose: (id: string) => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCompare: () => void;
}

export function DefectDetailSidebar({
  defect,
  onResolvedToggle,
  onDefectUpdate,
  onDefectDelete,
  onDefectClose,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onCompare,
}: DefectDetailSidebarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { t } = useLanguage();

  // Reset edit mode when selected defect changes
  useEffect(() => {
    setIsEditing(false);
  }, [defect?.id]);

  if (!defect) {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-neutral-400)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-family-sans)' }}>
          {t('defectSidebar.selectDefect')}
        </div>
      </div>
    );
  }

  // Handle update from edit form
  const handleUpdate = (data: DefectEditData) => {
    if (defect) {
      onDefectUpdate(defect.id, data);
    }
    setIsEditing(false);
  };

  const handleRemove = () => {
    if (defect) {
      onDefectDelete(defect.id);
    }
    setIsEditing(false);
  };

  const handleClose = () => {
    if (defect) {
      onDefectClose(defect.id);
    }
    setIsEditing(false);
  };

  // Edit mode: show form
  if (isEditing) {
    return (
      <div style={containerStyle}>
        <DefectEditForm
          defect={defect}
          onClose={handleClose}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
        />

        {/* Image section still visible below the form */}
        <div style={{ padding: '0 16px 16px', position: 'relative' }}>
          <div style={{ marginBottom: '4px' }}>
            <Maximize2 size={18} color="#0288D1" style={{ cursor: 'pointer' }} />
          </div>
          <DefectImageViewer
            imageUrl={defect.imageUrl}
            zoomLevel={zoomLevel}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onCompare={onCompare}
          />
        </div>
      </div>
    );
  }

  function getCategoryBadgeStyle(category: number): React.CSSProperties {
    let bgColor = '#F2994A';
    if (category >= 5) bgColor = '#DC2626';
    else if (category >= 4) bgColor = '#E06300';
    else if (category <= 2) bgColor = '#6B7280';

    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 8px',
      borderRadius: '4px',
      backgroundColor: bgColor,
      color: '#FFFFFF',
      fontSize: '12px',
      fontWeight: 700,
      fontFamily: 'var(--font-family-sans)',
    };
  }

  const toggleStyle: React.CSSProperties = {
    position: 'relative',
    width: '40px',
    height: '22px',
    borderRadius: '11px',
    backgroundColor: defect.resolved ? '#27AE60' : '#BDBDBD',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    border: 'none',
    padding: 0,
  };

  const toggleKnobStyle: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: defect.resolved ? '20px' : '2px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-neutral-0)',
    transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  };

  // Calculate defect chip position on blade
  const bladeLength = 45;
  const relativePos = Math.min(Math.max(defect.rootDistance / bladeLength, 0), 1);
  const chipTopPercent = 5 + relativePos * 85;

  return (
    <div style={containerStyle}>
      {/* Header: title (link) + edit pen */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-family-sans)', color: '#0288D1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {defect.type}
          </h3>
          <ExternalLink size={14} color="#0288D1" style={{ flexShrink: 0 }} />
        </div>
        <Pencil size={20} color="#2196F3" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setIsEditing(true)} />
      </div>

      {/* Main content row: Info left + Blade right */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {/* Left: metadata */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* First table: Category/Status + Defect size/Blade Side */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'var(--font-family-sans)' }}>
            <tbody>
              <tr>
                <td style={firstTableKeyStyle}>{t('defectSidebar.category')}:</td>
                <td style={firstTableValStyle}>
                  <span style={getCategoryBadgeStyle(defect.category)}>{defect.category}</span>
                </td>
                <td style={{ ...firstTableKeyStyle, textAlign: 'right' }}>{t('defectSidebar.status')}:</td>
                <td style={firstTableValStyle}>
                  <button
                    type="button"
                    style={toggleStyle}
                    onClick={() => onResolvedToggle(defect.id, !defect.resolved)}
                    aria-label={defect.resolved ? t('defectSidebar.markUnresolved') : t('defectSidebar.markResolved')}
                    aria-pressed={defect.resolved}
                  >
                    <span style={toggleKnobStyle} />
                  </button>
                </td>
              </tr>
              <tr>
                <td style={{ ...firstTableKeyStyle, paddingRight: '1rem' }}>{t('defectSidebar.defectSize')}:</td>
                <td style={firstTableValStyle}>{defect.defectWidth} x {defect.defectHeight}</td>
                <td style={{ ...firstTableKeyStyle, textAlign: 'right' }}>{t('defectSidebar.bladeSide')}:</td>
                <td style={firstTableValStyle}>{defect.side}</td>
              </tr>
            </tbody>
          </table>

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: '1px solid #E0E0E0', margin: '8px 0' }} />

          {/* Second table: Root Cause, Next Step, Note */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'var(--font-family-sans)' }}>
            <tbody>
              {defect.rootCause && (
                <tr>
                  <td style={secondTableKeyStyle}>{t('defectSidebar.rootCause')}:</td>
                  <td style={secondTableValStyle}>{defect.rootCause}</td>
                </tr>
              )}
              {defect.nextStep && (
                <tr>
                  <td style={secondTableKeyStyle}>{t('defectSidebar.nextStep')}:</td>
                  <td style={secondTableValStyle}>{defect.nextStep}</td>
                </tr>
              )}
              {defect.notes && (
                <tr>
                  <td style={secondTableKeyStyle}>{t('defectSidebar.note')}:</td>
                  <td style={secondTableValStyle}>{defect.notes}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Comments */}
          <div style={{ marginTop: '12px' }}>
            <DefectComments defectId={defect.id} showAll={defect.resolved} />
          </div>
        </div>

        {/* Right: Blade diagram with defect chip */}
        <div style={{ width: '100px', flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'relative', height: '240px', display: 'flex', justifyContent: 'center' }}>
            <img
              alt="blade"
              src="/blade.svg"
              style={{ height: '100%', width: 'auto', objectFit: 'contain' }}
            />
            {/* Defect position chip */}
            <div style={{
              position: 'absolute',
              top: `${chipTopPercent}%`,
              right: '15%',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#FF7043',
              border: '2px solid #E64A19',
              boxShadow: '0 0 4px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      </div>

      {/* Image section with fullscreen icon - aligned left */}
      <div style={{ position: 'relative', maxWidth: '90%' }}>
        {/* Fullscreen icon */}
        <div style={{ marginBottom: '4px' }}>
          <Maximize2 size={18} color="#0288D1" style={{ cursor: 'pointer' }} />
        </div>

        {/* Image Viewer */}
        <DefectImageViewer
          imageUrl={defect.imageUrl}
          zoomLevel={zoomLevel}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onCompare={onCompare}
        />
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '16px',
  boxSizing: 'border-box',
  backgroundColor: 'var(--color-neutral-0)',
  borderLeft: '1px solid #E0E0E0',
  fontFamily: 'var(--font-family-sans)',
  boxShadow: '0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)',
};

const firstTableKeyStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '13px',
  color: '#424242',
  padding: '4px 0',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};

const firstTableValStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#212121',
  padding: '4px 8px',
  verticalAlign: 'middle',
};

const secondTableKeyStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '13px',
  color: '#424242',
  padding: '3px 0',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
  width: '90px',
};

const secondTableValStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#212121',
  padding: '3px 0 3px 8px',
  verticalAlign: 'top',
};
