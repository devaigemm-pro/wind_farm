import { useState, useMemo, useCallback, useRef, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  UploadCloud,
  FileSpreadsheet,
  ExternalLink,
  Download,
  Loader2,
} from 'lucide-react';
import { Button, Badge, Skeleton } from '@/components/atoms';
import { EmptyState, TabBar } from '@/components/molecules';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import {
  useImportRepairCampaign,
  useDefectImports,
  useDefectImportRows,
} from '@/hooks/useImportRepairCampaign';
import { useWindFarms } from '@/hooks/useWindFarms';
import { useTurbines } from '@/hooks/useTurbines';
import { droneUploadService } from '@/services/drone-upload.service';
import { downloadDefectTemplate } from '@/services/repair-import.service';
import { BLADE_FACE_LABELS } from '@/types';
import type { CampaignStatus, UploadRecord, BladeFace } from '@/types';
import type { BadgeVariant } from '@/components/atoms';
import type { RepairImportSummary } from '@/services/repair-import.service';

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

type TabId = 'photos' | 'defects';

// ─── Shared styles ──────────────────────────────────────────────────────────

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

const tabBarWrapperStyle: React.CSSProperties = {
  padding: '0 var(--space-4)',
  flexShrink: 0,
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

const selectStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-family-sans)',
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--color-neutral-0, #fff)',
  color: 'var(--color-neutral-800)',
  minWidth: '180px',
};

const dropZoneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-6)',
  border: '2px dashed var(--color-neutral-200)',
  borderRadius: 'var(--radius-lg)',
  backgroundColor: 'var(--color-neutral-50)',
  transition: 'all var(--duration-normal) var(--easing-default)',
};

const dropZoneActiveStyle: React.CSSProperties = {
  borderColor: 'var(--color-primary-400)',
  backgroundColor: 'var(--color-primary-50)',
};

// ═══════════════════════════════════════════════════════════════════════════
// UploadsPage — two tabs: inspection photos & defect spreadsheet
// ═══════════════════════════════════════════════════════════════════════════

