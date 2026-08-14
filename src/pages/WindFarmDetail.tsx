import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { TabBar } from '@/components/molecules/TabBar';
import { DetailsBlock } from '@/components/organisms/DetailsBlock';
import { SubassetsTable } from '@/components/organisms/SubassetsTable';
import { DocumentDropbox } from '@/components/organisms/DocumentDropbox';
import { CampaignsPanel } from '@/components/organisms/CampaignsPanel';
import { DefectsWindFarmTab } from '@/components/organisms/DefectsWindFarmTab';
import { TurbineSerialNumbersModal } from '@/components/organisms/TurbineSerialNumbersModal';
import { EditCampaignModal } from '@/components/organisms/EditCampaignModal';
import { useWindFarmDetail, useSubassets, useCampaigns, useDeleteCampaign, useWindFarmDefects, useDefectImages } from '@/hooks/useWindFarmDetail';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/store/toastStore';
import { useLanguage } from '@/components/design-system';
import type { TurbineSubassetRow, Campaign } from '@/types';

export function WindFarmDetail() {
  const { id: windFarmId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();

  const { data: detail, isLoading: detailLoading } = useWindFarmDetail(windFarmId);
  const { data: subassets, isLoading: subassetsLoading } = useSubassets(windFarmId);
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(windFarmId);
  const { data: windFarmDefects, isLoading: defectsLoading } = useWindFarmDefects(windFarmId);
  const deleteCampaign = useDeleteCampaign();

  // Load defect images in background
  const defectIdsForImages = useMemo(() => (windFarmDefects ?? []).map(d => d.id), [windFarmDefects]);
  const { data: defectImageMap } = useDefectImages(defectIdsForImages);
  const defectsWithImages = useMemo(() => {
    if (!windFarmDefects) return [];
    if (!defectImageMap) return windFarmDefects;
    return windFarmDefects.map(d => ({ ...d, imageUrl: defectImageMap[d.id] ?? d.imageUrl }));
  }, [windFarmDefects, defectImageMap]);

  const [activeTab, setActiveTab] = useState('general');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [filterSubasset, setFilterSubasset] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Sort and paginate subassets
  const sortedSubassets = useMemo(() => {
    if (!subassets) return [];
    return [...subassets].sort((a, b) => {
      const aVal = a[sortField as keyof TurbineSubassetRow] ?? '';
      const bVal = b[sortField as keyof TurbineSubassetRow] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [subassets, sortField, sortDirection]);

  const paginatedSubassets = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedSubassets.slice(start, start + rowsPerPage);
  }, [sortedSubassets, page, rowsPerPage]);

  const handleSort = useCallback((field: string) => {
    if (field === sortField) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
    setPage(1);
  }, [sortField]);

  const handleViewResults = (campaignId: string) => {
    navigate(`/campaigns/${campaignId}/results`);
  };
  const handlePlanInspection = () => navigate(`/inspections/new?windFarm=${windFarmId}`);
  const handleTurbineClick = (turbineId: string) => {
    navigate(`/assets-wind/${windFarmId}/subasset/${turbineId}`);
  };
  const handleSubassetNameClick = (name: string) => {
    const turbine = subassets?.find((t) => t.name === name);
    if (turbine) {
      navigate(`/assets-wind/${windFarmId}/subasset/${turbine.id}`);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm(t('windFarmDetail.deleteCampaign'))) return;
    try { await deleteCampaign.mutateAsync(campaignId); toast.success(t('toast.campaignDeleted')); }
    catch { toast.error(t('toast.campaignDeleteFailed')); }
  };

  const handleExportDefects = useCallback(() => {
    const data = windFarmDefects ?? [];
    if (data.length === 0) { toast.error(t('windFarmDetail.noDefectsExport')); return; }
    const headers = ['Turbine', 'Model', 'Type', 'Width', 'Height', 'Category', 'Action', 'Urgency', 'Blade Position', 'Side', 'Root Distance', 'Resolved'];
    const rows = data.map((d) => [
      d.turbineName, d.turbineModel, d.type, d.defectWidth, d.defectHeight,
      d.category, d.actionText, d.actionUrgency, d.bladePosition, d.side,
      d.rootDistance, d.resolved ? t('general.yes') : t('general.no'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defects-${detail?.name ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [windFarmDefects, detail, toast]);

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={pageTitleStyle}>{detail?.name ?? t('general.loading')}</h1>
      </div>
      <TabBar tabs={[
        { id: 'general', label: t('windFarmDetail.tabGeneral') },
        { id: 'defects', label: t('windFarmDetail.tabDefects') },
      ]} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && (
        <div style={contentStyle} className="wind-farm-detail-content">
          {/* Left Column */}
          <div style={leftColStyle} className="wind-farm-detail-left">
            <DetailsBlock detail={detail} isLoading={detailLoading} onPlanInspection={handlePlanInspection} />
            <SubassetsTable
              data={paginatedSubassets}
              isLoading={subassetsLoading}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              page={page}
              rowsPerPage={rowsPerPage}
              totalCount={sortedSubassets.length}
              onPageChange={setPage}
              onRowsPerPageChange={(r) => { setRowsPerPage(r); setPage(1); }}
              onOpenSerialNumbers={() => setShowSerialModal(true)}
              onRowClick={handleTurbineClick}
              selectedSubassetName={filterSubasset}
            />
            {role !== 'supervisor' && <DocumentDropbox windFarmId={windFarmId!} />}
          </div>
          {/* Right Column */}
          <div style={rightColStyle} className="wind-farm-detail-right">
            <CampaignsPanel
              campaigns={campaigns ?? []}
              isLoading={campaignsLoading}
              onViewResults={handleViewResults}
              onSubassetClick={handleSubassetNameClick}
              onInspectionClick={(inspectionId, status, campaignId, turbineId, stage) => {
                if (status === 'completed' || status === 'approved' || stage === 'report') {
                  navigate(`/inspections/${inspectionId}/workflow?step=4`);
                } else {
                  // Navigate to workflow at the step matching the stage
                  let step = 1;
                  if (stage === 'annotate') step = 2;
                  else if (stage === 'analyze') step = 3;
                  navigate(`/inspections/${inspectionId}/workflow?step=${step}`);
                }
              }}
              onEditCampaign={role !== 'supervisor' ? setEditingCampaign : undefined}
              onDeleteCampaign={role !== 'supervisor' ? handleDeleteCampaign : undefined}
              filterBySubasset={filterSubasset}
              onClearFilter={() => setFilterSubasset(null)}
            />
          </div>
        </div>
      )}

      {activeTab === 'defects' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={exportBarStyle}>
            <button
              type="button"
              aria-label={t('button.exportList')}
              style={exportBtnStyle}
              onClick={handleExportDefects}
            >
              <Download size={16} />
              {t('button.exportList')}
            </button>
          </div>
          <DefectsWindFarmTab defects={defectsWithImages} isLoading={defectsLoading} />
        </div>
      )}

      {/* Modals */}
      {windFarmId && (
        <>
          <TurbineSerialNumbersModal windFarmId={windFarmId} isOpen={showSerialModal} onClose={() => setShowSerialModal(false)} />
          {editingCampaign && (
            <EditCampaignModal
              campaign={editingCampaign}
              windFarmId={windFarmId}
              isOpen
              onClose={() => setEditingCampaign(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = { height: '100%', display: 'flex', flexDirection: 'column' };
const headerStyle: React.CSSProperties = { padding: 'var(--space-4) var(--space-4) 0' };
const pageTitleStyle: React.CSSProperties = { fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-neutral-900)', margin: 0 };
const contentStyle: React.CSSProperties = { display: 'flex', flex: 1, overflow: 'hidden' };
const leftColStyle: React.CSSProperties = { width: '35%', minWidth: '300px', overflowY: 'auto', borderRight: '1px solid var(--color-neutral-200)' };
const rightColStyle: React.CSSProperties = { flex: 1, overflowY: 'auto' };

const exportBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid rgb(229, 231, 235)',
  backgroundColor: 'rgb(255, 255, 255)',
};
const exportBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-4)',
  backgroundColor: '#4CAF50',
  color: 'rgb(255, 255, 255)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-family-sans)',
  fontWeight: 600,
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast) var(--easing-default)',
  letterSpacing: '0.025em',
  whiteSpace: 'nowrap',
};
