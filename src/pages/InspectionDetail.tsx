import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ShieldCheck } from 'lucide-react';
import { Badge, Button, Skeleton } from '@/components/atoms';
import { ConfirmDialog } from '@/components/organisms';
import { useInspection } from '@/hooks/useInspection';
import { useCompleteInspection, useApproveInspection } from '@/hooks/useInspectionMutations';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/store/toastStore';
import type { InspectionStatus } from '@/types';
import type { BadgeVariant } from '@/components/atoms';

type TabId = 'evidence' | 'defects' | 'timeline';

const STATUS_BADGE_MAP: Record<InspectionStatus, BadgeVariant> = {
  in_progress: 'info',
  completed: 'success',
  approved: 'neutral',
};

const STATUS_LABELS: Record<InspectionStatus, string> = {
  in_progress: 'In Progress',
  completed: 'Completed',
  approved: 'Approved',
};

export function InspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { success, error: toastError } = useToast();

  const { data: inspection, isLoading, isError } = useInspection(id ?? '');
  const completeInspection = useCompleteInspection();
  const approveInspection = useApproveInspection();

  const [activeTab, setActiveTab] = useState<TabId>('evidence');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  // Action visibility
  const canComplete =
    inspection?.status === 'in_progress' && user?.id === inspection?.inspector_id;
  const canApprove =
    inspection?.status === 'completed' && (role === 'supervisor' || role === 'admin');

  const handleComplete = async () => {
    if (!id) return;
    try {
      await completeInspection.mutateAsync(id);
      success('Inspection marked as completed');
    } catch {
      toastError('Failed to complete inspection');
    } finally {
      setShowCompleteDialog(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveInspection.mutateAsync(id);
      success('Inspection approved');
    } catch {
      toastError('Failed to approve inspection');
    } finally {
      setShowApproveDialog(false);
    }
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 'var(--space-4) var(--space-6)',
    borderBottom: '1px solid var(--color-neutral-100)',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
  };

  const headerLeftStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  };

  const headerActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    flexShrink: 0,
  };

  const metaRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-600)',
  };

  const titleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--text-xl)',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid var(--color-neutral-100)',
    padding: '0 var(--space-6)',
    gap: 'var(--space-1)',
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--text-sm)',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? 'var(--color-primary-600)' : 'var(--color-neutral-600)',
    borderBottom: isActive ? '2px solid var(--color-primary-500)' : '2px solid transparent',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: isActive ? 'var(--color-primary-500)' : 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
    transition: `color var(--duration-fast) var(--easing-default)`,
  });

  const tabContentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-6)',
  };

  const timelineItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) 0',
    borderBottom: '1px solid var(--color-neutral-50)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-700)',
  };

  const timelineDotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-primary-400)',
    flexShrink: 0,
  };

  const placeholderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-8)',
    color: 'var(--color-neutral-400)',
    fontSize: 'var(--text-sm)',
  };

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <div style={headerLeftStyle}>
            <Skeleton variant="text" width="300px" height="24px" />
            <Skeleton variant="text" width="200px" height="16px" />
          </div>
        </div>
        <div style={tabBarStyle}>
          <Skeleton variant="text" width="80px" height="20px" />
          <Skeleton variant="text" width="80px" height="20px" />
          <Skeleton variant="text" width="80px" height="20px" />
        </div>
        <div style={tabContentStyle}>
          <Skeleton variant="rect" height="200px" />
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────────

  if (isError || !inspection) {
    return (
      <div style={pageStyle}>
        <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <h2
            style={{
              color: 'var(--color-neutral-700)',
              fontSize: 'var(--text-lg)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Inspection not found
          </h2>
          <p
            style={{
              color: 'var(--color-neutral-500)',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-4)',
            }}
          >
            The inspection you are looking for does not exist or you do not have access.
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/inspections')}>
            Back to Inspections
          </Button>
        </div>
      </div>
    );
  }

  // ─── Derived Data ───────────────────────────────────────────────────────────

  const bladePosition = inspection.blade?.position ?? '—';
  const turbineName = inspection.blade?.turbine?.name ?? '—';
  const farmName = inspection.blade?.turbine?.wind_farm?.name ?? '—';
  const inspectorName = inspection.inspector?.name ?? inspection.inspector?.email ?? '—';
  const scheduledDate = inspection.scheduled_date
    ? new Date(inspection.scheduled_date).toLocaleDateString()
    : '—';

  // ─── Timeline Tab Content ───────────────────────────────────────────────────

  const timelineEntries: { label: string; date: string | null }[] = [
    { label: 'Created', date: inspection.created_at },
    { label: 'Completed', date: inspection.completed_at ?? null },
    { label: 'Approved', date: inspection.approved_at ?? null },
  ];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString();
  };

  // ─── Tab Content ────────────────────────────────────────────────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case 'evidence':
        return <div style={placeholderStyle}>Evidence gallery will be added here</div>;
      case 'defects':
        return <div style={placeholderStyle}>Defect panel will be added here</div>;
      case 'timeline':
        return (
          <div>
            {timelineEntries.map((entry) => {
              const formatted = formatDate(entry.date);
              if (!formatted && entry.label !== 'Created') return null;
              return (
                <div key={entry.label} style={timelineItemStyle}>
                  <div style={timelineDotStyle} />
                  <span style={{ fontWeight: 500 }}>{entry.label}</span>
                  <span style={{ color: 'var(--color-neutral-500)' }}>
                    {formatted ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <div style={titleRowStyle}>
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              onClick={() => navigate('/inspections')}
              aria-label="Back to inspections"
            />
            <h1 style={titleStyle}>
              Blade {bladePosition}
            </h1>
            <Badge variant={STATUS_BADGE_MAP[inspection.status]}>
              {STATUS_LABELS[inspection.status]}
            </Badge>
          </div>
          <div style={metaRowStyle}>
            <span>Turbine: {turbineName}</span>
            <span>•</span>
            <span>Farm: {farmName}</span>
            <span>•</span>
            <span>Scheduled: {scheduledDate}</span>
            <span>•</span>
            <span>Inspector: {inspectorName}</span>
          </div>
        </div>

        <div style={headerActionsStyle}>
          {canComplete && (
            <Button
              variant="primary"
              size="sm"
              icon={CheckCircle}
              loading={completeInspection.isPending}
              onClick={() => setShowCompleteDialog(true)}
            >
              Complete
            </Button>
          )}
          {canApprove && (
            <Button
              variant="primary"
              size="sm"
              icon={ShieldCheck}
              loading={approveInspection.isPending}
              onClick={() => setShowApproveDialog(true)}
            >
              Approve
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={tabBarStyle} role="tablist" aria-label="Inspection detail tabs">
        <button
          role="tab"
          aria-selected={activeTab === 'evidence'}
          aria-controls="tab-panel-evidence"
          style={tabStyle(activeTab === 'evidence')}
          onClick={() => setActiveTab('evidence')}
        >
          Evidence
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'defects'}
          aria-controls="tab-panel-defects"
          style={tabStyle(activeTab === 'defects')}
          onClick={() => setActiveTab('defects')}
        >
          Defects
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'timeline'}
          aria-controls="tab-panel-timeline"
          style={tabStyle(activeTab === 'timeline')}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
      </div>

      {/* Tab Content */}
      <div
        id={`tab-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={tabContentStyle}
      >
        {renderTabContent()}
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={showCompleteDialog}
        title="Complete Inspection"
        message="Are you sure you want to mark this inspection as completed? This action cannot be undone."
        confirmLabel="Complete"
        onConfirm={handleComplete}
        onCancel={() => setShowCompleteDialog(false)}
      />

      <ConfirmDialog
        open={showApproveDialog}
        title="Approve Inspection"
        message="Are you sure you want to approve this inspection? This will finalize the inspection record."
        confirmLabel="Approve"
        onConfirm={handleApprove}
        onCancel={() => setShowApproveDialog(false)}
      />
    </div>
  );
}
