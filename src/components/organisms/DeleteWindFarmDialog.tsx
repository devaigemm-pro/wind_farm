import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import { useWindFarmDeletionPreview } from '@/hooks/useWindFarms';
import { AssetServiceError } from '@/services/assets.service';
import { getDeletionLabel } from '@/constants/deletion-labels';

export interface DeleteWindFarmDialogProps {
  open: boolean;
  farmId: string | null;
  farmName: string;
  /** True while the delete request is in flight. */
  deleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Readable message for an error thrown by the wind farm delete/preview calls. */
export function windFarmDeleteErrorMessage(err: unknown, t: (key: string) => string): string {
  if (err instanceof AssetServiceError) {
    if (err.code === 'RPC_MISSING') return t('deleteFarm.rpcMissing');
    if (err.code === '42501') return t('deleteFarm.adminOnly');
    return err.message;
  }
  return err instanceof Error ? err.message : t('assetsAdmin.deleteFailed');
}

/**
 * Confirmation for deleting a wind farm WITH all its data. Shows what will be
 * deleted (a dry run of the cascade, so the numbers are real) and requires
 * typing the farm name before the button enables.
 */
export function DeleteWindFarmDialog({
  open,
  farmId,
  farmName,
  deleting = false,
  onConfirm,
  onCancel,
}: DeleteWindFarmDialogProps) {
  const { t, locale } = useLanguage();
  const [typed, setTyped] = useState('');
  const { data, isLoading, error } = useWindFarmDeletionPreview(farmId, open);

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, deleting, onCancel]);

  if (!open) return null;

  const rows = Object.entries(data?.counts ?? {})
    .filter(([table]) => table !== 'wind_farm')
    .sort((a, b) => b[1] - a[1]);
  const nameMatches = typed.trim() === farmName.trim() && farmName.trim() !== '';
  const canConfirm = !!data && nameMatches && !deleting;

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="delete-farm-title">
      <div style={dialogStyle}>
        <h2 id="delete-farm-title" style={titleStyle}>
          {t('deleteFarm.title')}
        </h2>
        <p style={textStyle}>{t('deleteFarm.intro').replace('{name}', farmName)}</p>

        <div style={listBoxStyle} aria-live="polite">
          {isLoading && <span style={mutedStyle}>{t('deleteFarm.loading')}</span>}
          {error && (
            <span style={errorStyle}>
              {t('deleteFarm.previewError')} {windFarmDeleteErrorMessage(error, t)}
            </span>
          )}
          {data && rows.length === 0 && <span style={mutedStyle}>{t('deleteFarm.nothingElse')}</span>}
          {data && rows.length > 0 && (
            <ul style={listStyle}>
              {rows.map(([table, n]) => (
                <li key={table} style={itemStyle}>
                  <span>{getDeletionLabel(table, locale)}</span>
                  <strong>{n.toLocaleString(locale)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p style={{ ...textStyle, fontSize: 'var(--text-xs)', margin: '0 0 var(--space-3)' }}>
          {t('deleteFarm.filesNote')}
        </p>

        <label style={{ ...textStyle, display: 'block', margin: '0 0 var(--space-1)' }} htmlFor="delete-farm-name">
          {t('deleteFarm.typeName')} <strong>{farmName}</strong>
        </label>
        <input
          id="delete-farm-name"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          disabled={deleting}
          style={inputStyle}
        />

        <div style={actionsStyle}>
          <Button variant="secondary" onClick={onCancel} disabled={deleting}>
            {t('button.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={!canConfirm} loading={deleting}>
            {t('deleteFarm.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 100,
  padding: 'var(--space-4)',
};
const dialogStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-neutral-0)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-xl)',
  padding: 'var(--space-6)',
  maxWidth: '480px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  fontFamily: 'var(--font-family-sans)',
};
const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  color: 'var(--color-danger-600, #b91c1c)',
};
const textStyle: React.CSSProperties = {
  margin: 'var(--space-3) 0',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-neutral-700)',
  lineHeight: 1.5,
};
const mutedStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--color-neutral-500)' };
const errorStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--color-danger-600, #b91c1c)' };
const listBoxStyle: React.CSSProperties = {
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3)',
  margin: '0 0 var(--space-3)',
  maxHeight: '220px',
  overflowY: 'auto',
  backgroundColor: 'var(--color-neutral-50)',
};
const listStyle: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };
const itemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-neutral-800)',
  padding: '2px 0',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: '40px',
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-md)',
};
const actionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-4)',
};
