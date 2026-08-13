import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileText, ExternalLink } from 'lucide-react';
import type { CampaignTurbineResult } from '@/types';

const CAT_COLORS: Record<number, string> = {
  5: '#E53E3E',
  4: '#FF5500',
  3: '#FFA500',
  2: '#006A4E',
  1: '#68D391',
};

interface SeverityBadgeProps {
  cat: number;
  count: number;
  small?: boolean;
}

function SeverityBadge({ cat, count, small }: SeverityBadgeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <span
        style={{
          fontWeight: 700,
          fontSize: small ? '0.75rem' : '0.875rem',
          color: 'var(--color-neutral-900)',
        }}
      >
        {count}
      </span>
      <div
        style={{
          width: small ? '28px' : '36px',
          height: '4px',
          backgroundColor: CAT_COLORS[cat],
          borderRadius: '2px',
        }}
      />
      <span style={{ fontSize: '0.65rem', color: 'var(--color-neutral-500)' }}>Cat {cat}</span>
    </div>
  );
}

function SeverityRow({ defectsByCat, small }: { defectsByCat: Record<number, number>; small?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: small ? '8px' : '12px', alignItems: 'center' }}>
      {[5, 4, 3, 2, 1].map((cat) => (
        <SeverityBadge key={cat} cat={cat} count={defectsByCat[cat] ?? 0} small={small} />
      ))}
    </div>
  );
}

export interface TurbineResultAccordionProps {
  result: CampaignTurbineResult;
  isSelected?: boolean;
  onCheckboxToggle?: (turbineId: string) => void;
  onOpenInspection?: (turbineId: string) => void;
  onDownloadPdf?: (turbineId: string) => void;
  onDownloadCsv?: (turbineId: string) => void;
}

export function TurbineResultAccordion({
  result,
  isSelected,
  onCheckboxToggle,
  onOpenInspection,
  onDownloadPdf,
  onDownloadCsv,
}: TurbineResultAccordionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={accordionContainer}>
      {/* Header */}
      <button style={headerBtn} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="checkbox"
            checked={isSelected ?? false}
            onChange={() => onCheckboxToggle?.(result.turbineId)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '16px', height: '16px' }}
          />
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-neutral-900)' }}>{result.turbineName}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <SeverityRow defectsByCat={result.defectsByCat} small />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>
            <strong>{result.resolvedCount} / {result.totalDefects}</strong> resolved
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <IconBtn title="Download PDF" onClick={() => onDownloadPdf?.(result.turbineId)}>
              <Download size={14} />
            </IconBtn>
            <IconBtn title="Download XLSX" onClick={() => onDownloadCsv?.(result.turbineId)}>
              <FileText size={14} />
            </IconBtn>
            <IconBtn title="Open inspection" onClick={() => onOpenInspection?.(result.turbineId)}>
              <ExternalLink size={14} />
            </IconBtn>
          </div>
        </div>
      </button>

      {/* Expanded blade details */}
      {expanded && (
        <div style={bladeSection}>
          {result.blades.map((blade) => (
            <div key={blade.position} style={bladeRow}>
              <span style={{ fontWeight: 600, fontSize: '0.75rem', minWidth: '60px', color: 'var(--color-neutral-700)' }}>
                BLADE {blade.position}
              </span>
              <SeverityRow defectsByCat={blade.defectsByCat} small />
              <span style={{ fontSize: '0.7rem', color: 'var(--color-neutral-500)', marginLeft: 'auto' }}>
                <strong>{blade.resolvedCount} / {blade.totalDefects}</strong> resolved
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={iconBtnStyle}
    >
      {children}
    </button>
  );
}

const accordionContainer: React.CSSProperties = {
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--color-neutral-0)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-xs)',
};

const headerBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '10px 12px',
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  gap: '12px',
  color: 'var(--color-neutral-900)',
};

const bladeSection: React.CSSProperties = {
  borderTop: '1px solid var(--color-neutral-200)',
  padding: '8px 12px 12px 44px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const bladeRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '4px 0',
};

const iconBtnStyle: React.CSSProperties = {
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: '4px',
  color: 'var(--color-neutral-600)',
  display: 'flex',
  alignItems: 'center',
};
