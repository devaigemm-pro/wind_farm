import { useState } from 'react';
import { Button } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { useLanguage } from '@/components/design-system';
import { bladeSchema, type BladeFormData } from '@/utils/validation';
import type { Blade } from '@/types';

export interface BladeFormProps {
  initialData: Blade;
  onSubmit: (data: BladeFormData) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function BladeForm({ initialData, onSubmit, onCancel, loading = false }: BladeFormProps) {
  const { t } = useLanguage();
  const [serialNumber, setSerialNumber] = useState(initialData.serial_number ?? '');
  const [lengthMeters, setLengthMeters] = useState(initialData.length_meters?.toString() ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData: Record<string, unknown> = {};

    if (serialNumber.trim()) {
      formData.serial_number = serialNumber.trim();
    }

    if (lengthMeters.trim()) {
      const parsed = parseFloat(lengthMeters.trim());
      if (isNaN(parsed)) {
        setErrors({ length_meters: t('bladeForm.lengthError') });
        return;
      }
      formData.length_meters = parsed;
    }

    const result = bladeSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0]?.toString();
        if (field) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    await onSubmit(result.data);
  };

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    fontFamily: 'var(--font-family-sans)',
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--space-3)',
    marginTop: 'var(--space-4)',
    paddingTop: 'var(--space-4)',
    borderTop: '1px solid var(--color-neutral-100)',
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle} noValidate>
      <FormField
        label={t('bladeForm.serialNumber')}
        value={serialNumber}
        onChange={(e) => setSerialNumber(e.target.value)}
        error={errors.serial_number}
        placeholder={t('bladeForm.serialNumberPlaceholder')}
      />
      <FormField
        label={t('bladeForm.lengthMeters')}
        type="text"
        inputMode="decimal"
        value={lengthMeters}
        onChange={(e) => setLengthMeters(e.target.value)}
        error={errors.length_meters}
        placeholder={t('bladeForm.lengthPlaceholder')}
      />
      <div style={actionsStyle}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          {t('button.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {t('bladeForm.updateBlade')}
        </Button>
      </div>
    </form>
  );
}
