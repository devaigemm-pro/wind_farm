import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar, EmptyState } from '@/components/molecules';
import { TabBar } from '@/components/molecules/TabBar';
import { TablePagination } from '@/components/molecules/TablePagination';
import { WindFarmsTable } from '@/components/organisms/WindFarmsTable';
import { DefectsWindFarmsView } from '@/components/organisms/DefectsWindFarmsView';
import { GlobalMap } from '@/components/organisms/GlobalMap';
import { ExportButton } from '@/components/atoms/ExportButton';
import { useWindFarmsDashboard } from '@/hooks/useWindFarmsDashboard';
import { useWindFarms } from '@/hooks/useWindFarms';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import { defectsService } from '@/services/defects.service';
import { generateDefectsXLSX, downloadBlob } from '@/utils/csv-export';
import { Wind } from 'lucide-react';
import type { WindFarmSortField } from '@/components/organisms/WindFarmsTable';

export function WindFarmsDashboard() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();

  // Supervisor can only see specific wind farm(s)
  const SUPERVISOR_ALLOWED_FARMS = ['f0000000-0001-4000-8000-000000000001'];

  // Tab state
  const [activeTab, setActiveTab] = useState('assets');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<WindFarmSortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Data
  const { data: rawData, isLoading } = useWindFarmsDashboard();
  const { data: windFarmsForMap, isLoading: isLoadingMap } = useWindFarms();

  // Filter by search query and role
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

  // Sort
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'subAssetsCount':
          comparison = a.subAssetsCount - b.subAssetsCount;
          break;
        case 'inspectionsCount':
          comparison = a.inspectionsCount - b.inspectionsCount;
          break;
        case 'totalPower':
          comparison = a.totalPower - b.totalPower;
          break;
        case 'poweringDate':
          comparison = (a.poweringDate ?? '').localeCompare(b.poweringDate ?? '');
          break;
        case 'oldestInspection':
          comparison = (a.oldestInspection ?? '').localeCompare(b.oldestInspection ?? '');
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [filteredData, sortField, sortDirection]);

  // Paginate
  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);

  const totalCount = sortedData.length;

  // Handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  const handleSort = useCallback(
    (field: WindFarmSortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
      setPage(1);
    },
    [sortField],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((rows: number) => {
    setRowsPerPage(rows);
    setPage(1);
  }, []);

  // Export handler
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = await defectsService.exportDefectsList({ search: searchQuery });
      const blob = await generateDefectsXLSX(data);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `defects-export-${date}.xlsx`);
    } catch {
      // Error handled silently or via toast
    } finally {
      setExporting(false);
    }
  }, [searchQuery]);

  // Styles
  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    alignItems: 'center',
    padding: 'var(--space-4) var(--space-4) var(--space-3)',
    flexShrink: 0,
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--text-xl)',
    fontWeight: 700,
    color: '#111827',
    borderLeft: '4px solid #5A8F5A',
    paddingLeft: '12px',
  };

  const searchContainerStyle: React.CSSProperties = {
    width: '280px',
    justifySelf: 'center',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--color-neutral-0)',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    margin: '0 var(--space-4) var(--space-4)',
    overflow: 'hidden',
  };

  const tabPanelStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>{t('page.windFarms')}</h1>
        <div style={searchContainerStyle}>
          <SearchBar
            onSearch={handleSearch}
            placeholder={t('windFarms.searchPlaceholder')}
            debounceMs={300}
          />
        </div>
        <div />
      </div>

      {/* Content Card */}
      <div style={contentStyle}>
        {/* Tabs */}
        <TabBar tabs={[
          { id: 'assets', label: t('windFarms.tabAssets') },
          { id: 'defects', label: t('windFarms.tabDefects') },
          { id: 'globalMap', label: t('windFarms.tabGlobalMap') },
        ]} activeTab={activeTab} onChange={setActiveTab} />

        {/* Tab Panels */}
        {activeTab === 'assets' && (
          <div
            style={tabPanelStyle}
            role="tabpanel"
            id="tabpanel-assets"
            aria-labelledby="tab-assets"
          >
            {!isLoading && totalCount === 0 && searchQuery ? (
              <EmptyState
                icon={Wind}
                title={t('windFarms.noFound')}
                description={t('windFarms.noFoundDesc')}
              />
            ) : (
              <>
                <WindFarmsTable
                  data={paginatedData}
                  isLoading={isLoading}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onRowClick={(id) => navigate(`/assets-wind/${id}`)}
                  skeletonRows={rowsPerPage}
                />
                <TablePagination
                  page={page}
                  rowsPerPage={rowsPerPage}
                  totalCount={isLoading ? 0 : totalCount}
                  onPageChange={handlePageChange}
                  onRowsPerPageChange={handleRowsPerPageChange}
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'defects' && (
          <div
            style={tabPanelStyle}
            role="tabpanel"
            id="tabpanel-defects"
            aria-labelledby="tab-defects"
          >
            {/* Defects toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid #E5E7EB', backgroundColor: 'var(--color-neutral-0)' }}>
              <ExportButton onClick={handleExport} loading={exporting} />
            </div>
            <DefectsWindFarmsView searchQuery={searchQuery} />
          </div>
        )}

        {activeTab === 'globalMap' && (
          <div
            style={tabPanelStyle}
            role="tabpanel"
            id="tabpanel-globalMap"
            aria-labelledby="tab-globalMap"
          >
            <GlobalMap
              windFarms={(windFarmsForMap ?? []).filter((wf) => role !== 'supervisor' || SUPERVISOR_ALLOWED_FARMS.includes(wf.id))}
              isLoading={isLoadingMap}
              onWindFarmClick={(id) => navigate(`/assets-wind/${id}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
