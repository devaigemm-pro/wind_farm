import { useParams, Link } from 'react-router-dom';
import { Search, Download, Share2, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { CategoryBadgesBar } from '@/components/molecules/CategoryBadgesBar';
import { SharePopover } from '@/components/molecules/SharePopover';
import { TurbineResultAccordion } from '@/components/organisms/TurbineResultAccordion';
import { CampaignCategoryChart } from '@/components/organisms/charts/CampaignCategoryChart';
import { CampaignTypeChart } from '@/components/organisms/charts/CampaignTypeChart';
import { CampaignMap } from '@/components/organisms/CampaignMap';
import { useCampaignResults } from '@/hooks/useCampaignResults';
import { useTurbineMarkers } from '@/hooks/useWindFarmDetail';
import { Skeleton } from '@/components/atoms/Skeleton';

// Defect image map by type
const DEFECT_IMAGES: Record<string, string> = {
  le_erosion: '/test-images/defect-erosion-wide.svg',
  oil: '/test-images/defect-oil-wide.svg',
  lightning_damage: '/test-images/defect-crack-wide.svg',
  other: '/test-images/defect-blade-wide.svg',
  crack: '/test-images/defect-crack-close.svg',
  vortex: '/test-images/defect-vortex-wide.svg',
  paint_defect: '/test-images/defect-paint-wide.svg',
  delamination: '/test-images/defect-delamination-wide.svg',
};

const BLADE_LABELS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

// ─── Component ──────────────────────────────────────────────────────────────

export function CampaignResults() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { data, isLoading } = useCampaignResults(campaignId);
  const [selectedTurbines, setSelectedTurbines] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [shareAnchor, setShareAnchor] = useState<HTMLElement | null>(null);

  const turbineResults = data?.turbineResults ?? [];
  const campaign = data?.campaign;

  // Fetch real turbine markers for the map
  const { data: turbineMarkers } = useTurbineMarkers(campaign?.windFarmId);

  const selectAll = selectedTurbines.size === turbineResults.length && turbineResults.length > 0;
  const hasSelection = selectedTurbines.size > 0;

  // Toggle single turbine (from map or checkbox)
  const handleTurbineToggle = (id: string) => {
    setSelectedTurbines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all / deselect all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTurbines(new Set(turbineResults.map((t) => t.turbineId)));
    } else {
      setSelectedTurbines(new Set());
    }
  };

  // Filter data based on selected turbines and search query
  const searchFilteredResults = useMemo(() => {
    if (!searchQuery.trim()) return turbineResults;
    const q = searchQuery.toLowerCase();
    return turbineResults.filter((t) => t.turbineName.toLowerCase().includes(q));
  }, [turbineResults, searchQuery]);

  const filteredTurbineResults = hasSelection
    ? searchFilteredResults.filter((t) => selectedTurbines.has(t.turbineId))
    : searchFilteredResults;

  const categoryChart = data?.categoryChart ?? [];
  const typeChart = data?.typeChart ?? [];
  const allDefects = data?.defects ?? [];

  const filteredCategoryChart = hasSelection
    ? categoryChart.filter((d) => {
        const match = turbineResults.find((t) => t.turbineName.replace('Turbine ', '') === d.turbine);
        return match && selectedTurbines.has(match.turbineId);
      })
    : categoryChart;

  const filteredTypeChart = hasSelection
    ? typeChart.filter((d) => {
        const match = turbineResults.find((t) => t.turbineName.replace('Turbine ', '') === d.turbine);
        return match && selectedTurbines.has(match.turbineId);
      })
    : typeChart;

  // Build defect gallery items for cat 4
  const defectGalleryItems = useMemo(() => {
    const cat4Defects = allDefects.filter((d) => d.severity === 4);
    const items = cat4Defects.map((d) => ({
      id: d.id,
      turbineId: d.turbineId,
      turbine: d.turbineName,
      blade: `Blade ${BLADE_LABELS[d.bladePosition] ?? d.bladePosition}`,
      type: d.type,
      dimensions: `${d.widthCm}cm x ${d.heightCm}cm`,
      distance: `${d.distanceFromRoot.toFixed(1)}m from hub`,
      imageUrl: DEFECT_IMAGES[d.type] ?? '/test-images/defect-blade-wide.svg',
    }));
    return items;
  }, [allDefects]);

  const filteredDefects = hasSelection
    ? defectGalleryItems.filter((d) => selectedTurbines.has(d.turbineId))
    : defectGalleryItems;

  // Export CSV handler
  const handleExportCsv = () => {
    const defectsToExport = hasSelection
      ? allDefects.filter((d) => selectedTurbines.has(d.turbineId))
      : allDefects;
    if (defectsToExport.length === 0) return;

    const headers = ['ID', 'Type', 'Category', 'Blade', 'Side', 'Distance from Root (m)', 'Width (cm)', 'Height (cm)', 'Resolved', 'Description', 'Photo URL'];
    const bladeCounters: Record<string, number> = {};
    const rows = defectsToExport.map((d) => {
      const bladeLabel = BLADE_LABELS[d.bladePosition] ?? String(d.bladePosition);
      bladeCounters[bladeLabel] = (bladeCounters[bladeLabel] ?? 0) + 1;
      const id = `${bladeLabel}${bladeCounters[bladeLabel]}`;
      const imgPath = DEFECT_IMAGES[d.type] ?? '/test-images/defect-blade-wide.svg';
      const photoUrl = `${window.location.origin}${imgPath}`;
      return [
        id,
        d.type.toUpperCase().replace(/_/g, ' '),
        d.severity,
        bladeLabel,
        d.side,
        d.distanceFromRoot.toFixed(1),
        d.widthCm,
        d.heightCm,
        'false',
        d.description ?? '',
        photoUrl,
      ];
    });

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Defects-${campaign?.windFarmName ?? 'export'}-${campaign?.name ?? 'campaign'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute filtered summary
  const filteredSummary = hasSelection
    ? filteredTurbineResults.reduce(
        (acc, t) => {
          for (const cat of [1, 2, 3, 4, 5]) acc[cat] = (acc[cat] ?? 0) + (t.defectsByCat[cat] ?? 0);
          return acc;
        },
        {} as Record<number, number>,
      )
    : (data?.summary ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const filteredTotal = hasSelection
    ? filteredTurbineResults.reduce((s, t) => s + t.totalDefects, 0)
    : (data?.totalDefects ?? 0);
  const filteredResolved = hasSelection
    ? filteredTurbineResults.reduce((s, t) => s + t.resolvedCount, 0)
    : (data?.resolvedCount ?? 0);

  // Loading state
  if (isLoading) {
    return (
      <div style={pageContainer}>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Skeleton variant="text" width="300px" height="24px" />
          <Skeleton variant="rect" width="100%" height="300px" />
          <Skeleton variant="rect" width="100%" height="200px" />
        </div>
      </div>
    );
  }

  // Empty state (no campaign or no data)
  if (!campaign) {
    return (
      <div style={pageContainer}>
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-neutral-500)' }}>
          <p>Campaign not found or has no inspection data yet.</p>
          <Link to="/" style={{ color: 'var(--color-primary-500)' }}>Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const campaignDate = new Date(campaign.createdAt).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div style={pageContainer}>
      {/* ─── Toolbar ─────────────────────────────────────────────── */}
      <div style={toolbar}>
        <div style={toolbarLeft}>
          <div style={breadcrumbRow}>
            <Link to={`/assets-wind/${campaign.windFarmId}`} style={breadcrumbLink}>
              {campaign.windFarmName}
            </Link>
            <ChevronRight size={14} color="var(--color-neutral-400)" />
            <span style={breadcrumbCurrent}>{campaign.name}</span>
          </div>
          <p style={subtitleStyle}>Campaign of {campaignDate}</p>
        </div>
        <div style={toolbarRight}>
          <div style={searchBarStyle}>
            <Search size={14} color="var(--color-neutral-400)" />
            <input
              type="text"
              placeholder="Search all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />
          </div>
          <button style={primaryBtn} onClick={handleExportCsv}>
            <Download size={14} />
            <span>Export CSV for all turbines</span>
          </button>
          <button style={shareBtn} onClick={(e) => setShareAnchor(e.currentTarget)}>
            <Share2 size={14} />
            <span>Share</span>
          </button>
          <SharePopover
            anchorEl={shareAnchor}
            open={Boolean(shareAnchor)}
            onClose={() => setShareAnchor(null)}
            shareKey={`campaign-${campaignId}`}
          />
        </div>
      </div>

      {/* Empty results state */}
      {turbineResults.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-neutral-500)' }}>
          <p>No inspections assigned to this campaign yet.</p>
          <Link to={`/assets-wind/${campaign.windFarmId}`} style={{ color: 'var(--color-primary-500)' }}>
            Go to wind farm detail to assign inspections
          </Link>
        </div>
      ) : (
        /* ─── Main Content (2 columns) ────────────────────────────── */
        <div style={mainContent}>
          {/* LEFT COLUMN: Map + Charts */}
          <div style={leftColumn}>
            {/* Map */}
            <div style={mapPanel}>
              <div style={mapToolbar}>
                <label style={selectAllLabel}>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                  <span>Select all</span>
                </label>
              </div>
              <CampaignMap
                turbines={turbineMarkers && turbineMarkers.length > 0 ? turbineMarkers.map((m) => ({ id: m.id, name: m.name, lat: m.lat, lon: m.lon })) : undefined}
                selectedTurbineIds={selectedTurbines}
                onTurbineClick={handleTurbineToggle}
              />
            </div>

            {/* Charts side by side */}
            <div style={chartsRow}>
              <div style={chartPanel}>
                <h4 style={chartTitle}>Turbine defect category repartition</h4>
                <CampaignCategoryChart data={filteredCategoryChart} />
              </div>
              <div style={chartPanel}>
                <h4 style={chartTitle}>Turbine defect type repartition</h4>
                <CampaignTypeChart data={filteredTypeChart as unknown as Array<{ turbine: string; [key: string]: string | number }>} />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Summary + Accordion + Gallery */}
          <div style={rightColumn}>
            {/* Severity summary + alert */}
            <CategoryBadgesBar
              defectsByCat={filteredSummary}
              resolvedCount={filteredResolved}
              totalDefects={filteredTotal}
            />

            {/* Turbine Accordions */}
            <div style={turbineList}>
              {turbineResults.map((result) => (
                <div
                  key={result.turbineId}
                  style={{
                    borderLeft: selectedTurbines.has(result.turbineId) ? '3px solid #FF5500' : '3px solid transparent',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <TurbineResultAccordion
                    result={result}
                    isSelected={selectedTurbines.has(result.turbineId)}
                    onCheckboxToggle={handleTurbineToggle}
                  />
                </div>
              ))}
            </div>

            {/* Image Gallery */}
            <div style={gallerySection}>
              {/* Info banner (shown when turbine selected) */}
              {hasSelection && (
                <div style={infoBanner}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0288D1">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                  <span style={infoBannerText}>Only the defects of the selected turbines are displayed</span>
                </div>
              )}

              {filteredDefects.length > 0 && (
                <>
                  <div style={gallerySeparator}>
                    <span style={gallerySepText}>Category 4</span>
                    <div style={gallerySepLine} />
                  </div>
                  <div style={galleryGrid}>
                    {filteredDefects.map((defect) => (
                      <a
                        key={defect.id}
                        href={`/assets-wind/${campaign.windFarmId}/turbine/${defect.turbineId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={imageCard}
                      >
                        <img
                          src={defect.imageUrl}
                          alt={`[Defect] ${defect.turbine} ${defect.blade}`}
                          style={imageImg}
                        />
                        <div style={imageOverlay}>
                          <span style={imageTitle}>{defect.turbine} {defect.blade}</span>
                          <div style={imageDescBlock}>
                            <span style={imageDesc}>{defect.type} | {defect.dimensions}</span>
                            <span style={imageDesc}>{defect.distance}</span>
                          </div>
                          <div style={imageLinkIcon}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3z"/>
                            </svg>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const pageContainer: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'var(--font-family-sans)',
};

const toolbar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid var(--color-neutral-200)',
  backgroundColor: 'var(--color-neutral-0)',
  flexShrink: 0,
};

const toolbarLeft: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '2px' };

const breadcrumbRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '1rem',
};

const breadcrumbLink: React.CSSProperties = {
  color: 'var(--color-primary-500)',
  textDecoration: 'none',
  fontWeight: 500,
};

const breadcrumbCurrent: React.CSSProperties = {
  color: 'var(--color-neutral-800)',
  fontWeight: 400,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-neutral-500)',
  margin: 0,
};

const toolbarRight: React.CSSProperties = { display: 'flex', gap: '8px', alignItems: 'center' };

const searchBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  backgroundColor: 'var(--color-neutral-0, #ffffff)',
  border: '1px solid var(--color-neutral-200, #e2e8f0)',
  borderRadius: 'var(--radius-lg, 12px)',
  padding: '6px 12px',
  width: '200px',
};

const searchInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--color-neutral-800, #1e293b)',
  fontSize: 'var(--text-sm, 0.875rem)',
  width: '100%',
  fontFamily: 'var(--font-family-sans)',
};

const outlinedBtn: React.CSSProperties = {
  border: '1px solid var(--color-primary-500)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  padding: '6px 10px',
  cursor: 'pointer',
  color: 'var(--color-primary-500)',
  display: 'flex',
  alignItems: 'center',
};

const primaryBtn: React.CSSProperties = {
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: '#4CAF50',
  color: 'white',
  padding: '7px 14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.8rem',
  fontWeight: 500,
};

const shareBtn: React.CSSProperties = {
  ...primaryBtn,
  backgroundColor: '#4CAF50',
};

const mainContent: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const leftColumn: React.CSSProperties = {
  width: '42%',
  minWidth: '360px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  borderRight: '1px solid var(--color-neutral-200)',
};

const rightColumn: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  padding: '12px 16px',
  gap: '12px',
};

const mapPanel: React.CSSProperties = {
  flex: 1,
  minHeight: '260px',
  position: 'relative',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const mapToolbar: React.CSSProperties = {
  position: 'absolute',
  top: '8px',
  left: '8px',
  zIndex: 10,
  backgroundColor: 'rgba(255,255,255,0.9)',
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  boxShadow: 'var(--shadow-sm)',
};

const selectAllLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.75rem',
  cursor: 'pointer',
};

const chartsRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  borderTop: '1px solid var(--color-neutral-200)',
};

const chartPanel: React.CSSProperties = {
  padding: '12px',
  borderRight: '1px solid var(--color-neutral-200)',
};

const chartTitle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-neutral-800)',
  margin: '0 0 8px',
};

const turbineList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const gallerySection: React.CSSProperties = {
  marginTop: '16px',
};

const gallerySeparator: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '12px',
};

const gallerySepText: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 600,
  color: '#FF5500',
  whiteSpace: 'nowrap',
};

const gallerySepLine: React.CSSProperties = {
  flex: 1,
  height: '1px',
  backgroundColor: 'var(--color-neutral-200)',
};

const galleryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '8px',
};

const imageCard: React.CSSProperties = {
  position: 'relative',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  aspectRatio: '4/3',
  backgroundColor: 'var(--color-neutral-200)',
  display: 'block',
  textDecoration: 'none',
};

const imageImg: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const imageOverlay: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '8px 10px',
  background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const imageTitle: React.CSSProperties = {
  color: 'white',
  fontSize: '0.7rem',
  fontWeight: 700,
};

const imageDescBlock: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
};

const imageDesc: React.CSSProperties = {
  color: 'rgba(255,255,255,0.85)',
  fontSize: '0.6rem',
};

const imageLinkIcon: React.CSSProperties = {
  position: 'absolute',
  bottom: '8px',
  right: '8px',
};

const infoBanner: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 14px',
  backgroundColor: '#E3F2FD',
  borderRadius: 'var(--radius-sm)',
  marginBottom: '12px',
};

const infoBannerText: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--color-neutral-800)',
};
