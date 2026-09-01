import { useNavigate } from 'react-router-dom';
import { FileText, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/atoms';
import type { BadgeVariant } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import { useAuth } from '@/hooks/useAuth';
import { useQuotes } from '@/hooks/useQuotes';
import type { Quote, QuoteStatus } from '@/types';

const C = {
  brand: '#5A8F5A',
  text: '#535353',
  muted: '#8A9099',
  border: '#E5E7EB',
};

const STATUS_BADGE: Record<QuoteStatus, BadgeVariant> = {
  requested: 'warning',
  quoted: 'info',
  approved: 'success',
  rejected: 'neutral',
};

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('es-CL')} ${currency}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CL');
  } catch {
    return iso;
  }
}

export function QuotesPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { role } = useAuth();
  const { data: quotes, isLoading } = useQuotes();

  const isTeam = role === 'admin' || role === 'supervisor';

  return (
    <div style={page}>
      <div style={header}>
        <div>
          <h1 style={title}>{t('quotes.title')}</h1>
          <p style={subtitle}>{isTeam ? t('quotes.subtitleTeam') : t('quotes.subtitleClient')}</p>
        </div>
        <button style={traceBtn} onClick={() => navigate('/quotes/traceability')}>
          <TrendingUp size={16} /> {t('quotes.traceabilityLink')}
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('quotes.loading')}</p>
      ) : !quotes || quotes.length === 0 ? (
        <div style={emptyCard}>
          <FileText size={40} color="#ccc" />
          <p style={{ color: C.muted, margin: 0 }}>{t('quotes.empty')}</p>
        </div>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>{t('quotes.colTurbine')}</th>
                <th style={th}>{t('quotes.colWindFarm')}</th>
                {isTeam && <th style={th}>{t('quotes.colRequestedBy')}</th>}
                <th style={{ ...th, textAlign: 'center' }}>{t('quotes.colDefects')}</th>
                <th style={{ ...th, textAlign: 'center' }}>{t('quotes.colStatus')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('quotes.colTotal')}</th>
                <th style={th}>{t('quotes.colDate')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('quotes.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q: Quote) => (
                <tr key={q.id} style={row}>
                  <td style={td}>{q.turbineName || '—'}</td>
                  <td style={td}>{q.windFarmName || '—'}</td>
                  {isTeam && <td style={td}>{q.requestedByName || '—'}</td>}
                  <td style={{ ...td, textAlign: 'center' }}>{q.itemsCount ?? 0}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <Badge variant={STATUS_BADGE[q.status]}>{t(`quote.status.${q.status}`)}</Badge>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {q.status === 'quoted' || q.status === 'approved'
                      ? formatMoney(q.total_amount, q.currency)
                      : '—'}
                  </td>
                  <td style={td}>{formatDate(q.created_at)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button style={actionBtn} onClick={() => navigate(`/quotes/${q.id}`)}>
                      {isTeam && q.status === 'requested'
                        ? t('quotes.quoteNow')
                        : t('quotes.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { padding: 24, fontFamily: 'var(--font-family-sans)' };
const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 20,
  gap: 16,
  flexWrap: 'wrap',
};
const title: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-xl)',
  fontWeight: 700,
  color: '#111827',
  borderLeft: '4px solid #5A8F5A',
  paddingLeft: '12px',
};
const subtitle: React.CSSProperties = { fontSize: 14, color: C.muted, margin: '4px 0 0' };
const traceBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'var(--color-neutral-0)',
  color: C.brand,
  border: `1px solid ${C.brand}`,
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const emptyCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  padding: 48,
  background: 'var(--color-neutral-0)',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
};
const tableWrap: React.CSSProperties = {
  background: 'var(--color-neutral-0)',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  overflow: 'hidden',
};
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 };
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  color: C.muted,
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  borderBottom: `1px solid ${C.border}`,
  background: '#FAFBFC',
};
const row: React.CSSProperties = { borderBottom: `1px solid ${C.border}` };
const td: React.CSSProperties = { padding: '12px 16px', color: C.text };
const actionBtn: React.CSSProperties = {
  padding: '6px 14px',
  background: C.brand,
  color: 'var(--color-neutral-0)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
};
