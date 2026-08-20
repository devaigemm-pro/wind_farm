import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export function WindFarmDetailV2() {
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

  const defectIdsForImages = useMemo(() => (windFarmDefects ?? []).map(d => d.id), [windFarmDefects]);
  const { data: defectImageMap } = useDefectImages(defectIdsForImages);
  const defectsWithImages = useMemo(() => {
    if (!windFarmDefects) return [];
    if (!defectImageMap) return windFarmDefects;
    return windFarmDefects.map(d => {
      const imgData = defectImageMap[d.id];
      if (!imgData) return d;
      return { ...d, imageUrl: imgData.url ?? d.imageUrl, annotX: imgData.annotX, annotY: imgData.annotY, annotW: imgData.annotW, annotH: imgData.annotH, annotAngle: imgData.annotAngle };
    });
  }, [windFarmDefects, defectImageMap]);

  const [activeTab, setActiveTab] = useState<'overview' | 'turbines' | 'defects' | 'campaigns'>('overview');
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const handleViewResults = (campaignId: string) => navigate(`/campaigns/${campaignId}/results`);
  const handlePlanInspection = () => navigate(`/inspections/new?windFarm=${windFarmId}`);
  const handleTurbineClick = (turbineId: string) => navigate(`/assets-wind/${windFarmId}/subasset/${turbineId}`);

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm(t('windFarmDetail.deleteCampaign'))) return;
    try { await deleteCampaign.mutateAsync(campaignId); toast.success(t('toast.campaignDeleted')); }
    catch { toast.error(t('toast.campaignDeleteFailed')); }
  };

  const totalPower = detail?.totalPower ? `${(detail.totalPower / 1000).toFixed(1)} MW` : '—';
  const defectsCount = windFarmDefects?.length ?? 0;

  if (detailLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/assets-wind')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft size={14} /> Wind Farms
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900">{detail?.name || 'Wind Farm'}</h1>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500">Total Power</span>
          <p className="text-xl font-bold text-gray-900 mt-1">{totalPower}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500">Turbines</span>
          <p className="text-xl font-bold text-gray-900 mt-1">{subassets?.length ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500">Open Defects</span>
          <p className="text-xl font-bold text-red-600 mt-1">{defectsCount}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500">Campaigns</span>
          <p className="text-xl font-bold text-gray-900 mt-1">{campaigns?.length ?? 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {(['overview', 'turbines', 'defects', 'campaigns'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-2.5 text-sm font-medium transition',
                activeTab === tab ? 'text-[#5A8F5A] border-b-2 border-[#5A8F5A]' : 'text-gray-500 hover:text-gray-900'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Campaigns</h3>
            {campaigns && campaigns.length > 0 ? (
              <div className="space-y-2">
                {campaigns.slice(0, 3).map((c: Campaign) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => handleViewResults(c.id)}>
                    <div>
                      <p className="text-xs font-medium text-gray-900">{c.name}</p>
                      <p className="text-[10px] text-gray-500">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</p>
                    </div>
                    <span className="text-[10px] text-[#5A8F5A] font-medium">View →</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No campaigns yet</p>
            )}
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Documents</h3>
            <DocumentDropbox windFarmId={windFarmId!} />
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm col-span-2">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Turbines</h3>
            <div className="grid grid-cols-5 gap-3">
              {(subassets ?? []).slice(0, 5).map((t: TurbineSubassetRow) => (
                <div
                  key={t.id}
                  onClick={() => handleTurbineClick(t.id)}
                  className="p-3 rounded-lg border border-gray-100 hover:border-[#5A8F5A]/30 hover:bg-[#5A8F5A]/5 cursor-pointer transition"
                >
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{t.inspectionsCount ?? 0} inspections</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'turbines' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-4 gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            <span>Name</span>
            <span>Model</span>
            <span>Inspections</span>
            <span>Defects</span>
          </div>
          <div className="divide-y divide-gray-50">
            {(subassets ?? []).map((t: TurbineSubassetRow) => (
              <div
                key={t.id}
                onClick={() => handleTurbineClick(t.id)}
                className="grid grid-cols-4 gap-4 px-4 py-3 items-center hover:bg-gray-50/50 transition cursor-pointer"
              >
                <span className="text-sm font-medium text-gray-900">{t.name}</span>
                <span className="text-sm text-gray-600">{(t as any).model || '—'}</span>
                <span className="text-sm text-gray-600">{t.inspectionsCount ?? 0}</span>
                <span className="text-sm text-red-600">{(t as any).defectsCount ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'defects' && (
        <DefectsWindFarmTab
          defects={defectsWithImages}
          isLoading={defectsLoading}
        />
      )}

      {activeTab === 'campaigns' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <CampaignsPanel
            campaigns={campaigns ?? []}
            isLoading={campaignsLoading}
            onViewResults={handleViewResults}
            onDeleteCampaign={handleDeleteCampaign}
            onEditCampaign={(c: Campaign) => setEditingCampaign(c)}
          />
        </div>
      )}

      {/* Modals */}
      {showSerialModal && <TurbineSerialNumbersModal windFarmId={windFarmId!} isOpen={showSerialModal} onClose={() => setShowSerialModal(false)} />}
      {editingCampaign && <EditCampaignModal campaign={editingCampaign} windFarmId={windFarmId!} isOpen={!!editingCampaign} onClose={() => setEditingCampaign(null)} />}
    </div>
  );
}
