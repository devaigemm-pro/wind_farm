import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/molecules';
import { TablePagination } from '@/components/molecules/TablePagination';
import { DefectsTable } from './DefectsTable';
import { DefectDetailSidebar } from './DefectDetailSidebar';
import { DefectCompareViewer } from './DefectCompareViewer';
import { useDefectsDashboard } from '@/hooks/useDefectsDashboard';
import { useDefectResolvedToggle } from '@/hooks/useDefectResolvedToggle';
import { useDefectUpdate } from '@/hooks/useDefectUpdate';
import { useDefectDelete } from '@/hooks/useDefectDelete';
import { useAddDefectComment } from '@/hooks/useDefectComments';
import type { DefectSortField } from '@/types';

export interface DefectsWindFarmsViewProps {
  searchQuery: string;
}

export function DefectsWindFarmsView({ searchQuery }: DefectsWindFarmsViewProps) {
  const [sortField, setSortField] = useState<DefectSortField>('assetName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showCompare, setShowCompare] = useState(false);

  // Map DefectSortField to RPC field names
  const sortFieldMap: Record<DefectSortField, string> = {
    assetName: 'asset_name',
    turbineName: 'turbine_name',
    turbineModel: 'turbine_model',
    type: 'type',
    defectSize: 'defect_size',
    category: 'category',
    action: 'asset_name', // fallback
    nextStep: 'next_step',
    blade: 'blade',
    side: 'side',
    rootDistance: 'root_distance',
    resolved: 'resolved',
  };

  const { data: result, isLoading } = useDefectsDashboard({
    search: searchQuery,
    page,
    rowsPerPage,
    sortField: sortFieldMap[sortField],
    sortDir: sortDirection,
  });

  const toggleResolved = useDefectResolvedToggle();
  const updateDefect = useDefectUpdate();
  const deleteDefect = useDefectDelete();
  const addComment = useAddDefectComment();

  const defects = result?.data ?? [];
  const totalCount = result?.totalCount ?? 0;

  // Auto-select first defect on data load
  useEffect(() => {
    if (defects.length > 0 && (!selectedId || !defects.find((d) => d.id === selectedId))) {
      setSelectedId(defects[0]!.id);
    }
  }, [defects, selectedId]);

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const selectedDefect = defects.find((d) => d.id === selectedId) ?? null;

  const handleSort = useCallback((field: DefectSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDirection('asc');
      }
      return field;
    });
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((rows: number) => {
    setRowsPerPage(rows);
    setPage(1);
  }, []);

  const handleResolvedToggle = useCallback((id: string, resolved: boolean) => {
    toggleResolved.mutate({ id, resolved });
  }, [toggleResolved]);

  const handleDefectUpdate = useCallback((id: string, data: { type: string; category: number; rootDistance: number; side: string; notes: string; rootCause: string; nextStep: string }) => {
    updateDefect.mutate({ id, ...data });
  }, [updateDefect]);

  const handleDefectDelete = useCallback((id: string) => {
    deleteDefect.mutate(id, {
      onSuccess: () => {
        setSelectedId(null);
      },
    });
  }, [deleteDefect]);

  const handleDefectClose = useCallback((id: string) => {
    addComment.mutate({ defectId: id, text: 'Defect closed' });
  }, [addComment]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 4.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleCompare = useCallback(() => {
    setShowCompare(true);
  }, []);

  // Reset zoom when selecting a different defect
  useEffect(() => {
    setZoomLevel(1.0);
  }, [selectedId]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  };

  const leftPanelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: defects.length > 0 ? '0 0 70%' : '1 1 100%',
    overflow: 'hidden',
    minHeight: 0,
  };

  const rightPanelStyle: React.CSSProperties = {
    flex: '0 0 30%',
    overflow: 'auto',
    minHeight: 0,
  };

  // Empty state
  if (!isLoading && totalCount === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
        <EmptyState
          icon={AlertTriangle}
          title="No defects found"
          description={searchQuery ? 'Try adjusting your search to find defects.' : 'No defects have been registered yet.'}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Left Panel - Table */}
      <div style={leftPanelStyle}>
        <DefectsTable
          data={defects}
          isLoading={isLoading}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggleResolved={handleResolvedToggle}
          skeletonRows={rowsPerPage}
        />
        {!isLoading && (
          <div style={{ backgroundColor: 'var(--color-neutral-0)', borderTop: '1px solid #E5E7EB' }}>
            <TablePagination
              page={page}
              rowsPerPage={rowsPerPage}
              totalCount={totalCount}
              rowsPerPageOptions={[5, 10, 25, 100]}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </div>
        )}
      </div>

      {/* Right Panel - Detail Sidebar */}
      {defects.length > 0 && (
        <div style={rightPanelStyle}>
          <DefectDetailSidebar
            defect={selectedDefect}
            onResolvedToggle={handleResolvedToggle}
            onDefectUpdate={handleDefectUpdate}
            onDefectDelete={handleDefectDelete}
            onDefectClose={handleDefectClose}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onCompare={handleCompare}
          />
        </div>
      )}

      {/* Compare Viewer Overlay */}
      {showCompare && selectedDefect && (
        <DefectCompareViewer
          onClose={() => setShowCompare(false)}
          currentImage={selectedDefect.imageUrl || ''}
          currentDate={new Date().toISOString()}
          defectType={selectedDefect.type}
          defectSeverity={selectedDefect.category}
          distanceFromRoot={selectedDefect.rootDistance}
          side={selectedDefect.side}
          blade={selectedDefect.bladePosition}
          bladeId={selectedDefect.bladeId}
          inspectionId={selectedDefect.inspectionId}
        />
      )}
    </div>
  );
}
