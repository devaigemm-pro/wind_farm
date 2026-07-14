import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { useAssetTree } from '@/hooks/useAssetTree';
import { useCreateInspection } from '@/hooks/useInspectionMutations';
import { useToast } from '@/store/toastStore';
import { inspectionSchema } from '@/utils/validation';

export function NewInspection() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: treeData, isLoading: treeLoading } = useAssetTree();
  const createInspection = useCreateInspection();

  const [bladeId, setBladeId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [errors, setErrors] = useState<{ blade_id?: string; scheduled_date?: string }>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = inspectionSchema.safeParse({
      blade_id: bladeId,
      scheduled_date: scheduledDate,
    });

    if (!result.success) {
      const fieldErrors: { blade_id?: string; scheduled_date?: string } = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as 'blade_id' | 'scheduled_date';
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      const newInspection = await createInspection.mutateAsync({
        blade_id: result.data.blade_id,
        scheduled_date: result.data.scheduled_date,
      });
      toast.success('Inspection created successfully');
      navigate(`/inspections/${newInspection.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create inspection';
      toast.error(message);
    }
  };

  const handleCancel = () => {
    navigate('/inspections');
  };

  // Styles
  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4)',
    borderBottom: '1px solid var(--color-neutral-100)',
    flexShrink: 0,
  };

  const headerTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--text-xl)',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-6)',
    maxWidth: '560px',
  };

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-5)',
  };

  const fieldContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    color: 'var(--color-neutral-800)',
    fontFamily: 'var(--font-family-sans)',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${errors.blade_id ? 'var(--color-danger-500)' : 'var(--color-neutral-200)'}`,
    backgroundColor: 'var(--color-neutral-0)',
    color: 'var(--color-neutral-900)',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-2) var(--space-3)',
    height: '40px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-danger-500)',
    margin: 0,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-3)',
    paddingTop: 'var(--space-2)',
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          aria-label="Back to inspections"
        >
          <ArrowLeft size={16} />
        </Button>
        <h1 style={headerTitleStyle}>New Inspection</h1>
      </div>

      <div style={contentStyle}>
        <form onSubmit={handleSubmit} style={formStyle} noValidate>
          {/* Blade selector - grouped by Farm → Turbine */}
          <div style={fieldContainerStyle}>
            <label htmlFor="blade-select" style={labelStyle}>
              Blade<span style={{ color: 'var(--color-danger-500)', marginLeft: '2px' }} aria-hidden="true">*</span>
            </label>
            <select
              id="blade-select"
              value={bladeId}
              onChange={(e) => setBladeId(e.target.value)}
              style={selectStyle}
              aria-required="true"
              aria-invalid={errors.blade_id ? true : undefined}
              aria-describedby={errors.blade_id ? 'blade-error' : undefined}
              disabled={treeLoading}
            >
              <option value="">Select a blade...</option>
              {treeData?.map((farm) => (
                <optgroup key={farm.id} label={farm.name}>
                  {farm.turbines?.map((turbine) =>
                    turbine.blades?.map((blade) => (
                      <option key={blade.id} value={blade.id}>
                        {turbine.name} → {blade.position ?? blade.id.slice(0, 8)}
                      </option>
                    )),
                  )}
                </optgroup>
              ))}
            </select>
            {errors.blade_id && (
              <p id="blade-error" role="alert" style={errorStyle}>
                {errors.blade_id}
              </p>
            )}
          </div>

          {/* Scheduled date */}
          <FormField
            label="Scheduled Date"
            type="date"
            required
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            error={errors.scheduled_date}
          />

          {/* Actions */}
          <div style={actionsStyle}>
            <Button
              type="submit"
              variant="primary"
              loading={createInspection.isPending}
            >
              Create Inspection
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
