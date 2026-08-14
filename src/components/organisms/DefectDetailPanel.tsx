import { useState } from 'react';
import { useLanguage } from '@/components/design-system';
import type { DefectDashboardRow } from '@/types';

export interface DefectDetailPanelProps {
  defect: DefectDashboardRow;
  onResolvedToggle?: (id: string, resolved: boolean) => void;
}

function getCategoryBadgeStyle(category: number): React.CSSProperties {
  let bgColor = '#F2994A';
  if (category >= 5) bgColor = '#DC2626';
  else if (category >= 4) bgColor = '#E06300';
  else if (category === 2) bgColor = '#6B7280';
  else if (category <= 1) bgColor = '#22C55E';

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

export function DefectDetailPanel({ defect, onResolvedToggle }: DefectDetailPanelProps) {
  const { t } = useLanguage();
  const [comment, setComment] = useState('');

  const handleToggle = () => {
    onResolvedToggle?.(defect.id, !defect.resolved);
  };

  // Map rootDistance to blade position (percentage from top, blade is vertical ~80m)
  const maxDistance = 80;
  const topPct = Math.min(Math.max((defect.rootDistance / maxDistance) * 100, 5), 95);

  return (
    <div style={panelStyle}>
      {/* Header: Type + icons */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-family-sans)', color: 'rgb(2, 136, 209)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {defect.type}
          </h3>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0288D1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', flexShrink: 0 }}>
          <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />
        </svg>
      </div>

      {/* Content row: info (left flex:1) + blade diagram (right 100px) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {/* Left: info */}
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          {/* Category / Status / Size / Side table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'var(--font-family-sans)' }}>
            <tbody>
              <tr>
                <td style={labelCellStyle}>Category:</td>
                <td style={valueCellStyle}><span style={getCategoryBadgeStyle(defect.category)}>{defect.category}</span></td>
                <td style={{ ...labelCellStyle, textAlign: 'right' }}>Status:</td>
                <td style={valueCellStyle}>
                  <button
                    type="button"
                    aria-label={t('defects.markResolved')}
                    aria-pressed={defect.resolved}
                    onClick={handleToggle}
                    style={{
                      position: 'relative', width: '40px', height: '22px', borderRadius: '11px',
                      backgroundColor: defect.resolved ? 'rgb(76, 175, 80)' : 'rgb(189, 189, 189)',
                      cursor: 'pointer', transition: 'background-color 0.2s',
                      border: 'none', padding: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: '2px', left: defect.resolved ? '20px' : '2px',
                      width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'var(--color-neutral-0)',
                      transition: 'left 0.2s', boxShadow: '0px 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                </td>
              </tr>
              <tr>
                <td style={{ ...labelCellStyle, paddingRight: '1rem' }}>Defect size:</td>
                <td style={valueCellStyle}>{defect.defectWidth} x {defect.defectHeight}</td>
                <td style={{ ...labelCellStyle, textAlign: 'right' }}>Blade Side:</td>
                <td style={valueCellStyle}>{defect.side}</td>
              </tr>
            </tbody>
          </table>

          {/* Separator */}
          <hr style={{ borderWidth: '1px 0 0 0', borderStyle: 'solid', borderColor: 'rgb(224, 224, 224)', margin: '8px 0' }} />

          {/* Root Cause / Next Step */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'var(--font-family-sans)' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700, fontSize: '13px', color: 'rgb(66, 66, 66)', padding: '3px 0', whiteSpace: 'nowrap', verticalAlign: 'top', width: '90px' }}>Root Cause:</td>
                <td style={{ fontSize: '13px', color: 'rgb(33, 33, 33)', padding: '3px 0 3px 8px', verticalAlign: 'top' }}>{defect.rootCause ?? '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700, fontSize: '13px', color: 'rgb(66, 66, 66)', padding: '3px 0', whiteSpace: 'nowrap', verticalAlign: 'top', width: '90px' }}>Next Step:</td>
                <td style={{ fontSize: '13px', color: 'rgb(33, 33, 33)', padding: '3px 0 3px 8px', verticalAlign: 'top' }}>{defect.nextStep || '—'}</td>
              </tr>
            </tbody>
          </table>

          {/* Comments */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-family-sans)', color: 'var(--color-neutral-800)' }}>
                Comments (0)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', border: '1px solid var(--color-neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
                <input
                  placeholder={t('comments.new')}
                  aria-label={t('comments.new')}
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  style={{ flex: '1 1 0%', border: 'none', outline: 'none', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-family-sans)', color: 'var(--color-neutral-700)', backgroundColor: 'transparent' }}
                />
                <button type="button" disabled={!comment.trim()} aria-label="Send comment" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: comment.trim() ? 'pointer' : 'default', color: comment.trim() ? 'var(--color-primary-500)' : 'var(--color-neutral-300)', padding: 0 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: blade diagram */}
        <div style={{ width: '100px', flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'relative', height: '240px', display: 'flex', justifyContent: 'center' }}>
            <img alt="blade" src="/blade.svg" style={{ height: '100%', width: 'auto', objectFit: 'contain' }} />
            <div style={{
              position: 'absolute', top: `${topPct}%`, right: '15%',
              width: '12px', height: '12px', borderRadius: '50%',
              backgroundColor: 'rgb(255, 112, 67)', border: '2px solid rgb(230, 74, 25)',
              boxShadow: '0px 0px 4px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      </div>

      {/* Image section */}
      <div style={{ position: 'relative', maxWidth: '90%' }}>
        {/* Maximize icon */}
        <div style={{ marginBottom: '4px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0288D1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}>
            <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" x2="14" y1="3" y2="10" /><line x1="3" x2="10" y1="21" y2="14" />
          </svg>
        </div>
        {/* Image */}
        <div style={{ position: 'relative', width: '100%', height: '250px', overflow: 'hidden', borderRadius: '4px', backgroundColor: 'rgb(245, 245, 245)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {defect.imageUrl ? (
            <img src={defect.imageUrl} alt="Defect photograph" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'rgb(158, 158, 158)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-family-sans)' }}>No image available</span>
          </div>
          )}
        </div>
        {/* Compare / Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <button type="button" style={{ padding: '6px 16px', backgroundColor: 'transparent', color: '#5A8F5A', border: '1px solid #5A8F5A', borderRadius: '4px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-family-sans)', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.025em' }}>
            Compare
          </button>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #5A8F5A', borderRadius: '4px', overflow: 'hidden' }}>
            <button type="button" aria-label="Zoom out" style={{ padding: '4px 10px', backgroundColor: 'transparent', color: '#5A8F5A', borderWidth: '0 1px 0 0', borderStyle: 'none solid none none', borderColor: '#5A8F5A', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-family-sans)' }}>-</button>
            <span style={{ padding: '4px 10px', backgroundColor: 'transparent', color: '#5A8F5A', borderWidth: '0 1px 0 0', borderStyle: 'none solid none none', borderColor: '#5A8F5A', fontSize: '11px', fontWeight: 600, cursor: 'default', fontFamily: 'var(--font-family-sans)', textTransform: 'lowercase' }}>x1.00</span>
            <button type="button" aria-label="Zoom in" style={{ padding: '4px 10px', backgroundColor: 'transparent', color: '#5A8F5A', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-family-sans)' }}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Styles ---

const panelStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: '16px',
  boxSizing: 'border-box',
  backgroundColor: 'rgb(255, 255, 255)',
  borderLeft: '1px solid rgb(224, 224, 224)',
  fontFamily: 'var(--font-family-sans)',
  boxShadow: 'rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px',
};

const labelCellStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '13px',
  color: 'rgb(66, 66, 66)',
  padding: '4px 0',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};

const valueCellStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'rgb(33, 33, 33)',
  padding: '4px 8px',
  verticalAlign: 'middle',
};
