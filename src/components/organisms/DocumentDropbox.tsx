import { useRef } from 'react';
import { FileText, Upload, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/atoms';
import { useAssetDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useWindFarmDetail';
import { assetDetailService } from '@/services/asset-detail.service';
import { useToast } from '@/store/toastStore';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import type { AssetDocument } from '@/types';

export interface DocumentDropboxProps {
  windFarmId: string;
}

export function DocumentDropbox({ windFarmId }: DocumentDropboxProps) {
  const { role } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: documents, isLoading } = useAssetDocuments(windFarmId);
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const canUpload = role !== 'supervisor';
  const canDelete = role !== 'supervisor';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
    ];
    if (!allowed.includes(file.type)) {
      toast.error(t('toast.fileTypeNotAllowed'));
      return;
    }

    try {
      await uploadMutation.mutateAsync({ windFarmId, file });
      toast.success(t('toast.documentUploaded'));
    } catch {
      toast.error(t('toast.documentUploadFailed'));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (doc: AssetDocument) => {
    try {
      const url = await assetDetailService.getDocumentUrl(doc.filePath);
      window.open(url, '_blank');
    } catch {
      toast.error(t('toast.documentDownloadFailed'));
    }
  };

  const handleDelete = async (doc: AssetDocument) => {
    if (!confirm(`Delete "${doc.fileName}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ documentId: doc.id, filePath: doc.filePath });
      toast.success(t('toast.documentDeleted'));
    } catch {
      toast.error(t('toast.documentDeleteFailed'));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h4 style={titleStyle}>{t('documents.title')}</h4>
        {canUpload && (
          <Button
            variant="primary"
            size="sm"
            icon={Upload}
            onClick={() => fileInputRef.current?.click()}
            loading={uploadMutation.isPending}
          >
            {t('button.addDocument')}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          onChange={handleFileChange}
        />
      </div>

      {isLoading ? (
        <p style={placeholderStyle}>{t('documents.loadingDocs')}</p>
      ) : documents && documents.length > 0 ? (
        <div style={listStyle}>
          {documents.map((doc) => (
            <div key={doc.id} style={docRowStyle}>
              <FileText size={16} style={{ color: 'var(--color-primary-500)', flexShrink: 0 }} />
              <span style={docNameStyle}>{doc.fileName}</span>
              <span style={docSizeStyle}>{formatSize(doc.fileSize)}</span>
              <button
                style={iconBtnStyle}
                onClick={() => handleDownload(doc)}
                title="Download"
              >
                <Download size={14} />
              </button>
              {canDelete && (
                <button
                  style={iconBtnStyle}
                  onClick={() => handleDelete(doc)}
                  title="Delete"
                >
                  <Trash2 size={14} color="var(--color-danger-500)" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={placeholderStyle}>
          {t('documents.placeholder')}
        </p>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  borderTop: '1px solid var(--color-neutral-200)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-3)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--color-neutral-900)',
  margin: 0,
};

const placeholderStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--color-neutral-500)',
  margin: 0,
  lineHeight: 1.5,
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const docRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--color-neutral-50)',
};

const docNameStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 'var(--text-xs)',
  color: 'var(--color-neutral-800)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const docSizeStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--color-neutral-500)',
  flexShrink: 0,
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  borderRadius: 'var(--radius-sm)',
};
