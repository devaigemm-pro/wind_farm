import type { CSSProperties } from 'react';
import { AssetSelector } from '@/components/molecules/AssetSelector';
import { SegmentedControl } from '@/components/molecules/SegmentedControl';
import { DatePickerField } from '@/components/molecules/DatePickerField';
import type { InspectionType, InspectionMethod } from '@/types';

export interface InspectionConfigFormProps {
  windFarms: { id: string; name: string }[];
  selectedWindFarmId: string | null;
  inspectionType: InspectionType;
  inspectionMethod: InspectionMethod;
  scheduledDate: string;
  campaignName: string;
  notes: string;
  errors: Record<string, string>;
  isLoadingFarms: boolean;
  onWindFarmChange: (id: string) => void;
  onTypeChange: (type: InspectionType) => void;
  onMethodChange: (method: InspectionMethod) => void;
  onDateChange: (date: string) => void;
  onCampaignNameChange: (name: string) => void;
  onNotesChange: (notes: string) => void;
}

export function InspectionConfigForm({
  windFarms,
  selectedWindFarmId,
  inspectionType,
  inspectionMethod,
  scheduledDate,
  campaignName,
  notes,
  errors,
  isLoadingFarms,
  onWindFarmChange,
  onTypeChange,
  onMethodChange,
  onDateChange,
  onCampaignNameChange,
  onNotesChange,
}: InspectionConfigFormProps) {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    padding: 'var(--space-3) 0',
  };

  const fieldLabelStyle: CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color: 'var(--color-neutral-600)',
    fontFamily: 'var(--font-family-sans)',
    marginBottom: 'var(--space-1)',
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    border: `1px solid ${errors.campaignName ? 'var(--color-danger-500)' : 'var(--color-neutral-200)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-900)',
    backgroundColor: 'var(--color-neutral-0)',
    outline: 'none',
    boxSizing: 'border-box' as const,
    height: '40px',
  };

  const textareaStyle: CSSProperties = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-900)',
    backgroundColor: 'var(--color-neutral-0)',
    outline: 'none',
    boxSizing: 'border-box' as const,
    minHeight: '80px',
    resize: 'vertical' as const,
  };

  const errorStyle: CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-danger-500)',
    fontFamily: 'var(--font-family-sans)',
    margin: 0,
  };

  return (
    <div style={containerStyle}>
      {/* Asset Selector */}
      <AssetSelector
        windFarms={windFarms}
        value={selectedWindFarmId}
        onChange={onWindFarmChange}
        isLoading={isLoadingFarms}
      />

      {/* Type */}
      <div>
        <div style={fieldLabelStyle}>Type</div>
        <SegmentedControl
          name="Inspection type"
          options={[
            { value: 'blades', label: 'BLADES' },
            { value: 'tower', label: 'TOWER' },
          ]}
          value={inspectionType}
          onChange={(v) => onTypeChange(v as InspectionType)}
        />
      </div>

      {/* Method */}
      <div>
        <div style={fieldLabelStyle}>Method</div>
        <SegmentedControl
          name="Inspection method"
          options={[
            { value: 'skyvisor', label: 'CORE Insight' },
            { value: 'external', label: 'External >' },
          ]}
          value={inspectionMethod}
          onChange={(v) => onMethodChange(v as InspectionMethod)}
        />
      </div>

      {/* Inspection Date */}
      <DatePickerField
        label="Inspection Date"
        value={scheduledDate}
        onChange={onDateChange}
        error={errors.scheduledDate}
        required
      />

      {/* Campaign Name */}
      <div>
        <div style={fieldLabelStyle}>
          Campaign name
          <span style={{ color: 'var(--color-danger-500)', marginLeft: '2px' }}>*</span>
        </div>
        <input
          type="text"
          value={campaignName}
          onChange={(e) => onCampaignNameChange(e.target.value)}
          style={inputStyle}
          aria-label="Campaign name"
          aria-required="true"
          aria-invalid={!!errors.campaignName}
        />
        {errors.campaignName && <p style={errorStyle} role="alert">{errors.campaignName}</p>}
      </div>

      {/* Notes */}
      <div>
        <div style={fieldLabelStyle}>Notes</div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          style={textareaStyle}
          placeholder=""
          aria-label="Notes"
        />
      </div>

    </div>
  );
}
