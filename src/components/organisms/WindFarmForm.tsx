import { useState } from 'react';
import { Button } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { useLanguage } from '@/components/design-system';
import { windFarmSchema, type WindFarmFormData } from '@/utils/validation';
import { DOCUMENT_MANAGERS } from '@/constants/document-managers';
import { DocumentManagerSignature } from './DocumentManagerSignature';
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
  const [country, setCountry] = useState(initialData?.country ?? '');
  const [client, setClient] = useState(initialData?.client ?? '');
  const [latitude, setLatitude] = useState(initialData?.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(initialData?.longitude?.toString() ?? '');
  const [managerName, setManagerName] = useState(initialData?.manager_name ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData: Record<string, unknown> = {
      name: name.trim(),
      location: location.trim(),
      manager_name: managerName.trim(),
    };

    if (country.trim()) {
      formData.country = country.trim();
    }

    if (client.trim()) {
      formData.client = client.trim();
    }

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
          fieldErrors[field] =
            field === 'manager_name' ? t('windFarmForm.documentManagerRequired') : issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    await onSubmit(result.data);
  };

  // Selectable managers; keep the farm's current one visible even if it is no
  // longer in the list (e.g. a previous manager), so editing doesn't drop it.
  const managerOptions =
    managerName && !DOCUMENT_MANAGERS.includes(managerName)
      ? [managerName, ...DOCUMENT_MANAGERS]
      : [...DOCUMENT_MANAGERS];

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          htmlFor="windFarmManager"
          style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-neutral-800)' }}
        >
          {t('windFarmForm.documentManager')}
          <span style={{ color: 'var(--color-danger-500)', marginLeft: '2px' }} aria-hidden="true">
            *
          </span>
        </label>
        <select
          id="windFarmManager"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          aria-required
          aria-invalid={errors.manager_name ? true : undefined}
          style={{
            width: '100%',
            height: '40px',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-family-sans)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${errors.manager_name ? 'var(--color-danger-500)' : 'var(--color-neutral-200)'}`,
            backgroundColor: 'var(--color-neutral-0)',
            color: 'var(--color-neutral-900)',
            boxSizing: 'border-box',
          }}
        >
          <option value="">{t('windFarmForm.selectDocumentManager')}</option>
          {managerOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {errors.manager_name && (
          <p role="alert" style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-danger-500)' }}>
            {errors.manager_name}
          </p>
        )}
      </div>
      <DocumentManagerSignature managerName={managerName} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <FormField
          label={t('windFarmForm.country')}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={errors.country}
          placeholder={t('windFarmForm.countryPlaceholder')}
        />
        <FormField
          label={t('windFarmForm.client')}
          value={client}
          onChange={(e) => setClient(e.target.value)}
          error={errors.client}
          placeholder={t('windFarmForm.clientPlaceholder')}
        />
      </div>
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
