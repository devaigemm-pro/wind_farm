import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Radio, Eye, Play, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { droneUploadService } from '@/services/drone-upload.service';
import { BLADE_FACE_LABELS, BLADE_FACE_SHORT, BLADE_POSITION_LABELS } from '@/types';
import type { BladeFace, BladeUploadProgress, CampaignStatus } from '@/types';
import { BladeViewer360 } from '@/components/organisms/BladeViewer360';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Button } from '@/components/atoms/Button';

const FACES: BladeFace[] = ['leading_edge', 'trailing_edge', 'suction_side', 'pressure_side'];

const STATUS_LABELS: Record<CampaignStatus, string> = {
  awaiting_photos: 'Awaiting Photos',
  photos_uploaded: 'Photos Uploaded',
  annotating: 'Annotating',
  completed: 'Completed',
};

const STATUS_COLORS: Record<CampaignStatus, { bg: string; text: string }> = {
  awaiting_photos: { bg: '#FFF3E0', text: '#E65100' },
  photos_uploaded: { bg: '#E3F2FD', text: '#0277BD' },
  annotating: { bg: '#F3E5F5', text: '#6A1B9A' },
  completed: { bg: '#E8F5E9', text: '#2E7D32' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CampaignUploadStatus() {
  const { id: campaignId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerBladeId, setViewerBladeId] = useState<string | null>(null);

  // Fetch campaign details
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['campaign-detail', campaignId],
    queryFn: async () => {
      const { data, error } = await db
        .from('campaign')
        .select('id, name, wind_farm_id, status, created_at')
        .eq('id', campaignId!)
        .single();
      if (error) throw error;
      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        windFarmId: row.wind_farm_id as string,
        status: (row.status as CampaignStatus) ?? 'awaiting_photos',
        createdAt: row.created_at as string,
      };
    },
    enabled: !!campaignId,
  });

  // Fetch blades for this campaign's wind farm
  const { data: blades } = useQuery({
    queryKey: ['campaign-blades', campaign?.windFarmId],
    queryFn: async () => {
      const { data, error } = await db
        .from('blade')
        .select('id, position, turbine:turbine(id, name, wind_farm_id)')
        .eq('turbine.wind_farm_id', campaign!.windFarmId);
      if (error) throw error;
      return ((data as unknown[]) ?? [])
        .filter((row: unknown) => {
          const r = row as Record<string, unknown>;
          return r.turbine !== null;
        })
        .map((row: unknown) => {
          const r = row as Record<string, unknown>;
          const turbine = r.turbine as Record<string, unknown>;
          return {
            id: r.id as string,
            position: r.position as number,
            turbineId: turbine.id as string,
            turbineName: turbine.name as string,
          };
        });
    },
    enabled: !!campaign?.windFarmId,
  });

  // Fetch upload progress with polling (every 10s)
  const { data: progress } = useQuery({
    queryKey: ['campaign-upload-progress', campaignId],
    queryFn: () => droneUploadService.getUploadProgress(campaignId!),
    enabled: !!campaignId,
    refetchInterval: 10_000,
  });

  // Mutation: update campaign status
  const updateStatus = useMutation({
    mutationFn: (status: CampaignStatus) =>
      droneUploadService.updateCampaignStatus(campaignId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-detail', campaignId] });
    },
  });

  // Group progress by blade
  const progressByBlade = (progress ?? []).reduce<Record<string, BladeUploadProgress[]>>(
    (acc, item) => {
      if (!acc[item.bladeId]) acc[item.bladeId] = [];
      acc[item.bladeId]!.push(item);
      return acc;
    },
    {},
  );

  // Check if all photos uploaded (at least 1 photo per face per blade)
  const totalPhotos = (progress ?? []).reduce((sum, p) => sum + p.photoCount, 0);
  const hasPhotos = totalPhotos > 0;

  const openViewer = (bladeId: string) => {
    setViewerBladeId(bladeId);
    setViewerOpen(true);
  };

  // Loading
  if (campaignLoading) {
    return (
      <div style={pageStyles.container}>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Skeleton variant="text" width="300px" height="24px" />
          <Skeleton variant="rect" width="100%" height="200px" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={pageStyles.container}>
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-neutral-500)' }}>
          <p>Campaign not found.</p>
          <Link to="/dashboard" style={{ color: 'var(--color-primary-500)' }}>Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const statusColors = STATUS_COLORS[campaign.status];

  return (
    <div style={pageStyles.container}>
      {/* ─── Header ──────────────────────────────────────────── */}
      <div style={pageStyles.header}>
        <div style={pageStyles.headerLeft}>
          <div style={pageStyles.breadcrumb}>
            <Link to={`/assets-wind/${campaign.windFarmId}`} style={pageStyles.breadcrumbLink}>
              Wind Farm
            </Link>
            <ChevronRight size={14} color="var(--color-neutral-400)" />
            <span style={pageStyles.breadcrumbCurrent}>{campaign.name}</span>
          </div>
          <div style={pageStyles.titleRow}>
            <h1 style={pageStyles.title}>Upload Status</h1>
            <span
              style={{
                ...pageStyles.statusBadge,
                backgroundColor: statusColors.bg,
                color: statusColors.text,
              }}
            >
              {STATUS_LABELS[campaign.status]}
            </span>
          </div>
        </div>

        <div style={pageStyles.headerRight}>
          {campaign.status === 'awaiting_photos' && hasPhotos && (
            <Button
              variant="primary"
              size="sm"
              icon={Play}
              onClick={() => updateStatus.mutate('annotating')}
              disabled={updateStatus.isPending}
            >
              Start Analysis
            </Button>
          )}
        </div>
      </div>

      {/* ─── Awaiting drone indicator ────────────────────────── */}
      {campaign.status === 'awaiting_photos' && !hasPhotos && (
        <div style={pageStyles.awaitingBanner}>
          <div style={pageStyles.pulseWrapper}>
            <Radio size={20} color="#E65100" style={{ animation: 'pulse 2s infinite' }} />
          </div>
          <div>
            <p style={pageStyles.awaitingTitle}>Waiting for drone upload</p>
            <p style={pageStyles.awaitingSubtitle}>
              The system is polling every 10 seconds for incoming photos.
            </p>
          </div>
        </div>
      )}

      {/* ─── Summary stats ───────────────────────────────────── */}
      {hasPhotos && (
        <div style={pageStyles.statsRow}>
          <div style={pageStyles.statCard}>
            <Camera size={16} color="var(--color-primary-500)" />
            <span style={pageStyles.statValue}>{totalPhotos}</span>
            <span style={pageStyles.statLabel}>Total Photos</span>
          </div>
          <div style={pageStyles.statCard}>
            <Eye size={16} color="#2E7D32" />
            <span style={pageStyles.statValue}>
              {(progress ?? []).reduce((s, p) => s + p.analyzedCount, 0)}
            </span>
            <span style={pageStyles.statLabel}>Analyzed</span>
          </div>
        </div>
      )}

      {/* ─── Blade Grid (3 columns: A, B, C) ────────────────── */}
      <div style={pageStyles.bladeGrid}>
        {(blades ?? []).map((blade) => {
          const bladeProgress = progressByBlade[blade.id] ?? [];
          const bladeLabel = BLADE_POSITION_LABELS[blade.position] ?? `${blade.position}`;

          return (
            <div key={blade.id} style={pageStyles.bladeCard}>
              <div style={pageStyles.bladeCardHeader}>
                <h3 style={pageStyles.bladeCardTitle}>
                  Blade {bladeLabel}
                </h3>
                <span style={pageStyles.bladeCardSub}>{blade.turbineName}</span>
              </div>

              {/* Face rows */}
              <div style={pageStyles.faceList}>
                {FACES.map((face) => {
                  const fp = bladeProgress.find((p) => p.face === face);
                  const count = fp?.photoCount ?? 0;
                  const analyzed = fp?.analyzedCount ?? 0;
                  const pct = count > 0 ? Math.round((analyzed / count) * 100) : 0;

                  return (
                    <div key={face} style={pageStyles.faceRow}>
                      <span style={pageStyles.faceIcon}>{BLADE_FACE_SHORT[face]}</span>
                      <span style={pageStyles.faceName}>{BLADE_FACE_LABELS[face]}</span>
                      <span style={pageStyles.faceCount}>{count} photos</span>
                      <div style={pageStyles.progressTrack}>
                        <div
                          style={{
                            ...pageStyles.progressBar,
                            width: `${pct}%`,
                            backgroundColor: pct === 100 ? '#2E7D32' : 'var(--color-primary-500)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* View 360° button */}
              <button
                type="button"
                onClick={() => openViewer(blade.id)}
                style={pageStyles.viewButton}
              >
                <Eye size={14} />
                View 360°
              </button>
            </div>
          );
        })}
      </div>

      {/* ─── Viewer Dialog ───────────────────────────────────── */}
      {viewerOpen && viewerBladeId && campaignId && (
        <div
          style={pageStyles.dialogOverlay}
          onClick={() => setViewerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Blade 360 Viewer"
        >
          <div style={pageStyles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div style={pageStyles.dialogHeader}>
              <h2 style={pageStyles.dialogTitle}>Blade 360° Viewer</h2>
              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                style={pageStyles.dialogClose}
                aria-label="Close viewer"
              >
                ×
              </button>
            </div>
            <BladeViewer360 campaignId={campaignId} bladeId={viewerBladeId} />
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const pageStyles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    fontFamily: 'var(--font-family-sans)',
    padding: '16px 24px',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
  },
  breadcrumbLink: {
    color: 'var(--color-primary-500)',
    textDecoration: 'none',
    fontWeight: 500,
  },
  breadcrumbCurrent: {
    color: 'var(--color-neutral-600)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
    margin: 0,
  },
  statusBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: '12px',
  },
  awaitingBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    backgroundColor: '#FFF8E1',
    border: '1px solid #FFE082',
    borderRadius: 'var(--radius-md)',
  },
  pulseWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  awaitingTitle: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#E65100',
  },
  awaitingSubtitle: {
    margin: 0,
    fontSize: '0.7rem',
    color: 'var(--color-neutral-600)',
    marginTop: '2px',
  },
  statsRow: {
    display: 'flex',
    gap: '12px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'var(--color-neutral-50)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
  },
  statValue: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--color-neutral-900)',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: 'var(--color-neutral-500)',
  },
  bladeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  bladeCard: {
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-neutral-0)',
    overflow: 'hidden',
  },
  bladeCardHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--color-neutral-100)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bladeCardTitle: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--color-neutral-800)',
  },
  bladeCardSub: {
    fontSize: '0.7rem',
    color: 'var(--color-neutral-500)',
  },
  faceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 14px',
  },
  faceRow: {
    display: 'grid',
    gridTemplateColumns: '28px 1fr auto 60px',
    alignItems: 'center',
    gap: '8px',
  },
  faceIcon: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'var(--color-primary-500)',
    backgroundColor: 'var(--color-primary-50)',
    borderRadius: '4px',
    padding: '2px 4px',
    textAlign: 'center',
  },
  faceName: {
    fontSize: '0.7rem',
    color: 'var(--color-neutral-700)',
  },
  faceCount: {
    fontSize: '0.65rem',
    color: 'var(--color-neutral-500)',
    textAlign: 'right',
  },
  progressTrack: {
    height: '4px',
    borderRadius: '2px',
    backgroundColor: 'var(--color-neutral-100)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  viewButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    padding: '8px',
    border: 'none',
    borderTop: '1px solid var(--color-neutral-100)',
    background: 'var(--color-neutral-50)',
    color: 'var(--color-primary-500)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  dialogOverlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
    padding: '24px',
  },
  dialogContent: {
    width: '90vw',
    maxWidth: '900px',
    maxHeight: '85vh',
    backgroundColor: 'var(--color-neutral-0)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  dialogHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
  },
  dialogClose: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'var(--color-neutral-100)',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '1.2rem',
    color: 'var(--color-neutral-600)',
  },
};
