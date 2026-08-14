import { useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal, Download, Loader2 } from 'lucide-react';
import { Button, Badge } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import { useCampaignInspections } from '@/hooks/useWindFarmDetail';
import { generateAndDownloadReport } from '@/services/reportPdf.service';
import type { Campaign, CampaignInspection } from '@/types';

export interface CampaignAccordionProps {
  campaign: Campaign;
  onViewResults: (campaignId: string) => void;
  onSubassetClick?: (subassetName: string) => void;
  onInspectionClick?: (inspectionId: string, status: string, campaignId: string | null, turbineId?: string | null, stage?: string) => void;
  onEdit?: (campaign: Campaign) => void;
  onDelete?: (campaignId: string) => void;
  filterBySubasset?: string | null;
}

export function CampaignAccordion({
  campaign,
  onViewResults,
  onSubassetClick,
  onInspectionClick,
  onEdit,
  onDelete,
  filterBySubasset,
}: CampaignAccordionProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // When a filter is active, always load inspections to show filtered results
  const shouldLoadInspections = isExpanded || !!filterBySubasset;
  const { data: inspections, isLoading } = useCampaignInspections(
    shouldLoadInspections ? campaign.id : undefined,
    campaign.windFarmId,
  );

  // Filter inspections by subasset name when filter is active
  const filteredInspections = inspections?.filter(
    (insp) => !filterBySubasset || insp.subassetName === filterBySubasset,
  );

  const inspectionCount = filteredInspections?.length ?? 0;

  // Auto-expand when filter is active and there are matching inspections
  const effectiveExpanded = isExpanded || (!!filterBySubasset && inspectionCount > 0);

  const getStatusBadge = (status: string, stage?: string) => {
    const s = stage || (status === 'completed' || status === 'approved' ? 'report' : 'planned');
    const label = s.charAt(0).toUpperCase() + s.slice(1);
    const colorMap: Record<string, { bg: string; color: string }> = {
      report: { bg: '#DEF7EC', color: '#03543F' },
      analyze: { bg: '#FEE2E2', color: '#991B1B' },
      annotate: { bg: '#EDE9FE', color: '#5B21B6' },
      inspect: { bg: '#DBEAFE', color: '#1E40AF' },
      planned: { bg: '#FEF9C3', color: '#854D0E' },
    };
    const colors = colorMap[s] || colorMap.planned!;
    return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: colors.bg, color: colors.color }}>{label}</span>;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <button style={expandBtnStyle} onClick={() => setIsExpanded(!effectiveExpanded)}>
          {effectiveExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span style={campaignNameStyle}>
            {campaign.name} ({inspectionCount})
          </span>
        </button>

        <div style={actionsStyle}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onViewResults(campaign.id)}
            style={{ backgroundColor: '#5A8F5A' }}
          >
            {t('campaigns.viewResults')}
          </Button>
          {(onEdit || onDelete) && (
            <div style={{ position: 'relative' }}>
              <button
                style={menuBtnStyle}
                onClick={() => setShowMenu(!showMenu)}
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div style={menuDropdownStyle}>
                  {onEdit && (
                    <button
                      style={menuItemStyle}
                      onClick={() => {
                        onEdit(campaign);
                        setShowMenu(false);
                      }}
                    >
                      {t('campaigns.editCampaign')}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      style={{ ...menuItemStyle, color: 'var(--color-danger-500)' }}
                      onClick={() => {
                        onDelete(campaign.id);
                        setShowMenu(false);
                      }}
                    >
                      {t('button.delete')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Table */}
      {effectiveExpanded && (
        <div style={tableWrapperStyle}>
          {isLoading ? (
            <p style={loadingStyle}>{t('campaigns.loadingInspections')}</p>
          ) : filteredInspections && filteredInspections.length > 0 ? (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>{t('subassetDetail.colInspectionDate')}</th>
                  <th style={thStyle}>{t('subassetDetail.colSubassetName')}</th>
                  <th style={thStyle}>{t('subassetDetail.colStatus')}</th>
                  <th style={thStyle}>{t('subassetDetail.colType')}</th>
                  <th style={thStyle}>{t('subassetDetail.colPhotos')}</th>
                  <th style={thStyle}>{t('subassetDetail.colViewed')}</th>
                  <th style={thStyle}>{t('subassetDetail.colDefects')}</th>
                  <th style={thStyle}>{t('subassetDetail.colNotes')}</th>
                  <th style={thStyle}>{t('subassetDetail.colPdf')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((insp: CampaignInspection) => (
                  <tr key={insp.id} style={{ ...trStyle, cursor: 'pointer' }} onClick={() => onInspectionClick?.(insp.id, insp.status, insp.campaignId, insp.turbineId, insp.stage)}>
                    <td style={tdStyle}>{formatDate(insp.inspectionDate)}</td>
                    <td style={tdStyle}>
                      {insp.subassetName}
                    </td>
                    <td style={tdStyle}>{getStatusBadge(insp.status, insp.stage)}</td>
                    <td style={tdStyle}>
                      {insp.inspectionType.charAt(0).toUpperCase() + insp.inspectionType.slice(1)}
                    </td>
                    <td style={tdStyle}>{insp.photosCount}</td>
                    <td style={tdStyle}>{insp.viewedPercent}%</td>
                    <td style={tdStyle}>{insp.defectsCount}</td>
                    <td style={{ ...tdStyle, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {insp.notes ?? ''}
                    </td>
                    <td style={tdStyle}>
                      {(insp.stage === 'report' || insp.status === 'completed' || insp.status === 'approved' || insp.reportStoragePath) && (
                        <button
                          style={pdfBtnStyle}
                          title={t('reports.downloadReport')}
                          disabled={downloadingId === insp.id}
                          onClick={async (e) => {
                            e.stopPropagation();
                            setDownloadingId(insp.id);
                            try {
                              await generateAndDownloadReport({
                                inspectionId: insp.id,
                                inspectionDate: insp.inspectionDate,
                                asset: campaign.name,
                                subAsset: insp.subassetName,
                              });
                            } catch (err: any) {
                              alert(err?.message || 'Error generating PDF.');
                            } finally {
                              setDownloadingId(null);
                            }
                          }}
                        >
                          {downloadingId === insp.id ? (
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} color="var(--color-primary-500)" />
                          ) : (
                            <Download size={14} color="var(--color-primary-500)" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={loadingStyle}>
              {filterBySubasset
                ? `${t('campaigns.noInspectionsFor')} "${filterBySubasset}"`
                : t('campaigns.noInspectionsInCampaign')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 'var(--radius-md)',
  marginBottom: 'var(--space-2)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-3) var(--space-4)',
  backgroundColor: 'var(--color-neutral-50)',
};

const expandBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--color-neutral-800)',
};

const campaignNameStyle: React.CSSProperties = {
  fontWeight: 600,
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

const menuBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  borderRadius: 'var(--radius-sm)',
};

const menuDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '100%',
  backgroundColor: 'var(--color-neutral-0)',
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-md)',
  zIndex: 10,
  minWidth: '120px',
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: 'var(--space-2) var(--space-3)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
};

const tableWrapperStyle: React.CSSProperties = {
  overflowX: 'auto',
  padding: '0 var(--space-2) var(--space-2)',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-xs)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-2) var(--space-3)',
  fontWeight: 600,
  color: 'var(--color-neutral-600)',
  borderBottom: '1px solid var(--color-neutral-200)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--color-neutral-100)',
  whiteSpace: 'nowrap',
};

const trStyle: React.CSSProperties = {};

const loadingStyle: React.CSSProperties = {
  padding: 'var(--space-3)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-neutral-500)',
};

const pdfBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
};
