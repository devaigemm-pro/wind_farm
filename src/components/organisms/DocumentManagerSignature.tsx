import { useRef } from 'react';
import { Button } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import {
  useDocumentManagerSignature,
  useUploadDocumentManagerSignature,
} from '@/hooks/useDocumentManagerSignature';

export interface DocumentManagerSignatureProps {
  /** Selected document manager; nothing renders until one is picked. */
  managerName: string;
}

/**
 * Preview + upload of the selected document manager's signature. The image is
 * saved per manager (not per wind farm) and is printed on the signature page of
 * the repair report. Uploading is immediate and independent of saving the farm.
 */
export function DocumentManagerSignature({ managerName }: DocumentManagerSignatureProps) {
  const { t } = useLanguage();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: signatureUrl, isLoading } = useDocumentManagerSignature(managerName);
  const upload = useUploadDocumentManagerSignature();

  if (!managerName) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await upload.mutateAsync({ managerName, file });
      toast.success(t('windFarmForm.signatureUploaded'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('windFarmForm.signatureError'));
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        border: '1px dashed var(--color-neutral-300)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-neutral-50)',
      }}
    >
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-neutral-800)' }}>
        {t('windFarmForm.signature')}
      </span>
      <div
        style={{
          minHeight: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          border: '1px solid var(--color-neutral-200)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2)',
        }}
      >
        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt={`${t('windFarmForm.signature')} · ${managerName}`}
            style={{ maxWidth: '100%', maxHeight: '96px', objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
            {isLoading ? t('general.loading') : t('windFarmForm.signatureNone')}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          loading={upload.isPending}
        >
          {signatureUrl ? t('windFarmForm.signatureReplace') : t('windFarmForm.signatureUpload')}
        </Button>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
          {t('windFarmForm.signatureHint')}
        </span>
      </div>
    </div>
  );
}
