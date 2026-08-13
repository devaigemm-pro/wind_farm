import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { Button, Badge, Skeleton } from '@/components/atoms';
import { FilterChip, EmptyState } from '@/components/molecules';
import { useInspections } from '@/hooks/useInspections';
import { useLanguage } from '@/components/design-system';
import type { InspectionFilters } from '@/services/inspections.service';
import type { InspectionStatus } from '@/types';
import type { BadgeVariant } from '@/components/atoms';
import { INSPECTION_STATUSES } from '@/types';

type SortField = 'created_at' | 'scheduled_date' | 'status';
type SortDirection = 'asc' | 'desc';

const STATUS_BADGE_MAP: Record<InspectionStatus, BadgeVariant> = {
  in_progress: 'info',
  completed: 'success',
  approved: 'neutral',
};

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function Inspections() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const STATUS_LABELS: Record<InspectionStatus, string> = {
    in_progress: t('status.inProgress'),
    completed: t('status.completed'),
    approved: t('status.approved'),
  };

  // Filter state
  const [filters, setFilters] = useState<InspectionFilters>({});
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Sort state
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter input state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useInspections(filters, page, pageSize);

  const inspections = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Active filter chips
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (filters.status) {
      chips.push({ key: 'status', label: `Status: ${STATUS_LABELS[filters.status]}` });
    }
    if (filters.dateFrom) {
      chips.push({ key: 'dateFrom', label: `From: ${filters.dateFrom}` });
    }
    if (filters.dateTo) {
      chips.push({ key: 'dateTo', label: `To: ${filters.dateTo}` });
    }
    return chips;
  }, [filters]);

  const handleApplyFilters = useCallback(() => {
    const newFilters: InspectionFilters = {};
    if (statusFilter) newFilters.status = statusFilter as InspectionStatus;
    if (dateFrom) newFilters.dateFrom = dateFrom;
    if (dateTo) newFilters.dateTo = dateTo;
    setFilters(newFilters);
    setPage(1);
  }, [statusFilter, dateFrom, dateTo]);

  const handleRemoveFilter = useCallback(
    (key: string) => {
      const newFilters = { ...filters };
      if (key === 'status') {
        delete newFilters.status;
        setStatusFilter('');
      }
      if (key === 'dateFrom') {
        delete newFilters.dateFrom;
        setDateFrom('');
      }
      if (key === 'dateTo') {
        delete newFilters.dateTo;
        setDateTo('');
      }
      setFilters(newFilters);
      setPage(1);
    },
    [filters],
  );

  const handleClearAllFilters = useCallback(() => {
    setFilters({});
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField],
  );

  // Client-side sort (service returns ordered by created_at desc)
  const sortedInspections = useMemo(() => {
    const sorted = [...inspections];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'created_at') {
        comparison = (a.created_at ?? '').localeCompare(b.created_at ?? '');
      } else if (sortField === 'scheduled_date') {
        comparison = (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '');
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [inspections, sortField, sortDirection]);

  const handleRowClick = useCallback(
    (id: string) => {
      navigate(`/inspections/${id}`);
    },
    [navigate],
  );

  // Styles
  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-4)',
    borderBottom: '1px solid var(--color-neutral-100)',
    flexShrink: 0,
  };

  const headerTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--text-xl)',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
  };

  const filterBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: '1px solid var(--color-neutral-100)',
    flexWrap: 'wrap',
  };

  const filterInputStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-neutral-0)',
    color: 'var(--color-neutral-900)',
    height: '36px',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...filterInputStyle,
    minWidth: '140px',
    cursor: 'pointer',
  };

  const activeFiltersStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-4)',
    borderBottom: '1px solid var(--color-neutral-100)',
    flexWrap: 'wrap',
  };

  const tableContainerStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-4)',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--text-sm)',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: 'var(--space-3) var(--space-4)',
    fontWeight: 600,
    color: 'var(--color-neutral-600)',
    borderBottom: '2px solid var(--color-neutral-200)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: 'var(--space-3) var(--space-4)',
    color: 'var(--color-neutral-800)',
    borderBottom: '1px solid var(--color-neutral-100)',
  };

  const rowStyle: React.CSSProperties = {
    cursor: 'pointer',
    transition: `background-color var(--duration-fast) var(--easing-default)`,
  };

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4)',
    borderTop: '1px solid var(--color-neutral-100)',
    flexShrink: 0,
  };

  const pageIndicatorStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-600)',
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  // Loading skeleton — preserves full page structure
  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <h1 style={headerTitleStyle}>{t('page.inspections')}</h1>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => navigate('/inspections/new')}
          >
            {t('button.newInspection')}
          </Button>
        </div>
        <div style={filterBarStyle}>
          <Skeleton variant="rect" width="140px" height="36px" />
          <Skeleton variant="rect" width="140px" height="36px" />
          <Skeleton variant="rect" width="140px" height="36px" />
          <Skeleton variant="rect" width="80px" height="36px" />
        </div>
        <div style={tableContainerStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="rect" height="48px" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no results after filters applied or no inspections at all)
  const showEmptyState = !isLoading && inspections.length === 0;

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={headerTitleStyle}>{t('page.inspections')}</h1>
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => navigate('/inspections/new')}
        >
          {t('button.newInspection')}
        </Button>
      </div>

      {/* Filter Bar */}
      <div style={filterBarStyle}>
        <select
          style={selectStyle}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">{t('inspections.allStatuses')}</option>
          {INSPECTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <input
          type="date"
          style={filterInputStyle}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Filter from date"
          placeholder="From"
        />

        <input
          type="date"
          style={filterInputStyle}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Filter to date"
          placeholder="To"
        />

        <Button variant="secondary" size="sm" onClick={handleApplyFilters}>
          {t('button.apply')}
        </Button>
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div style={activeFiltersStyle}>
          {activeFilters.map((filter) => (
            <FilterChip
              key={filter.key}
              label={filter.label}
              selected
              onRemove={() => handleRemoveFilter(filter.key)}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={handleClearAllFilters}>
            {t('button.clearAll')}
          </Button>
        </div>
      )}

      {/* Content */}
      {showEmptyState ? (
        <EmptyState
          icon={ClipboardList}
          title={t('inspections.noFound')}
          description={
            activeFilters.length > 0
              ? t('inspections.noFoundFilterDesc')
              : t('inspections.noFoundDesc')
          }
          action={
            activeFilters.length === 0
              ? {
                  label: t('button.newInspection'),
                  onClick: () => navigate('/inspections/new'),
                }
              : undefined
          }
        />
      ) : (
        <>
          {/* Data Table */}
          <div style={tableContainerStyle}>
            <table style={tableStyle} role="grid" aria-label="Inspections list">
              <thead>
                <tr>
                  <th
                    style={thStyle}
                    onClick={() => handleSort('created_at')}
                    aria-sort={
                      sortField === 'created_at'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    {t('table.id')}{sortIndicator('created_at')}
                  </th>
                  <th style={{ ...thStyle, cursor: 'default' }}>{t('table.blade')}</th>
                  <th style={{ ...thStyle, cursor: 'default' }}>{t('table.farm')}</th>
                  <th
                    style={thStyle}
                    onClick={() => handleSort('scheduled_date')}
                    aria-sort={
                      sortField === 'scheduled_date'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    {t('table.date')}{sortIndicator('scheduled_date')}
                  </th>
                  <th
                    style={thStyle}
                    onClick={() => handleSort('status')}
                    aria-sort={
                      sortField === 'status'
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    {t('table.status')}{sortIndicator('status')}
                  </th>
                  <th style={{ ...thStyle, cursor: 'default' }}>{t('table.inspector')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedInspections.map((inspection) => (
                  <tr
                    key={inspection.id}
                    style={rowStyle}
                    onClick={() => handleRowClick(inspection.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(inspection.id);
                      }
                    }}
                    tabIndex={0}
                    role="row"
                    aria-label={`Inspection ${truncateId(inspection.id)}`}
                  >
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>
                      {truncateId(inspection.id)}
                    </td>
                    <td style={tdStyle}>
                      {inspection.blade?.serial_number ?? inspection.blade?.position ?? '—'}
                    </td>
                    <td style={tdStyle}>
                      {inspection.blade?.turbine?.wind_farm?.name ?? '—'}
                    </td>
                    <td style={tdStyle}>
                      {inspection.scheduled_date
                        ? new Date(inspection.scheduled_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      <Badge variant={STATUS_BADGE_MAP[inspection.status]}>
                        {STATUS_LABELS[inspection.status]}
                      </Badge>
                    </td>
                    <td style={tdStyle}>
                      {inspection.inspector?.name ?? inspection.inspector?.email ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination — always rendered to prevent layout shift */}
          <div style={paginationStyle}>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
            />
            <span style={pageIndicatorStyle}>
              {t('inspections.page')} {page} {t('general.of')} {totalPages || 1}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
            />
          </div>
        </>
      )}
    </div>
  );
}
