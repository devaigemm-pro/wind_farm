import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useOngoingInspections } from '@/hooks/useOngoingInspections';
import { useLanguage } from '@/components/design-system';

const STAGE_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  planned: { label: 'Planned', color: 'border-blue-200', dotColor: 'bg-blue-500' },
  inspect: { label: 'Inspect', color: 'border-amber-200', dotColor: 'bg-amber-500' },
  annotate: { label: 'Annotate', color: 'border-orange-200', dotColor: 'bg-orange-500' },
  analyze: { label: 'Analyze', color: 'border-purple-200', dotColor: 'bg-purple-500' },
  report: { label: 'Complete', color: 'border-green-200', dotColor: 'bg-green-500' },
};

export function OngoingInspectionsV2() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data, isLoading } = useOngoingInspections();

  // Flatten all items grouped by stage
  const stageGroups = useMemo(() => {
    if (!data) return {};
    const groups: Record<string, { windFarmName: string; id: string; turbineName: string; scheduledDate: string; stage: string; inspectionId: string }[]> = {};
    for (const [stage, farms] of Object.entries(data)) {
      if (!groups[stage]) groups[stage] = [];
      for (const farm of farms as any[]) {
        for (const item of farm.items) {
          groups[stage]!.push({
            windFarmName: farm.windFarmName,
            id: item.id,
            turbineName: item.turbineName || item.subassetName || '—',
            scheduledDate: item.scheduledDate || item.date || '—',
            stage,
            inspectionId: item.inspectionId || item.id,
          });
        }
      }
    }
    return groups;
  }, [data]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-48 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const stages = ['planned', 'inspect', 'annotate', 'analyze', 'report'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Ongoing Inspections</h1>
        <button
          onClick={() => navigate('/inspections/new')}
          className="px-3 py-1.5 text-xs text-white bg-[#5A8F5A] rounded-md hover:bg-[#4a7a4a] transition font-medium"
        >
          + New Inspection
        </button>
      </div>

      {/* Kanban-style columns */}
      <div className="grid grid-cols-5 gap-3">
        {stages.map(stage => {
          const config = STAGE_CONFIG[stage] || { label: stage, color: 'border-gray-200', dotColor: 'bg-gray-500' };
          const items = stageGroups[stage] || [];

          return (
            <div key={stage}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-2 h-2 rounded-full', config.dotColor)} />
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {config.label} ({items.length})
                </h3>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="bg-white rounded-lg border border-dashed border-gray-200 p-4 text-center">
                    <p className="text-[10px] text-gray-400">No inspections</p>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      onClick={() => navigate(`/inspections/${item.inspectionId}/workflow`)}
                      className={cn(
                        'bg-white rounded-lg border shadow-sm p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150',
                        config.color
                      )}
                    >
                      <p className="text-xs font-medium text-gray-900 truncate">{item.turbineName}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{item.windFarmName}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {item.scheduledDate !== '—' ? new Date(item.scheduledDate).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
