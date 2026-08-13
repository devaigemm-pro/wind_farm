import { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/atoms';
import {
  useWindFarmInspections,
  useUpdateCampaign,
  useAssignInspectionsToCampaign,
  useUnassignInspectionsFromCampaign,
  useCampaigns,
} from '@/hooks/useWindFarmDetail';
import { useToast } from '@/store/toastStore';
import type { Campaign, CampaignInspection } from '@/types';

export interface EditCampaignModalProps {
  campaign: Campaign;
  windFarmId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EditCampaignModal({ campaign, windFarmId, isOpen, onClose }: EditCampaignModalProps) {
  const toast = useToast();
  const { data: inspections, isLoading } = useWindFarmInspections(isOpen ? windFarmId : undefined);
  const { data: campaigns } = useCampaigns(isOpen ? windFarmId : undefined);
  const updateCampaign = useUpdateCampaign();
  const assignInspections = useAssignInspectionsToCampaign();
  const unassignInspections = useUnassignInspectionsFromCampaign();

  const [name, setName] = useState(campaign.name);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Initialize selected IDs from inspections already in this campaign
  useEffect(() => {
    if (inspections) {
      const idsInCampaign = inspections
        .filter((insp) => insp.campaignId === campaign.id)
        .map((insp) => insp.id);
      setSelectedIds(new Set(idsInCampaign));
    }
  }, [inspections, campaign.id]);

  // Reset name when campaign changes
  useEffect(() => {
    setName(campaign.name);
  }, [campaign.name]);

  const sortedInspections = useMemo(() => {
    if (!inspections) return [];
    return [...inspections].sort((a, b) => {
      const cmp = a.inspectionDate.localeCompare(b.inspectionDate);
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [inspections, sortDirection]);

  if (!isOpen) return null;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = sortedInspections.length > 0 && sortedInspections.every((i) => selectedIds.has(i.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedInspections.map((i) => i.id)));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    try {
      // Update name if changed
      if (name.trim() !== campaign.name) {
        await updateCampaign.mutateAsync({ campaignId: campaign.id, name: name.trim() });
      }

      // Determine which inspections to assign and unassign
      const originalIds = new Set(
        (inspections ?? []).filter((i) => i.campaignId === campaign.id).map((i) => i.id),
      );

      const toAssign = Array.from(selectedIds).filter((id) => !originalIds.has(id));
      const toUnassign = Array.from(originalIds).filter((id) => !selectedIds.has(id));

      if (toAssign.length > 0) {
        await assignInspections.mutateAsync({ campaignId: campaign.id, inspectionIds: toAssign });
      }
      if (toUnassign.length > 0) {
        await unassignInspections.mutateAsync(toUnassign);
      }

      toast.success('Campaign updated');
      onClose();
    } catch {
      toast.error('Failed to update campaign');
    }
  };

  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return '—';
    if (campaignId === campaign.id) return campaign.name;
    const found = campaigns?.find((c) => c.id === campaignId);
    return found?.name ?? 'Other';
  };

  const getStatusBadge = (status: string, stage?: string) => {
    const s = stage || (status === 'completed' || status === 'approved' ? 'report' : 'planned');
    const label = s.charAt(0).toUpperCase() + s.slice(1);
    const colorMap: Record<string, { bg: string; color: string }> = {
      report: { bg: '#DEF7EC', color: '#03543F' },
      analyze: { bg: '#FEF3C7', color: '#92400E' },
      annotate: { bg: '#EDE9FE', color: '#5B21B6' },
      inspect: { bg: '#DBEAFE', color: '#1E40AF' },
      planned: { bg: '#FEF9C3', color: '#854D0E' },
    };
    const colors = colorMap[s] || colorMap.planned!;
    return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: colors.bg, color: colors.color }}>{label}</span>;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();
  const isSaving = updateCampaign.isPending || assignInspections.isPending || unassignInspections.isPending;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitleStyle}>Edit campaign</h2>

        {/* Name field */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={labelStyle}>Name *</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            maxLength={30}
          />
          <span style={charCountStyle}>{name.length}/30</span>
        </div>

        {/* Inspections table */}
        <div style={tableWrapperStyle}>
          {isLoading ? (
            <p style={{ padding: 'var(--space-3)', color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>Loading inspections...</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th
                    style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  >
                    Inspection Date {sortDirection === 'desc' ? '↓' : '↑'}
                  </th>
                  <th style={thStyle}>Subasset</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Notes</th>
                  <th style={thStyle}>Campaign</th>
                </tr>
              </thead>
              <tbody>
                {sortedInspections.map((insp: CampaignInspection) => (
                  <tr key={insp.id} style={trStyle}>
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(insp.id)}
                        onChange={() => toggleSelection(insp.id)}
                      />
                    </td>
                    <td style={tdStyle}>{formatDate(insp.inspectionDate)}</td>
                    <td style={tdStyle}>{insp.subassetName}</td>
                    <td style={tdStyle}>{getStatusBadge(insp.status, insp.stage)}</td>
                    <td style={{ ...tdStyle, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {insp.notes ?? ''}
                    </td>
                    <td style={tdStyle}>{getCampaignName(insp.campaignId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer buttons */}
        <div style={footerStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button style={saveBtnStyle} onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)',
  width: '90%',
  maxWidth: '800px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--shadow-xl)',
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 700,
  color: 'var(--color-primary-600)',
  margin: '0 0 var(--space-4) 0',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--color-neutral-700)',
  display: 'block',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  boxSizing: 'border-box',
};

const charCountStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--color-neutral-400)',
  marginTop: '2px',
  display: 'block',
  textAlign: 'right',
};

const tableWrapperStyle: React.CSSProperties = {
  flex: 1,
  overflowX: 'auto',
  overflowY: 'auto',
  maxHeight: '40vh',
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 'var(--radius-md)',
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
  borderBottom: '1px solid var(--color-neutral-200)',
  position: 'sticky',
  top: 0,
  backgroundColor: '#ffffff',
  color: 'var(--color-neutral-600)',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--color-neutral-100)',
};

const trStyle: React.CSSProperties = {};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-4)',
  paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--color-neutral-200)',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  backgroundColor: '#e0e0e0',
  color: '#333B46',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  backgroundColor: '#00A6FF',
  color: '#ffffff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
};
