import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { Button, Badge, Skeleton } from '@/components/atoms';
import { EmptyState } from '@/components/molecules';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import { useImportRepairCampaign } from '@/hooks/useImportRepairCampaign';
import { droneUploadService } from '@/services/drone-upload.service';
import type { CampaignStatus, UploadRecord } from '@/types';
import type { BadgeVariant } from '@/components/atoms';
import type { RepairImportRowError } from '@/services/repair-import.service';

/**
 * Upload sync status derived from campaign.status:
 *  - 'awaiting_photos'          → sync still in progress (photos still arriving)
 *  - any other status           → upload finished
 */
type SyncState = 'in_progress' | 'uploaded';

function syncStateFor(status: CampaignStatus): SyncState {
  return status === 'awaiting_photos' ? 'in_progress' : 'uploaded';
}

const SYNC_STATE_BADGE_MAP: Record<SyncState, BadgeVariant> = {
  in_progress: 'warning',
  uploaded: 'success',
};

export function UploadsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ─── Repair campaign import (Excel) ───────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rowErrors, setRowErrors] = useState<RepairImportRowError[]>([]);
  const importRepair = useImportRepairCampaign();

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so selecting the same file again re-triggers change.
      e.target.value = '';
      if (!file) return;

      setRowErrors([]);
      try {
        const summary = await importRepair.mutateAsync(file);
        setRowErrors(summary.errores);
        if (summary.errores.length === 0) {
          toast.success(
            t('uploads.importSuccess')
              .replace('{ok}', String(summary.ok))
              .replace('{campaigns}', String(summary.campanias.length)),
          );
        } else {
          toast.warning(
            t('uploads.importPartial')
              .replace('{ok}', String(summary.ok))
              .replace('{errors}', String(summary.errores.length)),
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('uploads.importFailed'));
      }
    },
    [importRepair, toast, t],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['upload-records'],
    queryFn: () => droneUploadService.getUploadRecords(),
  });

  const records = useMemo<UploadRecord[]>(() => data ?? [], [data]);
  const totalCount = records.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const pagedRecords = useMemo(
    () => records.slice((page - 1) * pageSize, page * pageSize),
    [records, page],
  );

  const SYNC_STATE_LABELS: Record<SyncState, string> = {
    in_progress: t('uploads.statusInProgress'),
    uploaded: t('uploads.statusUploaded'),
  };

  const handleRowClick = useCallback(
    (campaignId: string) => {
      navigate(`/campaigns/${campaignId}/upload`);
    },
    [navigate],
  );

  const turbineLabel = useCallback(
    (names: string[]): string => {
      if (names.length === 0) return '—';
      if (names.length === 1) return names[0]!;
      return `${names[0]} +${names.length - 1} ${t('uploads.moreTurbines')}`;
    },
    [t],
  );

  // ─── Styles (aligned with Inspections.tsx) ────────────────────────────────
  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-4)',
    borderBottom: '1px solid var(--color-neutral-100)',
    flexShrink: 0,
  };

  const headerTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--text-xl)',
    fontWeight: 700,
    color: '#111827',
    borderLeft: '4px solid #5A8F5A',
    paddingLeft: '12px',
  };

  const tableContainerStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-4)',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--text-sm)',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: 'var(--space-3) var(--space-4)',
    fontWeight: 600,
    color: 'var(--color-neutral-600)',
    borderBottom: '2px solid var(--color-neutral-200)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: 'var(--space-3) var(--space-4)',
    color: 'var(--color-neutral-800)',
    borderBottom: '1px solid var(--color-neutral-100)',
  };

  const rowStyle: React.CSSProperties = {
    cursor: 'pointer',
    transition: `background-color var(--duration-fast) var(--easing-default)`,
  };

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4)',
    borderTop: '1px solid var(--color-neutral-100)',
    flexShrink: 0,
  };

  const pageIndicatorStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-600)',
  };

  // Loading skeleton — preserves page structure
  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <h1 style={headerTitleStyle}>{t('page.uploads')}</h1>
        </div>
        <div style={tableContainerStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="rect" height="48px" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const showEmptyState = !isLoading && records.length === 0;

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={headerTitleStyle}>{t('page.uploads')}</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileSelected}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
          <Button
            variant="primary"
            size="sm"
            icon={Upload}
            onClick={handleImportClick}
            loading={importRepair.isPending}
            title={t('uploads.importRepairHint')}
          >
            {importRepair.isPending ? t('uploads.importing') : t('uploads.importRepair')}
          </Button>
        </div>
      </div>

      {/* Row-level import errors */}
      {rowErrors.length > 0 && (
        <div
          style={{
            margin: 'var(--space-4)',
            marginBottom: 0,
            padding: 'var(--space-3) var(--space-4)',
            border: '1px solid var(--color-danger-500)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-danger-50, #fef2f2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-neutral-800)',
          }}
          role="alert"
        >
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            {t('uploads.importErrors')} ({rowErrors.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {rowErrors.map((err) => (
              <li key={err.fila}>
                {t('uploads.importRow')} {err.fila}: {err.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showEmptyState ? (
        <EmptyState
          icon={Upload}
          title={t('uploads.noFound')}
          description={t('uploads.noFoundDesc')}
        />
      ) : (
        <>
          {/* Data Table */}
          <div style={tableContainerStyle}>
            <table style={tableStyle} role="grid" aria-label="Uploads list">
              <thead>
                <tr>
                  <th style={thStyle}>{t('uploads.turbine')}</th>
                  <th style={thStyle}>{t('uploads.farm')}</th>
                  <th style={thStyle}>{t('uploads.photos')}</th>
                  <th style={thStyle}>{t('uploads.uploadedBy')}</th>
                  <th style={thStyle}>{t('uploads.date')}</th>
                  <th style={thStyle}>{t('uploads.status')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map((record) => {
                  const state = syncStateFor(record.status);
                  return (
                    <tr
                      key={record.campaignId}
                      style={rowStyle}
                      onClick={() => handleRowClick(record.campaignId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(record.campaignId);
                        }
                      }}
                      tabIndex={0}
                      role="row"
                      aria-label={`Upload ${record.campaignName}`}
                    >
                      <td style={tdStyle}>{turbineLabel(record.turbineNames)}</td>
                      <td style={tdStyle}>{record.windFarmName ?? '—'}</td>
                      <td style={tdStyle}>{record.photoCount}</td>
                      <td style={tdStyle}>{record.uploadedBy ?? '—'}</td>
                      <td style={tdStyle}>
                        {record.uploadedAt
                          ? new Date(record.uploadedAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td style={tdStyle}>
                        <Badge variant={SYNC_STATE_BADGE_MAP[state]}>
                          {SYNC_STATE_LABELS[state]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination — always rendered to prevent layout shift */}
          <div style={paginationStyle}>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label={t('general.previous')}
            />
            <span style={pageIndicatorStyle}>
              {t('inspections.page')} {page} {t('general.of')} {totalPages || 1}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label={t('general.next')}
            />
          </div>
        </>
      )}
    </div>
  );
}
