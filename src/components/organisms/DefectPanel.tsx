import { useState } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Badge, Button, Input, Skeleton } from '@/components/atoms';
import { EmptyState } from '@/components/molecules';
import { useLanguage } from '@/components/design-system';
import { useDefects } from '@/hooks/useDefects';
import {
  useCreateDefect,
  useUpdateDefect,
  useDeleteDefect,
} from '@/hooks/useDefectMutations';
import { defectSchema } from '@/utils/validation';
import { DEFECT_TYPES, SEVERITIES } from '@/types';
import type { Defect, DefectType, Severity } from '@/types';
import type { BadgeVariant } from '@/components/atoms/Badge';

export interface DefectPanelProps {
  inspectionId: string;
  canEdit: boolean;
}

interface DefectFormState {
  type: DefectType;
  severity: Severity;
  distance_from_root: string;
  description: string;
  width_cm: string;
  height_cm: string;
  next_step: string;
}

const INITIAL_FORM: DefectFormState = {
  type: 'le_erosion',
  severity: 1,
  distance_from_root: '',
  description: '',
  width_cm: '',
  height_cm: '',
  next_step: '',
};

const DEFECT_TYPE_LABELS: Record<DefectType, string> = {
  le_erosion: 'LE Erosion',
  vortex: 'Vortex',
  paint_defect: 'Paint Defect',
  crack: 'Crack',
  delamination: 'Delamination',
  lightning_damage: 'Lightning Damage',
  other: 'Other',
};

const SEVERITY_VARIANT: Record<Severity, BadgeVariant> = {
  1: 'neutral',
  2: 'info',
  3: 'warning',
  4: 'warning',
  5: 'danger',
};

