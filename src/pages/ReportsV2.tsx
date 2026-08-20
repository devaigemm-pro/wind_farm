import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReports } from '@/hooks/useReports';
import { useLanguage } from '@/components/design-system';

export function ReportsV2() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: reports, isLoading } = useReports();

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter((r: any) =>
      r.turbineName?.toLowerCase().includes(q) ||
      r.windFarmName?.toLowerCase().includes(q)
    );
  }, [reports, searchQuery]);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('gallery')}
              className={cn('px-2.5 py-1.5 text-xs', viewMode === 'gallery' ? 'bg-gray-100 text-gray-900' : 'text-gray-500')}
            >Gallery</button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('px-2.5 py-1.5 text-xs border-l border-gray-200', viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500')}
            >List</button>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20"
          />
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <FileText size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-500">No reports available</p>
        </div>
      ) : viewMode === 'gallery' ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredReports.map((report: any) => (
            <div
              key={report.id}
              onClick={() => navigate(`/inspections/${report.id}/workflow?step=4`)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
            >
              <div className="h-24 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <FileText size={32} className="text-gray-300" />
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 text-sm">{report.turbineName || 'Report'}</h3>
                <p className="text-xs text-gray-500 mt-1">{report.windFarmName}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {report.completedAt ? new Date(report.completedAt).toLocaleDateString() : '—'}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
                  <Download size={12} className="text-[#5A8F5A]" />
                  <span className="text-[10px] text-[#5A8F5A] font-medium">Download PDF</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            <span>Turbine</span>
            <span>Wind Farm</span>
            <span>Date</span>
            <span>Photos</span>
            <span>Action</span>
          </div>
          <div className="divide-y divide-gray-50">
            {filteredReports.map((report: any) => (
              <div
                key={report.id}
                className="grid grid-cols-5 gap-4 px-4 py-3 items-center hover:bg-gray-50/50 transition"
              >
                <span className="text-sm font-medium text-gray-900">{report.turbineName || '—'}</span>
                <span className="text-sm text-gray-600">{report.windFarmName || '—'}</span>
                <span className="text-xs text-gray-500">{report.completedAt ? new Date(report.completedAt).toLocaleDateString() : '—'}</span>
                <span className="text-xs text-gray-500">{report.photosCount || '—'}</span>
                <button
                  onClick={() => navigate(`/inspections/${report.id}/workflow?step=4`)}
                  className="text-xs text-[#5A8F5A] font-medium hover:underline w-fit"
                >
                  View →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
