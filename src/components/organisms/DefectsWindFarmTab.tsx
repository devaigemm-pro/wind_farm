import { useState, useEffect, useCallback } from 'react';
import { DefectsTable } from './DefectsTable';
import { DefectDetailSidebar } from './DefectDetailSidebar';
import { useLanguage } from '@/components/design-system';
import { useDefectResolvedToggle } from '@/hooks/useDefectResolvedToggle';
import { useDefectUpdate } from '@/hooks/useDefectUpdate';
import { useDefectDelete } from '@/hooks/useDefectDelete';
import { useAddDefectComment } from '@/hooks/useDefectComments';
import type { DefectSortField, DefectDashboardRow } from '@/types';

export interface DefectsWindFarmTabProps {
  defects: DefectDashboardRow[];
  isLoading: boolean;
}

export function DefectsWindFarmTab({ defects, isLoading }: DefectsWindFarmTabProps) {
  const { t } = useLanguage();
  const [sortField, setSortField] = useState<DefectSortField>('turbineName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const toggleResolved = useDefectResolvedToggle();
  const updateDefect = useDefectUpdate();
  const deleteDefect = useDefectDelete();
  const addComment = useAddDefectComment();

  // Auto-select first defect on data load
  useEffect(() => {
    if (defects.length > 0 && (!selectedId || !defects.find((d) => d.id === selectedId))) {
      setSelectedId(defects[0]!.id);
    }
  }, [defects, selectedId]);

  // Reset zoom when selecting a different defect
  useEffect(() => {
    setZoomLevel(1.0);
  }, [selectedId]);

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
    addComment.mutate({ defectId: id, text: t('defects.closed') });
  }, [addComment, t]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 4.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

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
        />
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
            onCompare={() => setShowFullscreen(true)}
          />
        </div>
      )}

      {/* Fullscreen overlay */}
      {showFullscreen && selectedDefect?.imageUrl && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => setShowFullscreen(false)}
        >
          <img src={selectedDefect.imageUrl} alt="Defect fullscreen" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '4px' }} />
        </div>
      )}
    </div>
  );
}
