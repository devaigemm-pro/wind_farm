import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Check, X, Save } from 'lucide-react';
import { Badge } from '@/components/atoms';
import type { BadgeVariant } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/store/toastStore';
import {
  useQuote,
  useQuoteWorkOrders,
  useSubmitQuoteResponse,
  useApproveQuote,
  useRejectQuote,
} from '@/hooks/useQuotes';
import type { QuoteStatus, QuoteCurrency, QuoteMaterial, WorkOrderStatus } from '@/types';

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

const WO_BADGE: Record<WorkOrderStatus, BadgeVariant> = {
  open: 'warning',
  in_progress: 'info',
  done: 'success',
  cancelled: 'neutral',
};

interface EditableItem {
  id: string;
  labor_hours: number;
  hourly_rate: number;
  materials: QuoteMaterial[];
}

function money(amount: number, currency: string): string {
  return `${(Number(amount) || 0).toLocaleString('es-CL')} ${currency}`;
}

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { role } = useAuth();
  const toast = useToast();

  const { data: quote, isLoading } = useQuote(id);
  const isTeam = role === 'admin' || role === 'supervisor';
  const isClient = role === 'client';
  const isApproved = quote?.status === 'approved';

  const { data: workOrders } = useQuoteWorkOrders(id, isApproved);
  const submitResponse = useSubmitQuoteResponse();
  const approveQuote = useApproveQuote();
  const rejectQuote = useRejectQuote();

  // Editable state for the technical team.
  const [currency, setCurrency] = useState<QuoteCurrency>('CLP');
  const [items, setItems] = useState<EditableItem[]>([]);

  useEffect(() => {
    if (quote) {
      setCurrency(quote.currency);
      setItems(
        (quote.items ?? []).map((it) => ({
          id: it.id,
          labor_hours: it.labor_hours,
          hourly_rate: it.hourly_rate,
          materials: it.materials.map((m) => ({ ...m })),
        })),
      );
    }
  }, [quote]);

  // Team can edit while the quote is 'requested' or 'quoted' (re-quote).
  const canEdit = isTeam && (quote?.status === 'requested' || quote?.status === 'quoted');
  const canRespond = isClient && quote?.status === 'quoted';

  const computed = useMemo(() => {
    let total = 0;
    const perItem: Record<string, { labor: number; materials: number; total: number }> = {};
    for (const item of items) {
      const labor = (Number(item.labor_hours) || 0) * (Number(item.hourly_rate) || 0);
      const materials = item.materials.reduce(
        (sum, m) => sum + (Number(m.quantity) || 0) * (Number(m.unit_cost) || 0),
        0,
      );
      const itemTotal = labor + materials;
      perItem[item.id] = { labor, materials, total: itemTotal };
      total += itemTotal;
    }
    return { perItem, total };
  }, [items]);

  const updateItem = (itemId: string, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
  };

  const addMaterial = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, materials: [...it.materials, { description: '', quantity: 1, unit_cost: 0, subtotal: 0 }] }
          : it,
      ),
    );
  };

  const updateMaterial = (itemId: string, idx: number, patch: Partial<QuoteMaterial>) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              materials: it.materials.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
            }
          : it,
      ),
    );
  };

  const removeMaterial = (itemId: string, idx: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, materials: it.materials.filter((_, i) => i !== idx) } : it,
      ),
    );
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await submitResponse.mutateAsync({
        quoteId: id,
        items: items.map((it) => ({
          id: it.id,
          labor_hours: Number(it.labor_hours) || 0,
          hourly_rate: Number(it.hourly_rate) || 0,
          materials: it.materials,
        })),
        currency,
      });
      toast.success(t('toast.quoteSaved'));
    } catch {
      toast.error(t('toast.quoteSaveFailed'));
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveQuote.mutateAsync(id);
      toast.success(t('toast.quoteApproved'));
    } catch {
      toast.error(t('toast.quoteActionFailed'));
    }
  };

  const handleReject = async () => {
    if (!id) return;
    try {
      await rejectQuote.mutateAsync(id);
      toast.success(t('toast.quoteRejected'));
    } catch {
      toast.error(t('toast.quoteActionFailed'));
    }
  };

  if (isLoading) return <div style={page}><p style={{ color: C.muted }}>{t('quoteDetail.loading')}</p></div>;
  if (!quote) return <div style={page}><p style={{ color: C.muted }}>{t('quoteDetail.notFound')}</p></div>;

  return (
    <div style={page}>
      <div style={{ marginBottom: 20 }}>
        <button style={backBtn} onClick={() => navigate('/quotes')}>
          <ArrowLeft size={16} /> {t('quoteDetail.back')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <h1 style={title}>{quote.turbineName || '—'}</h1>
          <Badge variant={STATUS_BADGE[quote.status]}>{t(`quote.status.${quote.status}`)}</Badge>
        </div>
        <p style={subtitle}>{quote.windFarmName}</p>
      </div>

      {/* Info + currency */}
      <div style={infoCard}>
        <div>
          <span style={infoLabel}>{t('quoteDetail.status')}</span>
          <div style={infoValue}>{t(`quote.status.${quote.status}`)}</div>
        </div>
        <div>
          <span style={infoLabel}>{t('quoteDetail.currency')}</span>
          {canEdit ? (
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as QuoteCurrency)}
              style={select}
            >
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
            </select>
          ) : (
            <div style={infoValue}>{quote.currency}</div>
          )}
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <span style={infoLabel}>{t('quoteDetail.total')}</span>
          <div style={{ ...infoValue, fontSize: 20, color: C.brand, fontWeight: 700 }}>
            {money(canEdit ? computed.total : quote.total_amount, currency)}
          </div>
        </div>
      </div>

      {/* Items */}
      <h2 style={sectionTitle}>{t('quoteDetail.items')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(quote.items ?? []).map((it) => {
          const editable = items.find((e) => e.id === it.id);
          const calc = computed.perItem[it.id];
          const d = it.defect;
          return (
            <div key={it.id} style={itemCard}>
              <div style={itemHead}>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
                    {d?.typeLabel ?? '—'}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {t('quoteDetail.category')} {d?.severity ?? '—'} · {t('newQuote.blade')}{' '}
                    {d?.bladePosition || '—'} · {t('newQuote.side')} {d?.side || '—'}
                    {d?.widthCm != null ? ` · ${d.widthCm} × ${d.heightCm ?? '—'} cm` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={infoLabel}>{t('quoteDetail.itemTotal')}</span>
                  <div style={{ fontWeight: 700, color: C.text }}>
                    {money(canEdit && calc ? calc.total : it.item_total, currency)}
                  </div>
                </div>
              </div>

              {/* Labor */}
              <div style={laborRow}>
                <label style={fieldLabel}>
                  {t('quoteDetail.laborHours')}
                  {canEdit ? (
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={editable?.labor_hours ?? 0}
                      onChange={(e) => updateItem(it.id, { labor_hours: Number(e.target.value) })}
                      style={input}
                    />
                  ) : (
                    <div style={readValue}>{it.labor_hours}</div>
                  )}
                </label>
                <label style={fieldLabel}>
                  {t('quoteDetail.hourlyRate')}
                  {canEdit ? (
                    <input
                      type="number"
                      min={0}
                      step="1000"
                      value={editable?.hourly_rate ?? 0}
                      onChange={(e) => updateItem(it.id, { hourly_rate: Number(e.target.value) })}
                      style={input}
                    />
                  ) : (
                    <div style={readValue}>{money(it.hourly_rate, currency)}</div>
                  )}
                </label>
                <label style={fieldLabel}>
                  {t('quoteDetail.laborSubtotal')}
                  <div style={readValue}>
                    {money(canEdit && calc ? calc.labor : it.labor_subtotal, currency)}
                  </div>
                </label>
              </div>

              {/* Materials */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={fieldLabelInline}>{t('quoteDetail.materials')}</span>
                  {canEdit && (
                    <button style={miniBtn} onClick={() => addMaterial(it.id)}>
                      <Plus size={13} /> {t('quoteDetail.addMaterial')}
                    </button>
                  )}
                </div>
                {(canEdit ? editable?.materials ?? [] : it.materials).length === 0 ? (
                  <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>—</p>
                ) : (
                  <table style={matTable}>
                    <thead>
                      <tr>
                        <th style={matTh}>{t('quoteDetail.materialDescription')}</th>
                        <th style={{ ...matTh, width: 90, textAlign: 'right' }}>{t('quoteDetail.quantity')}</th>
                        <th style={{ ...matTh, width: 120, textAlign: 'right' }}>{t('quoteDetail.unitCost')}</th>
                        <th style={{ ...matTh, width: 120, textAlign: 'right' }}>{t('quoteDetail.subtotal')}</th>
                        {canEdit && <th style={{ ...matTh, width: 36 }} />}
                      </tr>
                    </thead>
                    <tbody>
                      {(canEdit ? editable?.materials ?? [] : it.materials).map((m, idx) => {
                        const sub = (Number(m.quantity) || 0) * (Number(m.unit_cost) || 0);
                        return (
                          <tr key={idx}>
                            <td style={matTd}>
                              {canEdit ? (
                                <input
                                  value={m.description}
                                  onChange={(e) => updateMaterial(it.id, idx, { description: e.target.value })}
                                  style={{ ...input, width: '100%' }}
                                />
                              ) : (
                                m.description || '—'
                              )}
                            </td>
                            <td style={{ ...matTd, textAlign: 'right' }}>
                              {canEdit ? (
                                <input
                                  type="number"
                                  min={0}
                                  value={m.quantity}
                                  onChange={(e) => updateMaterial(it.id, idx, { quantity: Number(e.target.value) })}
                                  style={{ ...input, width: 70, textAlign: 'right' }}
                                />
                              ) : (
                                m.quantity
                              )}
                            </td>
                            <td style={{ ...matTd, textAlign: 'right' }}>
                              {canEdit ? (
                                <input
                                  type="number"
                                  min={0}
                                  value={m.unit_cost}
                                  onChange={(e) => updateMaterial(it.id, idx, { unit_cost: Number(e.target.value) })}
                                  style={{ ...input, width: 100, textAlign: 'right' }}
                                />
                              ) : (
                                money(m.unit_cost, currency)
                              )}
                            </td>
                            <td style={{ ...matTd, textAlign: 'right' }}>{money(sub, currency)}</td>
                            {canEdit && (
                              <td style={{ ...matTd, textAlign: 'center' }}>
                                <button style={iconBtn} onClick={() => removeMaterial(it.id, idx)}>
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                <div style={{ textAlign: 'right', fontSize: 12, color: C.muted, marginTop: 4 }}>
                  {t('quoteDetail.materialsSubtotal')}:{' '}
                  <strong style={{ color: C.text }}>
                    {money(canEdit && calc ? calc.materials : it.materials_subtotal, currency)}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        {canEdit && (
          <button
            style={{ ...primaryBtn, opacity: submitResponse.isPending ? 0.6 : 1 }}
            disabled={submitResponse.isPending}
            onClick={handleSave}
          >
            <Save size={16} /> {submitResponse.isPending ? t('quoteDetail.saving') : t('quoteDetail.saveQuote')}
          </button>
        )}
        {canRespond && (
          <>
            <button
              style={{ ...dangerBtn, opacity: rejectQuote.isPending ? 0.6 : 1 }}
              disabled={rejectQuote.isPending || approveQuote.isPending}
              onClick={handleReject}
            >
              <X size={16} /> {t('quoteDetail.reject')}
            </button>
            <button
              style={{ ...primaryBtn, opacity: approveQuote.isPending ? 0.6 : 1 }}
              disabled={approveQuote.isPending || rejectQuote.isPending}
              onClick={handleApprove}
            >
              <Check size={16} />{' '}
              {approveQuote.isPending ? t('quoteDetail.processing') : t('quoteDetail.approve')}
            </button>
          </>
        )}
        {isClient && quote.status === 'requested' && (
          <p style={{ color: C.muted, fontSize: 13, alignSelf: 'center' }}>{t('quoteDetail.awaitingQuote')}</p>
        )}
      </div>

      {/* Work orders (after approval) */}
      {isApproved && (
        <div style={{ marginTop: 28 }}>
          <h2 style={sectionTitle}>{t('quoteDetail.workOrders')}</h2>
          <div style={infoCard}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={woTh}>{t('quoteDetail.woDefect')}</th>
                  <th style={woTh}>{t('quoteDetail.woSide')}</th>
                  <th style={{ ...woTh, textAlign: 'right' }}>{t('quoteDetail.woCost')}</th>
                  <th style={{ ...woTh, textAlign: 'center' }}>{t('quoteDetail.woStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {(workOrders ?? []).map((wo) => (
                  <tr key={wo.key}>
                    <td style={woTd}>{wo.defectType || '—'}</td>
                    <td style={woTd}>{wo.bladeSide || '—'}</td>
                    <td style={{ ...woTd, textAlign: 'right' }}>{money(wo.cost, wo.currency)}</td>
                    <td style={{ ...woTd, textAlign: 'center' }}>
                      <Badge variant={WO_BADGE[wo.status]}>{t(`workOrder.status.${wo.status}`)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
};
const title: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: C.text, margin: 0 };
const subtitle: React.CSSProperties = { fontSize: 14, color: C.muted, margin: '4px 0 0' };
const infoCard: React.CSSProperties = {
  display: 'flex',
  gap: 32,
  alignItems: 'center',
  background: 'var(--color-neutral-0)',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  padding: 16,
  marginBottom: 20,
};
const infoLabel: React.CSSProperties = {
  fontSize: 11,
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  fontWeight: 600,
};
const infoValue: React.CSSProperties = { fontSize: 14, color: C.text, marginTop: 2 };
const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 12px' };
const itemCard: React.CSSProperties = {
  background: 'var(--color-neutral-0)',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  padding: 16,
};
const itemHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  borderBottom: `1px solid ${C.border}`,
  paddingBottom: 10,
  marginBottom: 12,
};
const laborRow: React.CSSProperties = { display: 'flex', gap: 16, flexWrap: 'wrap' };
const fieldLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  color: C.muted,
};
const fieldLabelInline: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.muted };
const input: React.CSSProperties = {
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 13,
  color: C.text,
  fontFamily: 'var(--font-family-sans)',
  width: 120,
};
const readValue: React.CSSProperties = { fontSize: 13, color: C.text, fontWeight: 500, padding: '6px 0' };
const select: React.CSSProperties = { ...input, width: 100, cursor: 'pointer' };
const matTable: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 12.5 };
const matTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  color: C.muted,
  fontWeight: 600,
  fontSize: 11,
  borderBottom: `1px solid ${C.border}`,
};
const matTd: React.CSSProperties = { padding: '6px 8px', color: C.text, verticalAlign: 'middle' };
const miniBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  background: 'rgba(90,143,90,0.1)',
  color: C.brand,
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  border: 'none',
  borderRadius: 6,
  background: '#FEE2E2',
  color: '#991B1B',
  cursor: 'pointer',
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 20px',
  background: C.brand,
  color: 'var(--color-neutral-0)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const dangerBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 20px',
  background: 'var(--color-neutral-0)',
  color: '#991B1B',
  border: '1px solid #FCA5A5',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const woTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  color: C.muted,
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  borderBottom: `1px solid ${C.border}`,
};
const woTd: React.CSSProperties = { padding: '8px 10px', color: C.text };
