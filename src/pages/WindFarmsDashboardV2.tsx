import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWindFarmsDashboard } from '@/hooks/useWindFarmsDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';

export function WindFarmsDashboardV2() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();

  const SUPERVISOR_ALLOWED_FARMS = ['f0000000-0001-4000-8000-000000000001'];

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const { data: rawData, isLoading } = useWindFarmsDashboard();

  const filteredData = useMemo(() => {
    if (!rawData) return [];
    let data = rawData;
    if (role === 'supervisor') {
      data = data.filter((row) => SUPERVISOR_ALLOWED_FARMS.includes(row.id));
    }
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter((row) => row.name.toLowerCase().includes(query));
  }, [rawData, searchQuery, role]);

  const totalTurbines = filteredData.reduce((s, f) => s + f.subAssetsCount, 0);
  const totalInspections = filteredData.reduce((s, f) => s + f.inspectionsCount, 0);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Wind Farms</h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('px-2.5 py-1.5 text-xs', viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn('px-2.5 py-1.5 text-xs border-l border-gray-200', viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20 focus:border-[#5A8F5A]"
          />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500">Total Farms</span>
          <p className="text-xl font-bold text-gray-900 mt-1">{filteredData.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500">Online Turbines</span>
          <p className="text-xl font-bold text-gray-900 mt-1">{totalTurbines}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500">Inspections</span>
          <p className="text-xl font-bold text-amber-600 mt-1">{totalInspections}</p>
        </div>
      </div>

      {/* Card Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredData.map((farm) => (
            <div
              key={farm.id}
              onClick={() => navigate(`/assets-wind/${farm.id}`)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
            >
              <div className="h-28 bg-gradient-to-br from-[#5A8F5A]/5 to-[#5A8F5A]/15 flex items-center justify-center">
                <Wind size={40} className="text-[#5A8F5A] opacity-40" strokeWidth={1} />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm">{farm.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{farm.subAssetsCount} turbines • {farm.totalPower ? `${(farm.totalPower / 1000).toFixed(1)} MW` : '—'}</p>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-500">{farm.inspectionsCount} inspections</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            <span>Name</span>
            <span>Turbines</span>
            <span>Power</span>
            <span>Inspections</span>
            <span>Last Inspection</span>
          </div>
          <div className="divide-y divide-gray-50">
            {filteredData.map((farm) => (
              <div
                key={farm.id}
                onClick={() => navigate(`/assets-wind/${farm.id}`)}
                className="grid grid-cols-5 gap-4 px-4 py-3 items-center hover:bg-gray-50/50 transition cursor-pointer"
              >
                <span className="text-sm font-medium text-gray-900">{farm.name}</span>
                <span className="text-sm text-gray-600">{farm.subAssetsCount}</span>
                <span className="text-sm text-gray-600">{farm.totalPower ? `${(farm.totalPower / 1000).toFixed(1)} MW` : '—'}</span>
                <span className="text-sm text-gray-600">{farm.inspectionsCount}</span>
                <span className="text-xs text-gray-500">{farm.oldestInspection ? new Date(farm.oldestInspection).toLocaleDateString() : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
