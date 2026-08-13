import { useState } from 'react';
import { Button } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { useLanguage } from '@/components/design-system';
import { windFarmSchema, type WindFarmFormData } from '@/utils/validation';
import type { WindFarm } from '@/types';

export interface WindFarmFormProps {
  initialData?: WindFarm;
  onSubmit: (data: WindFarmFormData) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function WindFarmForm({ initialData, onSubmit, onCancel, loading = false }: WindFarmFormProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialData?.name ?? '');
  const [location, setLocation] = useState(initialData?.location ?? '');
  const [latitude, setLatitude] = useState(initialData?.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(initialData?.longitude?.toString() ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData: Record<string, unknown> = {
      name: name.trim(),
      location: location.trim(),
    };

    if (latitude.trim()) {
      const parsed = parseFloat(latitude.trim());
      if (isNaN(parsed)) {
        setErrors({ latitude: 'Latitude must be a valid number' });
        return;
      }
      formData.latitude = parsed;
    }

    if (longitude.trim()) {
      const parsed = parseFloat(longitude.trim());
      if (isNaN(parsed)) {
        setErrors({ longitude: 'Longitude must be a valid number' });
        return;
      }
      formData.longitude = parsed;
    }

    const result = windFarmSchema.safeParse(formData);
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
        label={t('windFarmForm.name')}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        placeholder={t('windFarmForm.namePlaceholder')}
      />
      <FormField
        label={t('windFarmForm.location')}
        required
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        error={errors.location}
        placeholder={t('windFarmForm.locationPlaceholder')}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <FormField
          label={t('windFarmForm.latitude')}
          type="text"
          inputMode="decimal"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          error={errors.latitude}
          placeholder={t('windFarmForm.latPlaceholder')}
        />
        <FormField
          label={t('windFarmForm.longitude')}
          type="text"
          inputMode="decimal"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          error={errors.longitude}
          placeholder={t('windFarmForm.lonPlaceholder')}
        />
      </div>
      <div style={actionsStyle}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          {t('button.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {initialData ? t('windFarmForm.updateWindFarm') : t('windFarmForm.createWindFarm')}
        </Button>
      </div>
    </form>
  );
}
