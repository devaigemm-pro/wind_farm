import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, GripVertical, X, Send } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import { useQuotableDefects, useCreateQuote } from '@/hooks/useQuotes';
import type { QuotableDefect } from '@/types';

const C = {
  brand: '#5A8F5A',
  text: '#535353',
  muted: '#8A9099',
  border: '#E5E7EB',
  cat: {
    5: '#FF0000',
    4: '#FF5500',
    3: '#F29D00',
    2: '#006C7A',
    1: '#008F98',
  } as Record<number, string>,
};

function sizeLabel(d: QuotableDefect): string {
  const w = d.widthCm != null ? `${d.widthCm}` : '—';
  const h = d.heightCm != null ? `${d.heightCm}` : '—';
  return `${w} × ${h} cm`;
}

export function NewQuotePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const toast = useToast();

  const turbineId = searchParams.get('turbine') ?? '';
  const windFarmId = searchParams.get('windFarm') ?? '';

  const { data: defects, isLoading } = useQuotableDefects(turbineId);
  const createQuote = useCreateQuote();

  // Selected defect IDs (right column). Everything else stays on the left.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const all = useMemo(() => defects ?? [], [defects]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const availableDefects = useMemo(
    () => all.filter((d) => !selectedSet.has(d.id)),
    [all, selectedSet],
  );
  const selectedDefects = useMemo(
    () => selectedIds.map((id) => all.find((d) => d.id === id)).filter(Boolean) as QuotableDefect[],
    [selectedIds, all],
  );

  // Group available defects by category (severity 5 → 1).
  const grouped = useMemo(() => {
    const map = new Map<number, QuotableDefect[]>();
    for (const d of availableDefects) {
      const cat = d.severity || 0;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [availableDefects]);

  const addToQuote = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const removeFromQuote = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const id = e.dataTransfer.getData('text/plain') || dragId;
    if (id) addToQuote(id);
    setDragId(null);
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      toast.warning(t('toast.noDefectsSelected'));
      return;
    }
    try {
      await createQuote.mutateAsync({ turbineId, windFarmId, defectIds: selectedIds });
      toast.success(t('toast.quoteRequested'));
      navigate('/quotes');
    } catch {
      toast.error(t('toast.quoteRequestFailed'));
    }
  };

  return (
    <div style={page}>
      <div style={header}>
        <button style={backBtn} onClick={() => navigate('/quotes')}>
          <ArrowLeft size={16} /> {t('quotes.title')}
        </button>
        <h1 style={title}>{t('newQuote.title')}</h1>
      </div>

      {isLoading ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('quotes.loading')}</p>
      ) : (
        <div style={columns}>
          {/* Left: available defects grouped by category */}
          <div style={col}>
            <h2 style={colTitle}>{t('newQuote.available')}</h2>
            <p style={hint}>{t('newQuote.availableHint')}</p>
            <div style={colBody}>
              {availableDefects.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13, padding: 12 }}>
                  {all.length === 0 ? t('newQuote.noDefects') : t('newQuote.allSelected')}
                </p>
              ) : (
                grouped.map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={catHeader}>
                      <span style={{ ...catDot, background: C.cat[cat] ?? C.muted }} />
                      {t('newQuote.category')} {cat} ({items.length})
                    </div>
                    {items.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', d.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDragId(d.id);
                        }}
                        onDragEnd={() => setDragId(null)}
                        onDoubleClick={() => addToQuote(d.id)}
                        style={{ ...defectCard, opacity: dragId === d.id ? 0.5 : 1 }}
                        title={d.description ?? ''}
                      >
                        <GripVertical size={16} color={C.muted} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={defectTitle}>{d.typeLabel}</div>
                          <div style={defectMeta}>
                            {t('newQuote.blade')} {d.bladePosition || '—'} · {t('newQuote.side')}{' '}
                            {d.side || '—'} · {sizeLabel(d)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: defects to quote (drop zone) */}
          <div
            style={{ ...col, ...(dropActive ? colDropActive : {}) }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={handleDrop}
          >
            <h2 style={colTitle}>
              {t('newQuote.toQuote')} ({selectedDefects.length} {t('newQuote.selectedCount')})
            </h2>
            <p style={hint}>{t('newQuote.toQuoteHint')}</p>
            <div style={colBody}>
              {selectedDefects.length === 0 ? (
                <div style={dropPlaceholder}>{t('newQuote.dropHere')}</div>
              ) : (
                selectedDefects.map((d) => (
                  <div key={d.id} style={{ ...defectCard, cursor: 'default' }}>
                    <span style={{ ...catDot, background: C.cat[d.severity] ?? C.muted }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={defectTitle}>
                        {d.typeLabel} · {t('newQuote.category')} {d.severity}
                      </div>
                      <div style={defectMeta}>
                        {t('newQuote.blade')} {d.bladePosition || '—'} · {t('newQuote.side')}{' '}
                        {d.side || '—'} · {sizeLabel(d)}
                      </div>
                    </div>
                    <button
                      style={removeBtn}
                      onClick={() => removeFromQuote(d.id)}
                      aria-label={t('newQuote.remove')}
                      title={t('newQuote.remove')}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              style={{ ...submitBtn, opacity: selectedDefects.length === 0 || createQuote.isPending ? 0.6 : 1 }}
              disabled={selectedDefects.length === 0 || createQuote.isPending}
              onClick={handleSubmit}
            >
              <Send size={16} />
              {createQuote.isPending ? t('newQuote.submitting') : t('newQuote.submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { padding: 24, fontFamily: 'var(--font-family-sans)' };
const header: React.CSSProperties = { marginBottom: 20 };
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
const columns: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  alignItems: 'start',
};
const col: React.CSSProperties = {
  background: 'var(--color-neutral-0)',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 400,
  transition: 'border-color 0.15s, background 0.15s',
};
const colDropActive: React.CSSProperties = {
  borderColor: C.brand,
  background: 'rgba(90,143,90,0.04)',
};
const colTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: C.text, margin: 0 };
const hint: React.CSSProperties = { fontSize: 12, color: C.muted, margin: '4px 0 12px' };
const colBody: React.CSSProperties = { flex: 1, overflowY: 'auto', maxHeight: '60vh' };
const catHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  fontWeight: 700,
  color: C.text,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  margin: '0 0 6px',
};
const catDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  flexShrink: 0,
  display: 'inline-block',
};
const defectCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  marginBottom: 6,
  background: '#FAFBFC',
  cursor: 'grab',
};
const defectTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: C.text,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const defectMeta: React.CSSProperties = { fontSize: 11.5, color: C.muted, marginTop: 2 };
const dropPlaceholder: React.CSSProperties = {
  border: `2px dashed ${C.border}`,
  borderRadius: 8,
  padding: 32,
  textAlign: 'center',
  color: C.muted,
  fontSize: 13,
};
const removeBtn: React.CSSProperties = {
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
  flexShrink: 0,
};
const submitBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginTop: 12,
  padding: '12px',
  background: C.brand,
  color: 'var(--color-neutral-0)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