export function DefectPanel({ inspectionId, canEdit }: DefectPanelProps) {
  const { t } = useLanguage();
  const { data: defects, isLoading } = useDefects(inspectionId);
  const createDefect = useCreateDefect();
  const updateDefect = useUpdateDefect();
  const deleteDefect = useDeleteDefect();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DefectFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setForm(INITIAL_FORM);
    setErrors({});
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(defect: Defect) {
    setEditingId(defect.id);
    setForm({
      type: defect.type,
      severity: defect.severity,
      distance_from_root: String(defect.distance_from_root),
      description: defect.description ?? '',
      width_cm: String(defect.width_cm ?? ''),
      height_cm: String(defect.height_cm ?? ''),
      next_step: defect.next_step ?? '',
    });
    setErrors({});
    setShowForm(true);
  }

  function handleSubmit() {
    const parsed = defectSchema.safeParse({
      inspection_id: inspectionId,
      type: form.type,
      severity: form.severity,
      distance_from_root: Number(form.distance_from_root),
      description: form.description || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    if (editingId) {
      updateDefect.mutate(
        {
          id: editingId,
          input: {
            type: parsed.data.type as DefectType,
            severity: parsed.data.severity as Severity,
            distance_from_root: parsed.data.distance_from_root,
            description: parsed.data.description ?? null,
            width_cm: form.width_cm ? Number(form.width_cm) : undefined,
            height_cm: form.height_cm ? Number(form.height_cm) : undefined,
            next_step: form.next_step || undefined,
          },
        },
        { onSuccess: resetForm },
      );
    } else {
      createDefect.mutate(
        {
          inspection_id: inspectionId,
          type: parsed.data.type as DefectType,
          severity: parsed.data.severity as Severity,
          distance_from_root: parsed.data.distance_from_root,
          description: parsed.data.description,
          width_cm: form.width_cm ? Number(form.width_cm) : undefined,
          height_cm: form.height_cm ? Number(form.height_cm) : undefined,
          next_step: form.next_step || undefined,
        },
        { onSuccess: resetForm },
      );
    }
  }

  function handleDelete(id: string) {
    deleteDefect.mutate(id);
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-4)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--text-lg)',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
    margin: 0,
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  };

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-neutral-200)',
    backgroundColor: 'var(--color-neutral-0)',
  };

  const cardInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  };

  const cardActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-1)',
  };

  const formContainerStyle: React.CSSProperties = {
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-neutral-200)',
    backgroundColor: 'var(--color-neutral-50)',
    marginBottom: 'var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  };

  const formRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 'var(--space-3)',
  };

  const formActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-2)',
    justifyContent: 'flex-end',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-sm)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-neutral-200)',
    backgroundColor: 'var(--color-neutral-0)',
    color: 'var(--color-neutral-900)',
    fontFamily: 'var(--font-family-sans)',
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    color: 'var(--color-neutral-800)',
    marginBottom: 'var(--space-1)',
    display: 'block',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-danger-500)',
    marginTop: '2px',
  };

  const distanceStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-600)',
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <Skeleton variant="text" width="120px" height="24px" />
        </div>
        <div style={listStyle}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rect" height="56px" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>Defects</h3>
        {canEdit && !showForm && (
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => {
              setEditingId(null);
              setForm(INITIAL_FORM);
              setErrors({});
              setShowForm(true);
            }}
          >
            Add Defect
          </Button>
        )}
      </div>

      {showForm && (
        <div style={formContainerStyle}>
          <div style={formRowStyle}>
            <div>
              <label style={labelStyle}>Type</label>
              <select
                style={selectStyle}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DefectType }))}
                aria-label="Defect type"
              >
                {DEFECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DEFECT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              {errors.type && <p style={errorStyle}>{errors.type}</p>}
            </div>
            <div>
              <label style={labelStyle}>Severity</label>
              <select
                style={selectStyle}
                value={form.severity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, severity: Number(e.target.value) as Severity }))
                }
                aria-label={t('table.severity')}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.severity && <p style={errorStyle}>{errors.severity}</p>}
            </div>
            <div>
              <Input
                label="Distance from root (m)"
                type="number"
                min={0}
                step="0.1"
                value={form.distance_from_root}
                onChange={(e) => setForm((f) => ({ ...f, distance_from_root: e.target.value }))}
                error={errors.distance_from_root}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{
                ...selectStyle,
                height: '80px',
                resize: 'vertical' as const,
                padding: 'var(--space-2) var(--space-3)',
              }}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              aria-label={t('defects.description')}
            />
            {errors.description && <p style={errorStyle}>{errors.description}</p>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <Input
                label={t('defects.widthCm')}
                type="number"
                min={0}
                step="0.1"
                value={form.width_cm}
                onChange={(e) => setForm((f) => ({ ...f, width_cm: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label={t('defects.heightCm')}
                type="number"
                min={0}
                step="0.1"
                value={form.height_cm}
                onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Input
              label={t('table.nextStep')}
              value={form.next_step}
              onChange={(e) => setForm((f) => ({ ...f, next_step: e.target.value }))}
            />
          </div>
          <div style={formActionsStyle}>
            <Button variant="secondary" size="sm" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              loading={createDefect.isPending || updateDefect.isPending}
            >
              {editingId ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {(!defects || defects.length === 0) && !showForm ? (
        <EmptyState
          icon={AlertTriangle}
          title={t('defects.noRecorded')}
          description={t('defects.noRecordedDesc')}
          action={
            canEdit
              ? {
                  label: 'Add Defect',
                  onClick: () => setShowForm(true),
                }
              : undefined
          }
        />
      ) : (
        <div style={listStyle}>
          {defects?.map((defect) => (
            <div key={defect.id} style={cardStyle}>
              <div style={cardInfoStyle}>
                <Badge variant={SEVERITY_VARIANT[defect.severity]} size="sm">
                  Sev {defect.severity}
                </Badge>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                  {DEFECT_TYPE_LABELS[defect.type]}
                </span>
                <span style={distanceStyle}>{defect.distance_from_root}m</span>
              </div>
              {canEdit && (
                <div style={cardActionsStyle}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Pencil}
                    onClick={() => startEdit(defect)}
                    aria-label={`Edit defect ${DEFECT_TYPE_LABELS[defect.type]}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => handleDelete(defect.id)}
                    aria-label={`Delete defect ${DEFECT_TYPE_LABELS[defect.type]}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
