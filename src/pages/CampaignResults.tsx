import { useParams, Link } from 'react-router-dom';
import { Download, Share2, ChevronRight } from 'lucide-react';
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
import { useLanguage } from '@/components/design-system';
import { generateAndDownloadReport } from '@/services/reportPdf.service';
import { generateDefectsXLSX, downloadBlob } from '@/utils/csv-export';
import { supabase } from '@/lib/supabase';

// Defect images now come from evidence in the database

const BLADE_LABELS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

const CATEGORY_COLORS: Record<number, string> = {
  5: '#D32F2F',
  4: '#FF5500',
  3: '#FFA000',
  2: '#1976D2',
  1: '#388E3C',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CampaignResults() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { data, isLoading } = useCampaignResults(campaignId);
  const { t } = useLanguage();
  const [selectedTurbines, setSelectedTurbines] = useState<Set<string>>(new Set());
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

  // Filter data based on selected turbines
  const filteredTurbineResults = hasSelection
    ? turbineResults.filter((t) => selectedTurbines.has(t.turbineId))
    : turbineResults;

  const categoryChart = data?.categoryChart ?? [];
  const typeChart = data?.typeChart ?? [];
  const allDefects = data?.defects ?? [];
  const turbineInspectionMap = data?.turbineInspectionMap ?? {};

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

  // Build defect gallery items grouped by category (5→1)
  const defectsByCategory = useMemo(() => {
    const grouped: Record<number, Array<{
      id: string;
      inspectionId: string;
      turbineId: string;
      turbine: string;
      blade: string;
      type: string;
      dimensions: string;
      distance: string;
      imageUrl: string;
    }>> = {};

    for (const cat of [5, 4, 3, 2, 1]) {
      const catDefects = allDefects.filter((d) => d.severity === cat);
      if (catDefects.length > 0) {
        grouped[cat] = catDefects.map((d) => ({
          id: d.id,
          inspectionId: d.inspectionId,
          turbineId: d.turbineId,
          turbine: d.turbineName,
          blade: `Blade ${BLADE_LABELS[d.bladePosition] ?? d.bladePosition}`,
          type: d.type.replace(/_/g, ' '),
          dimensions: `${d.widthCm}cm x ${d.heightCm}cm`,
          distance: `${d.distanceFromRoot.toFixed(1)}m from hub`,
          imageUrl: d.imagePaths[0] ?? '',
        }));
      }
    }
    return grouped;
  }, [allDefects]);

  const filteredDefectsByCategory = useMemo(() => {
    if (!hasSelection) return defectsByCategory;
    const filtered: Record<number, typeof defectsByCategory[number]> = {};
    for (const [cat, items] of Object.entries(defectsByCategory)) {
      const catNum = Number(cat);
      const f = items.filter((d) => selectedTurbines.has(d.turbineId));
      if (f.length > 0) filtered[catNum] = f;
    }
    return filtered;
  }, [defectsByCategory, hasSelection, selectedTurbines]);

  // Export XLSX handler
  const handleExportCsv = async () => {
    const defectsToExport = hasSelection
      ? allDefects.filter((d) => selectedTurbines.has(d.turbineId))
      : allDefects;
    if (defectsToExport.length === 0) return;

    const rows = defectsToExport.map((d) => ({
      id: d.id,
      assetName: campaign?.windFarmName || '',
      turbineName: d.turbineName,
      turbineModel: '',
      type: d.type.toUpperCase().replace(/_/g, ' '),
      defectWidth: d.widthCm,
      defectHeight: d.heightCm,
      category: d.severity,
      actionText: '',
      actionUrgency: 'medium' as const,
      nextStep: d.description || '',
      bladePosition: String(BLADE_LABELS[d.bladePosition] ?? d.bladePosition),
      side: d.side,
      rootDistance: d.distanceFromRoot,
      rootCause: null,
      notes: null,
      imageUrl: null,
      resolved: false,
      inspectionId: '',
      bladeId: '',
    }));
    const blob = await generateDefectsXLSX(rows);
    downloadBlob(blob, `Defects-${campaign?.windFarmName ?? 'export'}-${campaign?.name ?? 'campaign'}.xlsx`);
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
          <p>{t('campaign.notFound')}</p>
          <Link to="/" style={{ color: 'var(--color-primary-500)' }}>{t('general.back')}</Link>
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
          <p style={subtitleStyle}>{t('campaign.campaignOf')} {campaignDate}</p>
        </div>
        <div style={toolbarRight}>
          <button style={primaryBtn} onClick={handleExportCsv}>
            <Download size={14} />
            <span>{t('button.exportXlsx')}</span>
          </button>
          <button style={shareBtn} onClick={(e) => setShareAnchor(e.currentTarget)}>
            <Share2 size={14} />
            <span>{t('button.share')}</span>
          </button>
          <SharePopover
            anchorEl={shareAnchor}
            open={Boolean(shareAnchor)}
            onClose={() => setShareAnchor(null)}
            shareKey={`campaign-${campaignId}`}
            windFarmId={campaign?.windFarmId}
            turbineId={turbineResults[0]?.turbineId}
            campaignId={campaignId}
          />
        </div>
      </div>

      {/* Empty results state */}
      {turbineResults.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-neutral-500)' }}>
          <p>{t('campaign.noInspections')}</p>
          <Link to={`/assets-wind/${campaign.windFarmId}`} style={{ color: 'var(--color-primary-500)' }}>
            {t('campaign.goToWindFarm')}
          </Link>
        </div>
      ) : (
        /* ─── Main Content (2 columns) ────────────────────────────── */
        <div style={mainContent} className="wind-farm-detail-content">
          {/* LEFT COLUMN: Map + Charts */}
          <div style={leftColumn} className="wind-farm-detail-left">
            {/* Map */}
            <div style={mapPanel}>
              <div style={mapToolbar}>
                <label style={selectAllLabel}>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                  <span>{t('button.selectAll')}</span>
                </label>
              </div>
              <CampaignMap
                turbines={turbineMarkers && turbineMarkers.length > 0 ? turbineMarkers.map((m) => ({ id: m.id, name: m.name, lat: m.lat, lon: m.lon })) : undefined}
                selectedTurbineIds={selectedTurbines}
                onTurbineClick={handleTurbineToggle}
              />
            </div>

            {/* Charts side by side */}
            <div style={chartsRow} className="cards-grid">
              <div style={chartPanel}>
                <h4 style={chartTitle}>{t('campaign.categoryRepartition')}</h4>
                <CampaignCategoryChart data={filteredCategoryChart} />
              </div>
              <div style={chartPanel}>
                <h4 style={chartTitle}>{t('campaign.typeRepartition')}</h4>
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
                    onOpenInspection={(turbineId) => {
                      const inspId = turbineInspectionMap[turbineId];
                      if (inspId) {
                        window.open(`/inspections/${inspId}/workflow?step=4`, '_blank');
                      }
                    }}
                    onDownloadPdf={async (turbineId) => {
                      try {
                        const { data: inspections } = await (supabase as any)
                          .from('inspection')
                          .select('id, scheduled_date')
                          .eq('campaign_id', campaignId)
                          .eq('turbine_id', turbineId)
                          .order('completed_at', { ascending: false })
                          .limit(1);
                        const insp = inspections?.[0];
                        if (insp) {
                          const name = turbineResults.find(t => t.turbineId === turbineId)?.turbineName || '';
                          await generateAndDownloadReport({
                            inspectionId: insp.id,
                            inspectionDate: insp.scheduled_date || new Date().toISOString(),
                            asset: campaign?.windFarmName || '',
                            subAsset: name,
                          });
                        } else {
                          alert('No inspection found for this turbine.');
                        }
                      } catch (err: any) {
                        alert(err?.message || 'Error generating PDF.');
                      }
                    }}
                    onDownloadCsv={async (turbineId) => {
                      const turbineDefects = allDefects.filter((d) => d.turbineId === turbineId);
                      if (turbineDefects.length === 0) { alert('No defects for this turbine.'); return; }
                      const name = turbineResults.find(t => t.turbineId === turbineId)?.turbineName || 'turbine';
                      // Map to DefectDashboardRow format for generateDefectsXLSX
                      const rows = turbineDefects.map((d) => ({
                        id: d.id,
                        assetName: campaign?.windFarmName || '',
                        turbineName: name,
                        turbineModel: '',
                        type: d.type.toUpperCase().replace(/_/g, ' '),
                        defectWidth: d.widthCm,
                        defectHeight: d.heightCm,
                        category: d.severity,
                        actionText: '',
                        actionUrgency: 'medium' as const,
                        nextStep: d.description || '',
                        bladePosition: String(BLADE_LABELS[d.bladePosition] ?? d.bladePosition),
                        side: d.side,
                        rootDistance: d.distanceFromRoot,
                        rootCause: null,
                        notes: null,
                        imageUrl: null,
                        resolved: false,
                        inspectionId: '',
                        bladeId: '',
                      }));
                      const blob = await generateDefectsXLSX(rows);
                      downloadBlob(blob, `Defects_${campaign?.windFarmName}_${name}.xlsx`);
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Image Gallery — grouped by category 5→1 */}
            <div style={gallerySection}>
              {/* Info banner (shown when turbine selected) */}
              {hasSelection && (
                <div style={infoBanner}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0288D1">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                  <span style={infoBannerText}>{t('campaign.selectedTurbinesInfo')}</span>
                </div>
              )}

              {[5, 4, 3, 2, 1].map((cat) => {
                const items = filteredDefectsByCategory[cat];
                if (!items || items.length === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: '20px' }}>
                    <div style={gallerySeparator}>
                      <span style={{ ...gallerySepText, color: CATEGORY_COLORS[cat] }}>{t('table.category')} {cat}</span>
                      <div style={gallerySepLine} />
                      <span style={gallerySepCount}>{items.length}</span>
                    </div>
                    <div style={galleryGrid}>
                      {items.map((defect) => (
                        <a
                          key={defect.id}
                          href={`/inspections/${defect.inspectionId}/workflow?step=4&tab=details&defectId=${defect.id}`}
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
                  </div>
                );
              })}
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

const gallerySepCount: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-neutral-500)',
  whiteSpace: 'nowrap',
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
