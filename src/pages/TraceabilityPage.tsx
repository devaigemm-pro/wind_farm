import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wind, Cpu } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from 'recharts';
import { Badge } from '@/components/atoms';
import type { BadgeVariant } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import { useTraceability } from '@/hooks/useQuotes';
import type { WorkOrderStatus } from '@/types';

const C = {
  brand: '#5A8F5A',
  text: '#535353',
  muted: '#8A9099',
  border: '#E5E7EB',
};

const WO_BADGE: Record<WorkOrderStatus, BadgeVariant> = {
  open: 'warning',
  in_progress: 'info',
  done: 'success',
  cancelled: 'neutral',
};

function money(amount: number, currency: string): string {
  return `${(Number(amount) || 0).toLocaleString('es-CL')} ${currency}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CL');
  } catch {
    return iso;
  }
}

export function TraceabilityPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data, isLoading } = useTraceability({});

  const currency = data?.currency ?? 'CLP';

  // Cumulative cost over time (based on work order creation date).
  const timeline = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.rows].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    let acc = 0;
    const byDate = new Map<string, number>();
    for (const row of sorted) {
      acc += row.cost;
      byDate.set(formatDate(row.createdAt), acc);
    }
    return Array.from(byDate.entries()).map(([date, total]) => ({ date, total }));
  }, [data]);

  return (
    <div style={page}>
      <div style={{ marginBottom: 20 }}>
        <button style={backBtn} onClick={() => navigate('/quotes')}>
          <ArrowLeft size={16} /> {t('quotes.title')}
        </button>
        <h1 style={title}>{t('traceability.title')}</h1>
        <p style={subtitle}>{t('traceability.subtitle')}</p>
      </div>

      {isLoading ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('traceability.loading')}</p>
      ) : !data || data.rows.length === 0 ? (
        <div style={emptyCard}>
          <Wind size={40} color="#ccc" />
          <p style={{ color: C.muted, margin: 0 }}>{t('traceability.empty')}</p>
        </div>
      ) : (
        <>
          {/* Cost summaries */}
          <div style={summaryGrid}>
            <div style={card}>
              <h3 style={cardTitle}>
                <Wind size={16} color={C.brand} /> {t('traceability.byWindFarm')}
              </h3>
              {data.byWindFarm.map((wf) => (
                <div key={wf.windFarmId || wf.windFarmName} style={summaryRow}>
                  <span style={{ color: C.text }}>{wf.windFarmName || '—'}</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    {wf.count} {t('traceability.orders')}
                  </span>
                  <strong style={{ color: C.brand }}>{money(wf.total, currency)}</strong>
                </div>
              ))}
            </div>
            <div style={card}>
              <h3 style={cardTitle}>
                <Cpu size={16} color={C.brand} /> {t('traceability.byTurbine')}
              </h3>
              {data.byTurbine.map((tb) => (
                <div key={tb.turbineId || tb.turbineName} style={summaryRow}>
                  <span style={{ color: C.text }}>{tb.turbineName || '—'}</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    {tb.count} {t('traceability.orders')}
                  </span>
                  <strong style={{ color: C.brand }}>{money(tb.total, currency)}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Cumulative cost timeline */}
          <div style={{ ...card, marginBottom: 20 }}>
            <h3 style={cardTitle}>{t('traceability.timeline')}</h3>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis tick={{ fontSize: 11, fill: C.muted }} />
                  <RTooltip formatter={(v: number) => money(v, currency)} />
                  <Bar dataKey="total" fill={C.brand} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed rows */}
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>{t('traceability.colDate')}</th>
                  <th style={th}>{t('traceability.colWindFarm')}</th>
                  <th style={th}>{t('traceability.colTurbine')}</th>
                  <th style={th}>{t('traceability.colBladeSide')}</th>
                  <th style={th}>{t('traceability.colDefect')}</th>
                  <th style={{ ...th, textAlign: 'center' }}>{t('traceability.colStatus')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('traceability.colCost')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.key} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={td}>{formatDate(row.createdAt)}</td>
                    <td style={td}>{row.windFarmName || '—'}</td>
                    <td style={td}>{row.turbineName || '—'}</td>
                    <td style={td}>{row.bladeSide || '—'}</td>
                    <td style={td}>{row.defectType || '—'}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <Badge variant={WO_BADGE[row.status]}>{t(`workOrder.status.${row.status}`)}</Badge>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{money(row.cost, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { padding: 24, fontFamily: 'var(--font-family-sans)' };
const backBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'none',
  border: 'none',
  color: C.muted,
  fontSize: 13,
  cursor: 'pointer',
  padding: 0,
  marginBottom: 8,
};
const title: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: C.text, margin: 0 };
const subtitle: React.CSSProperties = { fontSize: 14, color: C.muted, margin: '4px 0 0' };
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
const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
  marginBottom: 20,
};
const card: React.CSSProperties = {
  background: 'var(--color-neutral-0)',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  padding: 16,
};
const cardTitle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 14,
  fontWeight: 700,
  color: C.text,
  margin: '0 0 12px',
};
const summaryRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto',
  gap: 12,
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: `1px solid ${C.border}`,
  fontSize: 13.5,
};
const tableWrap: React.CSSProperties = {
  background: 'var(--color-neutral-0)',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  overflow: 'hidden',
};
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  color: C.muted,
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  borderBottom: `1px solid ${C.border}`,
  background: '#FAFBFC',
};
const td: React.CSSProperties = { padding: '10px 14px', color: C.text };
