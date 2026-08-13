import { useState } from 'react';
import { Button } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { useLanguage } from '@/components/design-system';
import { turbineSchema, type TurbineFormData } from '@/utils/validation';
import type { Turbine } from '@/types';

export interface TurbineFormProps {
  windFarmId: string;
  initialData?: Turbine;
  onSubmit: (data: TurbineFormData) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function TurbineForm({ windFarmId, initialData, onSubmit, onCancel, loading = false }: TurbineFormProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialData?.name ?? '');
  const [model, setModel] = useState(initialData?.model ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData: Record<string, unknown> = {
      wind_farm_id: windFarmId,
      name: name.trim(),
    };

    if (model.trim()) {
      formData.model = model.trim();
    }

    const result = turbineSchema.safeParse(formData);
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
        label={t('turbineForm.name')}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        placeholder={t('turbineForm.namePlaceholder')}
      />
      <FormField
        label={t('turbineForm.model')}
        value={model}
        onChange={(e) => setModel(e.target.value)}
        error={errors.model}
        placeholder={t('turbineForm.modelPlaceholder')}
      />
      <div style={actionsStyle}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          {t('button.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {initialData ? t('turbineForm.updateTurbine') : t('turbineForm.createTurbine')}
        </Button>
      </div>
    </form>
  );
}
