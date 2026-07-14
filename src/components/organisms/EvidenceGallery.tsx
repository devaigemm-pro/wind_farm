import { useState, useCallback, useRef, type DragEvent, useEffect } from 'react';
import { Upload, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { useEvidence, useDeleteEvidence } from '@/hooks/useEvidence';
import { useEvidenceUpload } from '@/hooks/useEvidenceUpload';
import { evidenceService } from '@/services/evidence.service';
import { useToast } from '@/store/toastStore';
import { Button } from '@/components/atoms/Button';
import { Skeleton } from '@/components/atoms/Skeleton';
import type { Evidence } from '@/types';

export interface EvidenceGalleryProps {
  inspectionId: string;
  canEdit: boolean;
}

export function EvidenceGallery({ inspectionId, canEdit }: EvidenceGalleryProps) {
  const { data: evidence, isLoading } = useEvidence(inspectionId);
  const { upload, isPending: isUploading, progress } = useEvidenceUpload(inspectionId);
  const deleteEvidence = useDeleteEvidence();
  const toast = useToast();

  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<Evidence | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxItem(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setValidationError(null);
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        const validation = evidenceService.validateFile(file);
        if (!validation.valid) {
          setValidationError(validation.error ?? 'Invalid file');
          return;
        }
      }

      for (const file of fileArray) {
        try {
          await upload(file);
          toast.success(`Uploaded ${file.name}`);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'Upload failed',
          );
        }
      }
    },
    [upload, toast],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!canEdit) return;
      const files = e.dataTransfer.files;
      if (files.length > 0) handleFiles(files);
    },
    [canEdit, handleFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) handleFiles(files);
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [handleFiles],
  );

  const handleDelete = useCallback(
    async (item: Evidence) => {
      try {
        await deleteEvidence.mutateAsync({ id: item.id, storagePath: item.storage_path });
        toast.success('Evidence deleted');
      } catch {
        toast.error('Failed to delete evidence');
      }
    },
    [deleteEvidence, toast],
  );

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="180px" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Upload area - only shown when canEdit */}
      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            ...styles.dropZone,
            ...(isDragOver ? styles.dropZoneActive : {}),
          }}
          role="region"
          aria-label="Upload evidence photos"
        >
          <Upload size={24} style={{ color: 'var(--color-neutral-400)' }} aria-hidden="true" />
          <p style={styles.dropText}>
            {isDragOver ? 'Drop files here' : 'Drag & drop JPEG or PNG files here'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon={Upload}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            Add Photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={handleFileInput}
            style={{ display: 'none' }}
            aria-label="Select photos to upload"
          />

          {/* Upload progress */}
          {isUploading && (
            <div style={styles.progressContainer}>
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressBar,
                    width: `${progress}%`,
                  }}
                />
              </div>
              <span style={styles.progressText}>{progress}%</span>
            </div>
          )}

          {/* Validation error */}
          {validationError && (
            <p style={styles.errorText} role="alert">
              {validationError}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {(!evidence || evidence.length === 0) && (
        <div style={styles.emptyState}>
          <ImageIcon size={48} style={{ color: 'var(--color-neutral-300)' }} aria-hidden="true" />
          <p style={styles.emptyText}>No evidence uploaded yet</p>
        </div>
      )}

      {/* Thumbnail grid */}
      {evidence && evidence.length > 0 && (
        <div style={styles.grid}>
          {evidence.map((item) => (
            <ThumbnailCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              onView={() => setLightboxItem(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxItem && (
        <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
      )}
    </div>
  );
}

// ─── Thumbnail Card ─────────────────────────────────────────────────────────

interface ThumbnailCardProps {
  item: Evidence;
  canEdit: boolean;
  onView: () => void;
  onDelete: () => void;
}

function ThumbnailCard({ item, canEdit, onView, onDelete }: ThumbnailCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const thumbnailUrl = evidenceService.getThumbnailUrl(item.storage_path);

  return (
    <div
      style={styles.thumbnailWrapper}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onView}
        style={styles.thumbnailButton}
        aria-label={`View ${item.filename}`}
        type="button"
      >
        <img
          src={thumbnailUrl}
          alt={item.filename}
          style={styles.thumbnailImage}
          loading="lazy"
        />
      </button>

      {/* Hover overlay with delete button */}
      {isHovered && canEdit && (
        <div style={styles.thumbnailOverlay}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={styles.deleteButton}
            aria-label={`Delete ${item.filename}`}
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Lightbox ───────────────────────────────────────────────────────────────

interface LightboxProps {
  item: Evidence;
  onClose: () => void;
}

function Lightbox({ item, onClose }: LightboxProps) {
  const fullUrl = evidenceService.getFullUrl(item.storage_path);
  const uploadDate = new Date(item.uploaded_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      style={styles.lightboxOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${item.filename}`}
    >
      <div style={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={styles.lightboxClose}
          aria-label="Close lightbox"
          type="button"
        >
          <X size={24} />
        </button>

        <img
          src={fullUrl}
          alt={item.filename}
          style={styles.lightboxImage}
        />

        <div style={styles.lightboxInfo}>
          <span style={styles.lightboxFilename}>{item.filename}</span>
          <span style={styles.lightboxDate}>{uploadDate}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-6)',
    border: '2px dashed var(--color-neutral-200)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-neutral-50)',
    transition: 'all var(--duration-normal) var(--easing-default)',
  },
  dropZoneActive: {
    borderColor: 'var(--color-primary-400)',
    backgroundColor: 'var(--color-primary-50)',
  },
  dropText: {
    margin: 0,
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-500)',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    width: '100%',
    maxWidth: '300px',
  },
  progressTrack: {
    flex: 1,
    height: '6px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-neutral-200)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'var(--color-primary-500)',
    borderRadius: 'var(--radius-full)',
    transition: 'width var(--duration-normal) var(--easing-default)',
  },
  progressText: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-neutral-500)',
    minWidth: '36px',
    textAlign: 'right' as const,
  },
  errorText: {
    margin: 0,
    fontSize: 'var(--text-sm)',
    color: 'var(--color-danger-500)',
    fontWeight: 500,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-8)',
  },
  emptyText: {
    margin: 0,
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-400)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 'var(--space-3)',
  },
  thumbnailWrapper: {
    position: 'relative',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    aspectRatio: '1',
    backgroundColor: 'var(--color-neutral-100)',
  },
  thumbnailButton: {
    display: 'block',
    width: '100%',
    height: '100%',
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbnailOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    padding: 'var(--space-2)',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 60%)',
  },
  deleteButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-full)',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: 'var(--color-danger-500)',
    cursor: 'pointer',
  },
  lightboxOverlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 1000,
    padding: 'var(--space-4)',
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
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-full)',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: 'white',
    cursor: 'pointer',
  },
  lightboxImage: {
    maxWidth: '100%',
    maxHeight: '80vh',
    objectFit: 'contain',
    borderRadius: 'var(--radius-md)',
  },
  lightboxInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-1)',
    marginTop: 'var(--space-3)',
  },
  lightboxFilename: {
    fontSize: 'var(--text-sm)',
    color: 'rgba(255,255,255,0.9)',
    fontWeight: 500,
  },
  lightboxDate: {
    fontSize: 'var(--text-xs)',
    color: 'rgba(255,255,255,0.6)',
  },
};