export function UploadsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('photos');

  const { data, isLoading } = useQuery({
    queryKey: ['upload-records'],
    queryFn: () => droneUploadService.getUploadRecords(),
  });

  const records = useMemo<UploadRecord[]>(() => data ?? [], [data]);

  const tabs = useMemo(
    () => [
      { id: 'photos', label: t('uploads.tabPhotos') },
      { id: 'defects', label: t('uploads.tabDefects') },
    ],
    [t],
  );

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={headerTitleStyle}>{t('page.uploads')}</h1>
      </div>

      {/* Tabs */}
      <div style={tabBarWrapperStyle}>
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />
      </div>

      {activeTab === 'photos' ? (
        <PhotosTab records={records} isLoading={isLoading} />
      ) : (
        <DefectsTab />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 1 — Inspection photos
// ═══════════════════════════════════════════════════════════════════════════

interface PhotosTabProps {
  records: UploadRecord[];
  isLoading: boolean;
}

function PhotosTab({ records, isLoading }: PhotosTabProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [page, setPage] = useState(1);
  const pageSize = 20;

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

  if (isLoading) {
    return (
      <div style={tableContainerStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="48px" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Photo upload panel */}
      <PhotoUploadPanel records={records} />

      {records.length === 0 ? (
        <EmptyState
          icon={Upload}
          title={t('uploads.noFound')}
          description={t('uploads.noFoundDesc')}
        />
      ) : (
        <>
          <div style={tableContainerStyle}>
            <table style={tableStyle} role="grid" aria-label="Uploads list">
              <thead>
                <tr>
                  <th style={thStyle}>{t('uploads.campaign')}</th>
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
                      <td style={tdStyle}>{record.campaignName || '—'}</td>
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

          {/* Pagination */}
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
    </>
  );
}

// ─── Photo upload panel (dropzone + selects) ─────────────────────────────────

interface PhotoUploadPanelProps {
  records: UploadRecord[];
}

function PhotoUploadPanel({ records }: PhotoUploadPanelProps) {
  const { t } = useLanguage();
  const toast = useToast();

  const [campaignId, setCampaignId] = useState('');
  const [bladeId, setBladeId] = useState('');
  const [face, setFace] = useState<BladeFace | ''>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Blades of the selected campaign, resolved from the upload-progress RPC
  // (unique by bladeId — the RPC returns one row per blade+face).
  const { data: progress } = useQuery({
    queryKey: ['upload-progress', campaignId],
    queryFn: () => droneUploadService.getUploadProgress(campaignId),
    enabled: !!campaignId,
  });

  const blades = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of progress ?? []) {
      if (!seen.has(p.bladeId)) seen.set(p.bladeId, p.bladePosition);
    }
    return Array.from(seen.entries()).map(([id, position]) => ({ id, position }));
  }, [progress]);

  const faces = useMemo<BladeFace[]>(
    () => Object.keys(BLADE_FACE_LABELS) as BladeFace[],
    [],
  );

  const canUpload = !!campaignId && !!bladeId && !!face && !isUploading;

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!campaignId || !bladeId || !face) {
        toast.warning(t('uploads.pickCampaignFirst'));
        return;
      }
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;

      setIsUploading(true);
      let ok = 0;
      let failed = 0;
      for (let i = 0; i < images.length; i++) {
        const file = images[i]!;
        try {
          await droneUploadService.uploadPhoto(file, {
            campaignId,
            bladeId,
            face,
            radialPosition: 0,
            flightPlanOrder: i,
            filename: file.name,
            capturedAt: new Date().toISOString(),
            metadata: { source: 'manual-upload' },
          });
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      setIsUploading(false);

      if (ok > 0) {
        toast.success(t('uploads.uploadPhotosSuccess').replace('{n}', String(ok)));
      }
      if (failed > 0) {
        toast.error(t('uploads.uploadPhotosFailed'));
      }
    },
    [campaignId, bladeId, face, toast, t],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!canUpload) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) void uploadFiles(files);
    },
    [canUpload, uploadFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      e.target.value = '';
      if (files.length > 0) void uploadFiles(files);
    },
    [uploadFiles],
  );

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: 0 }}>
      <div
        style={{
          border: '1px solid var(--color-neutral-100)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            color: '#111827',
          }}
        >
          {t('uploads.uploadPhotosTitle')}
        </h2>

        {/* Selects */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
              {t('uploads.campaign')}
            </span>
            <select
              style={selectStyle}
              value={campaignId}
              onChange={(e) => {
                setCampaignId(e.target.value);
                setBladeId('');
              }}
              aria-label={t('uploads.selectCampaign')}
            >
              <option value="">{t('uploads.selectCampaign')}</option>
              {records.map((r) => (
                <option key={r.campaignId} value={r.campaignId}>
                  {r.campaignName || r.campaignId}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
              {t('uploads.blade')}
            </span>
            <select
              style={selectStyle}
              value={bladeId}
              onChange={(e) => setBladeId(e.target.value)}
              disabled={!campaignId || blades.length === 0}
              aria-label={t('uploads.selectBlade')}
            >
              <option value="">{t('uploads.selectBlade')}</option>
              {blades.map((b) => (
                <option key={b.id} value={b.id}>
                  {t('uploads.bladePosition').replace('{n}', String(b.position))}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
              {t('uploads.face')}
            </span>
            <select
              style={selectStyle}
              value={face}
              onChange={(e) => setFace(e.target.value as BladeFace)}
              disabled={!campaignId}
              aria-label={t('uploads.selectFace')}
            >
              <option value="">{t('uploads.selectFace')}</option>
              {faces.map((f) => (
                <option key={f} value={f}>
                  {BLADE_FACE_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {campaignId && blades.length === 0 && (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-500)' }}>
            {t('uploads.noBlades')}
          </p>
        )}

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            ...dropZoneStyle,
            ...(isDragOver ? dropZoneActiveStyle : {}),
            opacity: canUpload || isUploading ? 1 : 0.6,
          }}
          role="region"
          aria-label={t('uploads.uploadPhotosTitle')}
        >
          <Upload size={24} style={{ color: 'var(--color-neutral-400)' }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-500)' }}>
            {isDragOver ? t('uploads.dropHere') : t('uploads.dragAndDrop')}
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon={Upload}
            onClick={() => fileInputRef.current?.click()}
            disabled={!canUpload}
            loading={isUploading}
          >
            {isUploading ? t('uploads.uploadingPhotos') : t('uploads.addPhotos')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={handleFileInput}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 2 — Defects (spreadsheet import)
// ═══════════════════════════════════════════════════════════════════════════

function DefectsTab() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const toast = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<RepairImportSummary | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const importRepair = useImportRepairCampaign();

  // Import target: park → turbine (turbine depends on the selected park and
  // resets whenever the park changes). Both required to enable the import.
  const [windFarmId, setWindFarmId] = useState('');
  const [turbineId, setTurbineId] = useState('');
  const { data: windFarms } = useWindFarms();
  const { data: turbines } = useTurbines(windFarmId);

  const { data: imports, isLoading: isLoadingImports } = useDefectImports();
  const { data: importRows, isLoading: isLoadingRows } = useDefectImportRows(selectedImportId);

  const handleImportClick = useCallback(() => {
    if (!windFarmId || !turbineId) {
      toast.warning(t('uploads.pickFarmTurbineFirst'));
      return;
    }
    fileInputRef.current?.click();
  }, [windFarmId, turbineId, toast, t]);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!windFarmId || !turbineId) {
        toast.warning(t('uploads.pickFarmTurbineFirst'));
        return;
      }

      const windFarmName = (windFarms ?? []).find((f) => f.id === windFarmId)?.name;
      const turbineName = (turbines ?? []).find((tb) => tb.id === turbineId)?.name;

      try {
        const result = await importRepair.mutateAsync({
          file,
          windFarmId,
          turbineId,
          windFarmName,
          turbineName,
        });
        setSummary(result);
        if (result.errores.length === 0) {
          toast.success(
            t('uploads.importSuccess')
              .replace('{ok}', String(result.ok))
              .replace('{campaigns}', String(result.campanias.length)),
          );
        } else {
          toast.warning(
            t('uploads.importPartial')
              .replace('{ok}', String(result.ok))
              .replace('{errors}', String(result.errores.length)),
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('uploads.importFailed'));
      }
    },
    [importRepair, toast, t, windFarmId, turbineId, windFarms, turbines],
  );

  const statCardStyle: React.CSSProperties = {
    flex: 1,
    minWidth: '140px',
    padding: 'var(--space-4)',
    border: '1px solid var(--color-neutral-100)',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: 'var(--text-2xl, 1.5rem)',
    fontWeight: 700,
    color: '#111827',
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-500)',
  };

  return (
    <div style={{ ...tableContainerStyle, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Import action */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
          {/* Park select */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
              {t('uploads.farm')}
            </span>
            <select
              style={selectStyle}
              value={windFarmId}
              onChange={(e) => {
                setWindFarmId(e.target.value);
                setTurbineId('');
              }}
              aria-label={t('uploads.selectFarm')}
            >
              <option value="">{t('uploads.selectFarm')}</option>
              {(windFarms ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          {/* Turbine select — depends on the selected park */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
              {t('uploads.turbineLabel')}
            </span>
            <select
              style={selectStyle}
              value={turbineId}
              onChange={(e) => setTurbineId(e.target.value)}
              disabled={!windFarmId}
              aria-label={t('uploads.selectTurbine')}
            >
              <option value="">{t('uploads.selectTurbine')}</option>
              {(turbines ?? []).map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.name}
                </option>
              ))}
            </select>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileSelected}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={() => void downloadDefectTemplate()}
            title={t('uploads.downloadTemplateHint')}
            style={{ backgroundColor: '#5A8F5A', color: '#ffffff', border: 'none' }}
          >
            {t('uploads.downloadTemplate')}
          </Button>
        </div>

        {(!windFarmId || !turbineId) && (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-500)' }}>
            {t('uploads.pickFarmTurbineFirst')}
          </p>
        )}
      </div>

      {!summary && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-12) var(--space-6)',
            textAlign: 'center',
            fontFamily: 'var(--font-family-sans)',
          }}
          role="status"
        >
          <button
            type="button"
            onClick={handleImportClick}
            disabled={importRepair.isPending}
            aria-label={t('uploads.importRepair')}
            title={t('uploads.importRepairHint')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: '#5A8F5A',
              color: '#ffffff',
              marginBottom: 'var(--space-4)',
              border: 'none',
              padding: 0,
              cursor: importRepair.isPending ? 'wait' : 'pointer',
              opacity: importRepair.isPending ? 0.6 : 1,
              transition: 'all var(--duration-normal) var(--easing-default)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4A7A4A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#5A8F5A';
            }}
          >
            {importRepair.isPending ? (
              <Loader2
                size={28}
                style={{ animation: 'spin 1s linear infinite' }}
                aria-hidden="true"
              />
            ) : (
              <UploadCloud size={28} aria-hidden="true" />
            )}
          </button>
          <h3
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--color-neutral-900)',
              margin: 0,
              marginBottom: 'var(--space-2)',
            }}
          >
            {t('uploads.tabDefects')}
          </h3>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-neutral-500)',
              margin: 0,
              maxWidth: '320px',
              lineHeight: 1.5,
            }}
          >
            {t('uploads.noImportYet')}
          </p>
        </div>
      )}

      {summary && (
        <>
          {/* Summary stats */}
          <div>
            <h2
              style={{
                margin: '0 0 var(--space-3) 0',
                fontSize: 'var(--text-md)',
                fontWeight: 600,
                color: '#111827',
              }}
            >
              {t('uploads.importSummaryTitle')}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div style={statCardStyle}>
                <span style={statValueStyle}>{summary.total}</span>
                <span style={statLabelStyle}>{t('uploads.summaryTotal')}</span>
              </div>
              <div style={statCardStyle}>
                <span style={{ ...statValueStyle, color: 'var(--color-success-600, #16a34a)' }}>
                  {summary.ok}
                </span>
                <span style={statLabelStyle}>{t('uploads.summaryOk')}</span>
              </div>
              <div style={statCardStyle}>
                <span
                  style={{
                    ...statValueStyle,
                    color:
                      summary.errores.length > 0
                        ? 'var(--color-danger-500, #ef4444)'
                        : '#111827',
                  }}
                >
                  {summary.errores.length}
                </span>
                <span style={statLabelStyle}>{t('uploads.summaryErrors')}</span>
              </div>
            </div>
          </div>

          {/* Affected repair campaigns */}
          {summary.campanias.length > 0 && (
            <div>
              <h3
                style={{
                  margin: '0 0 var(--space-2) 0',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--color-neutral-700)',
                }}
              >
                {t('uploads.affectedCampaigns')} ({summary.campanias.length})
              </h3>
              <table style={tableStyle} role="grid" aria-label="Affected repair campaigns">
                <thead>
                  <tr>
                    <th style={thStyle}>{t('uploads.turbine')}</th>
                    <th style={thStyle}>{t('uploads.campaign')}</th>
                    <th style={thStyle} />
                  </tr>
                </thead>
                <tbody>
                  {summary.campanias.map((c) => (
                    <tr key={c.campaignId} style={rowStyle}>
                      <td style={tdStyle}>{c.turbina || '—'}</td>
                      <td style={tdStyle}>{c.nombre || c.campaignId}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={ExternalLink}
                          onClick={() => navigate(`/repairs/${c.campaignId}`)}
                        >
                          {t('uploads.viewRepair')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Row-level errors */}
          {summary.errores.length > 0 && (
            <div
              style={{
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
                {t('uploads.importErrors')} ({summary.errores.length})
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {summary.errores.map((err) => (
                  <li key={err.fila}>
                    {t('uploads.importRow')} {err.fila}: {err.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Persistent import history (all users) */}
      {selectedImportId ? (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--text-md)',
                fontWeight: 600,
                color: '#111827',
              }}
            >
              {t('uploads.importDetailTitle')}
            </h2>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              onClick={() => setSelectedImportId(null)}
            >
              {t('uploads.backToHistory')}
            </Button>
          </div>

          {isLoadingRows ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="rect" height="40px" />
              ))}
            </div>
          ) : (importRows ?? []).length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title={t('uploads.importDetailTitle')}
              description={t('uploads.importRowsEmpty')}
            />
          ) : (
            <table style={tableStyle} role="grid" aria-label="Import detail rows">
              <thead>
                <tr>
                  <th style={thStyle}>{t('uploads.rowNumber')}</th>
                  <th style={thStyle}>{t('uploads.turbine')}</th>
                  <th style={thStyle}>{t('uploads.farm')}</th>
                  <th style={thStyle}>{t('uploads.rowLocation')}</th>
                  <th style={thStyle}>{t('uploads.rowIdentifier')}</th>
                  <th style={thStyle}>{t('uploads.rowSerial')}</th>
                  <th style={thStyle}>{t('uploads.rowSide')}</th>
                  <th style={thStyle}>{t('uploads.rowType')}</th>
                  <th style={thStyle}>{t('uploads.rowStatus')}</th>
                  <th style={thStyle}>{t('uploads.rowReason')}</th>
                </tr>
              </thead>
              <tbody>
                {(importRows ?? []).map((r) => {
                  const isError = r.status === 'error';
                  return (
                    <tr
                      key={r.id}
                      style={{
                        backgroundColor: isError
                          ? 'var(--color-danger-50, #fef2f2)'
                          : undefined,
                      }}
                    >
                      <td style={tdStyle}>{r.fila ?? '—'}</td>
                      <td style={tdStyle}>{r.turbina || '—'}</td>
                      <td style={tdStyle}>{r.parque || '—'}</td>
                      <td style={tdStyle}>{r.ubicacionDanio || '—'}</td>
                      <td style={tdStyle}>{r.defectIdentifier || '—'}</td>
                      <td style={tdStyle}>{r.serialPala || '—'}</td>
                      <td style={tdStyle}>{r.lado || '—'}</td>
                      <td style={tdStyle}>{r.tipo || '—'}</td>
                      <td style={tdStyle}>
                        <Badge variant={isError ? 'danger' : 'success'}>
                          {isError ? t('uploads.statusError') : t('uploads.statusOk')}
                        </Badge>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: isError
                            ? 'var(--color-danger-500, #ef4444)'
                            : 'var(--color-neutral-500)',
                        }}
                      >
                        {r.motivo || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div>
          <h2
            style={{
              margin: '0 0 var(--space-3) 0',
              fontSize: 'var(--text-md)',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            {t('uploads.importHistory')}
          </h2>

          {isLoadingImports ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="rect" height="40px" />
              ))}
            </div>
          ) : (imports ?? []).length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title={t('uploads.importHistory')}
              description={t('uploads.importHistoryEmpty')}
            />
          ) : (
            <table style={tableStyle} role="grid" aria-label="Defect import history">
              <thead>
                <tr>
                  <th style={thStyle}>{t('uploads.histFile')}</th>
                  <th style={thStyle}>{t('uploads.histUploadedBy')}</th>
                  <th style={thStyle}>{t('uploads.histTotal')}</th>
                  <th style={thStyle}>{t('uploads.histOk')}</th>
                  <th style={thStyle}>{t('uploads.histErrors')}</th>
                  <th style={thStyle}>{t('uploads.histDate')}</th>
                </tr>
              </thead>
              <tbody>
                {(imports ?? []).map((imp) => (
                  <tr
                    key={imp.id}
                    style={rowStyle}
                    onClick={() => setSelectedImportId(imp.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedImportId(imp.id);
                      }
                    }}
                    tabIndex={0}
                    role="row"
                    aria-label={`Import ${imp.fileName ?? imp.id}`}
                  >
                    <td style={tdStyle}>{imp.fileName || '—'}</td>
                    <td style={tdStyle}>{imp.uploadedByName || '—'}</td>
                    <td style={tdStyle}>{imp.total}</td>
                    <td style={{ ...tdStyle, color: 'var(--color-success-600, #16a34a)' }}>
                      {imp.okCount}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color:
                          imp.errorCount > 0
                            ? 'var(--color-danger-500, #ef4444)'
                            : 'var(--color-neutral-800)',
                      }}
                    >
                      {imp.errorCount}
                    </td>
                    <td style={tdStyle}>
                      {imp.createdAt ? new Date(imp.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
