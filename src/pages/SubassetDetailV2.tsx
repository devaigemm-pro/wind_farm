import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentDropbox } from '@/components/organisms/DocumentDropbox';
import { DefectsWindFarmTab } from '@/components/organisms/DefectsWindFarmTab';
import { useTurbineDetail, useTurbineInspections, useTurbineDefects, useDefectImages } from '@/hooks/useWindFarmDetail';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';

export function SubassetDetailV2() {
  const { windFarmId, turbineId } = useParams<{ windFarmId: string; turbineId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();

  const { data: detail, isLoading: detailLoading } = useTurbineDetail(turbineId);
  const { data: inspections, isLoading: inspectionsLoading } = useTurbineInspections(turbineId);
  const { data: defects, isLoading: defectsLoading } = useTurbineDefects(turbineId);

  const defectIds = useMemo(() => (defects ?? []).map(d => d.id), [defects]);
  const { data: defectImageMap } = useDefectImages(defectIds);
  const defectsWithImages = useMemo(() => {
    if (!defects) return [];
    if (!defectImageMap) return defects;
    return defects.map(d => {
      const imgData = defectImageMap[d.id];
      if (!imgData) return d;
      return { ...d, imageUrl: imgData.url ?? d.imageUrl, annotX: imgData.annotX, annotY: imgData.annotY, annotW: imgData.annotW, annotH: imgData.annotH, annotAngle: imgData.annotAngle };
    });
  }, [defects, defectImageMap]);

  const [activeTab, setActiveTab] = useState<'inspections' | 'defects' | 'documents'>('inspections');

  const STATUS_COLORS: Record<string, string> = {
    planned: 'bg-blue-50 text-blue-700',
    inspect: 'bg-amber-50 text-amber-700',
    annotate: 'bg-orange-50 text-orange-700',
    analyze: 'bg-purple-50 text-purple-700',
    report: 'bg-green-50 text-green-700',
  };

  if (detailLoading) {
    return <div className="animate-pulse"><div className="h-32 bg-gray-100 rounded-xl" /></div>;
  }

  const turbineName = (detail as any)?.name || '—';
  const model = (detail as any)?.model || '—';
  const powerKw = (detail as any)?.power_kw;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/assets-wind/${windFarmId}`)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft size={14} /> Back
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900">{turbineName}</h1>
      </div>

      {/* Hero Card */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center gap-6">
          {/* Health gauge placeholder */}
          <div className="flex-shrink-0">
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r="28" fill="none" stroke="#e5e7eb" strokeWidth="7" />
              <circle cx="35" cy="35" r="28" fill="none" stroke="#5A8F5A" strokeWidth="7" strokeDasharray="137 176" strokeLinecap="round" transform="rotate(-90 35 35)" />
              <text x="35" y="39" textAnchor="middle" className="text-xs font-bold" fill="#111827">78%</text>
            </svg>
          </div>
          <div className="flex-1 grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Model</p>
              <p className="text-sm font-medium text-gray-900">{model}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Power</p>
              <p className="text-sm font-medium text-gray-900">{powerKw ? `${powerKw} kW` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Inspections</p>
              <p className="text-sm font-medium text-gray-900">{inspections?.length ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Defects</p>
              <p className="text-sm font-medium text-red-600">{defects?.length ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {(['inspections', 'defects', 'documents'] as const).map(tab => (
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
      {activeTab === 'inspections' && (
        <div className="space-y-3">
          {inspectionsLoading ? (
            <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
          ) : (inspections ?? []).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <p className="text-sm text-gray-500">No inspections yet</p>
              <button onClick={() => navigate(`/inspections/new?windFarm=${windFarmId}`)} className="mt-3 px-3 py-1.5 text-xs bg-[#5A8F5A] text-white rounded-md font-medium">
                Plan Inspection
              </button>
            </div>
          ) : (
            (inspections ?? []).map((insp: any) => (
              <div
                key={insp.id}
                onClick={() => navigate(`/inspections/${insp.id}/workflow`)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-10 rounded-full bg-[#5A8F5A]" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {insp.scheduledDate ? new Date(insp.scheduledDate).toLocaleDateString() : insp.inspectionDate ? new Date(insp.inspectionDate).toLocaleDateString() : '—'}
                    </p>
                    <p className="text-[10px] text-gray-500">{insp.photosCount ?? 0} photos • {insp.defectsCount ?? 0} defects</p>
                  </div>
                </div>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[insp.stage] || 'bg-gray-100 text-gray-600')}>
                  ● {insp.stage?.charAt(0).toUpperCase() + insp.stage?.slice(1) || 'Planned'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'defects' && (
        <DefectsWindFarmTab
          defects={defectsWithImages}
          isLoading={defectsLoading}
        />
      )}

      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <DocumentDropbox windFarmId={windFarmId!} />
        </div>
      )}
    </div>
  );
}
