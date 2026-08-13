import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { droneUploadService } from '@/services/drone-upload.service';
import { BLADE_FACE_LABELS, BLADE_FACE_SHORT } from '@/types';
import type { BladeFace, InspectionPhoto } from '@/types';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useLanguage } from '@/components/design-system';

export interface BladeViewer360Props {
  campaignId: string;
  bladeId: string;
}

const FACES: BladeFace[] = ['leading_edge', 'trailing_edge', 'suction_side', 'pressure_side'];

export function BladeViewer360({ campaignId, bladeId }: BladeViewer360Props) {
  const { t } = useLanguage();
  const [selectedFace, setSelectedFace] = useState<BladeFace>('leading_edge');
  const [lightboxPhoto, setLightboxPhoto] = useState<InspectionPhoto | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const { data: photos, isLoading } = useQuery({
    queryKey: ['blade-photos', campaignId, bladeId, selectedFace],
    queryFn: () => droneUploadService.getBladePhotos(campaignId, bladeId, selectedFace),
  });

  // Pre-fetch signed URLs for visible photos
  useEffect(() => {
    if (!photos || photos.length === 0) return;
    const fetchUrls = async () => {
      const urls: Record<string, string> = {};
      for (const photo of photos) {
        if (!photoUrls[photo.id]) {
          try {
            urls[photo.id] = await droneUploadService.getPhotoUrl(photo.storagePath);
          } catch {
            urls[photo.id] = '';
          }
        }
      }
      if (Object.keys(urls).length > 0) {
        setPhotoUrls((prev) => ({ ...prev, ...urls }));
      }
    };
    fetchUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxPhoto) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxPhoto(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxPhoto]);

  const navigateLightbox = useCallback(
    (direction: 'prev' | 'next') => {
      if (!lightboxPhoto || !photos) return;
      const idx = photos.findIndex((p) => p.id === lightboxPhoto.id);
      if (idx === -1) return;
      const newIdx = direction === 'prev' ? idx - 1 : idx + 1;
      if (newIdx >= 0 && newIdx < photos.length) {
        setLightboxPhoto(photos[newIdx]!);
      }
    },
    [lightboxPhoto, photos],
  );

  return (
    <div style={styles.container}>
      {/* Face Tabs */}
      <div style={styles.tabBar} role="tablist" aria-label="Blade faces">
        {FACES.map((face) => (
          <button
            key={face}
            role="tab"
            aria-selected={selectedFace === face}
            onClick={() => setSelectedFace(face)}
            style={{
              ...styles.tab,
              ...(selectedFace === face ? styles.tabActive : {}),
            }}
            type="button"
          >
            <span style={styles.tabShort}>{BLADE_FACE_SHORT[face]}</span>
            <span style={styles.tabLabel}>{BLADE_FACE_LABELS[face]}</span>
          </button>
        ))}
      </div>

      {/* Position indicator */}
      <div style={styles.positionBar}>
        <span style={styles.positionLabel}>Root (0%)</span>
        <div style={styles.positionTrack}>
          <div style={styles.positionGradient} />
        </div>
        <span style={styles.positionLabel}>Tip (100%)</span>
      </div>

      {/* Photo strip */}
      {isLoading ? (
        <div style={styles.strip}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="rect" width="120px" height="90px" />
          ))}
        </div>
      ) : !photos || photos.length === 0 ? (
        <div style={styles.emptyState}>
          <Clock size={32} color="var(--color-neutral-300)" />
          <p style={styles.emptyText}>No photos for this face yet</p>
        </div>
      ) : (
        <div style={styles.strip}>
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxPhoto(photo)}
              style={styles.photoCard}
              aria-label={`Photo ${photo.flightPlanOrder} at ${Math.round(photo.radialPosition * 100)}%`}
            >
              <div style={styles.photoImageWrapper}>
                {photoUrls[photo.id] ? (
                  <img
                    src={photoUrls[photo.id]}
                    alt={photo.filename}
                    style={styles.photoImage}
                    loading="lazy"
                  />
                ) : (
                  <div style={styles.photoPlaceholder} />
                )}
              </div>

              {/* Status badge */}
              <div style={styles.badgeRow}>
                {photo.analyzed ? (
                  <span style={styles.badgeAnalyzed}>
                    <CheckCircle size={10} />
                    Done
                  </span>
                ) : (
                  <span style={styles.badgePending}>
                    <Clock size={10} />
                    Pending
                  </span>
                )}
              </div>

              {/* Position label */}
              <span style={styles.photoPosition}>
                {Math.round(photo.radialPosition * 100)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          style={styles.lightboxOverlay}
          onClick={() => setLightboxPhoto(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Viewing ${lightboxPhoto.filename}`}
        >
          <div style={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxPhoto(null)}
              style={styles.lightboxClose}
              aria-label={t('general.close')}
              type="button"
            >
              <X size={20} />
            </button>

            {/* Navigation */}
            {photos && photos.findIndex((p) => p.id === lightboxPhoto.id) > 0 && (
              <button
                onClick={() => navigateLightbox('prev')}
                style={{ ...styles.lightboxNav, left: '8px' }}
                aria-label={t('general.previous')}
                type="button"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {photos && photos.findIndex((p) => p.id === lightboxPhoto.id) < photos.length - 1 && (
              <button
                onClick={() => navigateLightbox('next')}
                style={{ ...styles.lightboxNav, right: '8px' }}
                aria-label={t('general.next')}
                type="button"
              >
                <ChevronRight size={24} />
              </button>
            )}

            <img
              src={photoUrls[lightboxPhoto.id] ?? ''}
              alt={lightboxPhoto.filename}
              style={styles.lightboxImage}
            />

            <div style={styles.lightboxInfo}>
              <span style={styles.lightboxFilename}>{lightboxPhoto.filename}</span>
              <span style={styles.lightboxMeta}>
                {BLADE_FACE_LABELS[lightboxPhoto.face]} · Position: {Math.round(lightboxPhoto.radialPosition * 100)}% · Order: {lightboxPhoto.flightPlanOrder}
              </span>
              {lightboxPhoto.analyzed ? (
                <span style={{ ...styles.badgeAnalyzed, fontSize: '0.75rem' }}>
                  <CheckCircle size={12} /> Analyzed
                </span>
              ) : (
                <span style={{ ...styles.badgePending, fontSize: '0.75rem' }}>
                  <Clock size={12} /> Pending analysis
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
    borderBottom: '1px solid var(--color-neutral-200)',
    paddingBottom: '0',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s ease',
    borderRadius: '4px 4px 0 0',
  },
  tabActive: {
    borderBottomColor: 'var(--color-primary-500)',
    backgroundColor: 'var(--color-primary-50)',
  },
  tabShort: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--color-neutral-700)',
  },
  tabLabel: {
    fontSize: '0.65rem',
    color: 'var(--color-neutral-500)',
  },
  positionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 4px',
  },
  positionLabel: {
    fontSize: '0.65rem',
    color: 'var(--color-neutral-500)',
    whiteSpace: 'nowrap',
  },
  positionTrack: {
    flex: 1,
    height: '4px',
    borderRadius: '2px',
    overflow: 'hidden',
    backgroundColor: 'var(--color-neutral-100)',
  },
  positionGradient: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to right, var(--color-primary-200), var(--color-primary-500))',
    borderRadius: '2px',
  },
  strip: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    padding: '8px 0',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '32px',
  },
  emptyText: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--color-neutral-400)',
  },
  photoCard: {
    flexShrink: 0,
    width: '120px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: 0,
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-neutral-0)',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'border-color 0.15s ease',
  },
  photoImageWrapper: {
    width: '100%',
    height: '80px',
    backgroundColor: 'var(--color-neutral-100)',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--color-neutral-100)',
  },
  badgeRow: {
    display: 'flex',
    justifyContent: 'center',
    padding: '2px 4px',
  },
  badgeAnalyzed: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '0.6rem',
    fontWeight: 600,
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    borderRadius: '10px',
    padding: '2px 6px',
  },
  badgePending: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '0.6rem',
    fontWeight: 600,
    color: 'var(--color-neutral-500)',
    backgroundColor: 'var(--color-neutral-100)',
    borderRadius: '10px',
    padding: '2px 6px',
  },
  photoPosition: {
    fontSize: '0.6rem',
    color: 'var(--color-neutral-500)',
    textAlign: 'center',
    paddingBottom: '4px',
  },
  lightboxOverlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 1000,
    padding: '16px',
  },
  lightboxContent: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '90vw',
    maxHeight: '90vh',
  },
  lightboxClose: {
    position: 'absolute',
    top: '-40px',
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: 'white',
    cursor: 'pointer',
  },
  lightboxNav: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: 'white',
    cursor: 'pointer',
    zIndex: 10,
  },
  lightboxImage: {
    maxWidth: '100%',
    maxHeight: '75vh',
    objectFit: 'contain',
    borderRadius: 'var(--radius-md)',
  },
  lightboxInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    marginTop: '12px',
  },
  lightboxFilename: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.9)',
    fontWeight: 500,
  },
  lightboxMeta: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.6)',
  },
};
