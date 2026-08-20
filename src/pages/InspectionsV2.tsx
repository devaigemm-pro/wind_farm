import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useInspections } from '@/hooks/useInspections';
import { useLanguage } from '@/components/design-system';
import type { InspectionStatus } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-50 text-blue-700',
  inspect: 'bg-amber-50 text-amber-700',
  annotate: 'bg-orange-50 text-orange-700',
  analyze: 'bg-purple-50 text-purple-700',
  report: 'bg-green-50 text-green-700',
};

export function InspectionsV2() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filters = statusFilter ? { status: statusFilter as InspectionStatus } : undefined;
  const { data, isLoading } = useInspections(filters, page, pageSize);

  const inspections = data?.data ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Status counts (derived from all data or could be separate query)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: total, planned: 0, inspect: 0, annotate: 0, report: 0 };
    inspections.forEach((insp: any) => {
      const stage = insp.stage || 'planned';
      counts[stage] = (counts[stage] || 0) + 1;
    });
    counts.all = total;
    return counts;
  }, [inspections, total]);

  const filteredInspections = useMemo(() => {
    if (!searchQuery.trim()) return inspections;
    const q = searchQuery.toLowerCase();
    return inspections.filter((insp: any) =>
      insp.turbineName?.toLowerCase().includes(q) ||
      insp.windFarmName?.toLowerCase().includes(q) ||
      insp.id?.toLowerCase().includes(q)
    );
  }, [inspections, searchQuery]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Inspections</h1>
        <button
          onClick={() => navigate('/inspections/new')}
          className="px-3 py-1.5 text-xs text-white bg-[#5A8F5A] rounded-md hover:bg-[#4a7a4a] transition font-medium"
        >
          + New Inspection
        </button>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { key: '', label: 'All', count: total, colorClass: 'border-[#5A8F5A]' },
          { key: 'planned', label: 'Planned', count: statusCounts.planned, colorClass: 'hover:border-blue-300' },
          { key: 'inspect', label: 'Inspect', count: statusCounts.inspect, colorClass: 'hover:border-amber-300' },
          { key: 'annotate', label: 'Annotate', count: statusCounts.annotate, colorClass: 'hover:border-orange-300' },
          { key: 'report', label: 'Complete', count: statusCounts.report, colorClass: 'hover:border-green-300' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => { setStatusFilter(s.key); setPage(1); }}
            className={cn(
              'bg-white rounded-lg p-3 border shadow-sm text-center transition',
              statusFilter === s.key ? `border-2 ${s.colorClass}` : 'border-gray-100 ' + s.colorClass
            )}
          >
            <p className={cn('text-lg font-bold', statusFilter === s.key ? 'text-[#5A8F5A]' : 'text-gray-900')}>{s.count}</p>
            <p className="text-[10px] text-gray-500 uppercase font-medium">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder="Search inspections..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-sm border-none outline-none flex-1 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-6 gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          <span>ID</span>
          <span>Wind Farm</span>
          <span>Turbine</span>
          <span>Date</span>
          <span>Photos</span>
          <span>Status</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {filteredInspections.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No inspections found</div>
          ) : (
            filteredInspections.map((insp: any) => (
              <div
                key={insp.id}
                onClick={() => navigate(`/inspections/${insp.id}/workflow`)}
                className="grid grid-cols-6 gap-4 px-4 py-3 items-center hover:bg-gray-50/50 transition cursor-pointer"
              >
                <span className="text-xs text-gray-500 font-mono">#{insp.id?.slice(0, 6)}</span>
                <span className="text-sm text-gray-900">{insp.windFarmName || '—'}</span>
                <span className="text-sm text-gray-900">{insp.turbineName || '—'}</span>
                <span className="text-xs text-gray-500">{insp.scheduled_date ? new Date(insp.scheduled_date).toLocaleDateString() : '—'}</span>
                <span className="text-xs text-gray-500">{insp.photos_count || '—'}</span>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full w-fit', STATUS_COLORS[insp.stage] || 'bg-gray-100 text-gray-600')}>
                  ● {insp.stage?.charAt(0).toUpperCase() + insp.stage?.slice(1) || 'Planned'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="w-7 h-7 flex items-center justify-center rounded text-xs text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >←</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn('w-7 h-7 flex items-center justify-center rounded text-xs', p === page ? 'bg-[#5A8F5A] text-white font-medium' : 'text-gray-600 hover:bg-gray-100')}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="w-7 h-7 flex items-center justify-center rounded text-xs text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >→</button>
          </div>
        </div>
      </div>
    </div>
  );
}
