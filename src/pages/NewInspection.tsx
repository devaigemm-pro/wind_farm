import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/atoms';
import { InspectionConfigForm } from '@/components/organisms/InspectionConfigForm';
import { SubassetsSelectionPanel } from '@/components/organisms/SubassetsSelectionPanel';
import { WeatherMapPanel } from '@/components/organisms/WeatherMapPanel';
import {
  useWindFarmsList,
  useSubassetsForSelection,
  useWindFarmCoordinates,
  useCreateCampaignInspections,
} from '@/hooks/useNewInspection';
import { useToast } from '@/store/toastStore';
import { useLanguage } from '@/components/design-system';
import { newCampaignInspectionSchema } from '@/utils/validation';
import type { InspectionType, InspectionMethod } from '@/types';

function getDefaultCampaignName(): string {
  const now = new Date();
  return now.toLocaleString('en', { month: 'long', year: 'numeric' });
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

export function NewInspection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { t } = useLanguage();

  // ─── Data hooks ─────────────────────────────────────────────────────────
  const { data: windFarms = [], isLoading: isLoadingFarms } = useWindFarmsList();
  const createMutation = useCreateCampaignInspections();

  // ─── Form state ─────────────────────────────────────────────────────────
  const [windFarmId, setWindFarmId] = useState<string | null>(
    searchParams.get('windFarm') || null,
  );
  const [inspectionType, setInspectionType] = useState<InspectionType>('blades');
  const [inspectionMethod, setInspectionMethod] = useState<InspectionMethod>('skyvisor');
  const [scheduledDate, setScheduledDate] = useState(getTodayISO());
  const [campaignName, setCampaignName] = useState(getDefaultCampaignName());
  const [notes, setNotes] = useState('');
  const [selectedTurbineIds, setSelectedTurbineIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Dependent data hooks ───────────────────────────────────────────────
  const { data: subassets = [], isLoading: isLoadingSubassets } =
    useSubassetsForSelection(windFarmId);
  const { data: coordinates, isLoading: isLoadingCoords } =
    useWindFarmCoordinates(windFarmId);

  // ─── Auto-select first wind farm if none from URL ───────────────────────
  useEffect(() => {
    if (!windFarmId && windFarms.length > 0) {
      setWindFarmId(windFarms[0]!.id);
    }
  }, [windFarms, windFarmId]);

  // ─── Auto-select all turbines when subassets load ───────────────────────
  useEffect(() => {
    if (subassets.length > 0) {
      setSelectedTurbineIds(subassets.map((s) => s.id));
    }
  }, [subassets]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleWindFarmChange = (id: string) => {
    setWindFarmId(id);
    setSelectedTurbineIds([]);
    setErrors({});
  };

  const handleCreate = async () => {
    setErrors({});

    const input = {
      windFarmId: windFarmId ?? '',
      campaignName: campaignName.trim(),
      inspectionType,
      inspectionMethod,
      scheduledDate,
      notes,
      selectedTurbineIds,
    };

    const result = newCampaignInspectionSchema.safeParse(input);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      await createMutation.mutateAsync(result.data);
      toast.success(t('toast.campaignCreated'));
      navigate(windFarmId ? `/assets-wind/${windFarmId}` : '/inspections');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('toast.campaignDeleteFailed');
      toast.error(message);
    }
  };

  const isCreateDisabled =
    campaignName.trim() === '' || selectedTurbineIds.length === 0;

  // ─── Styles ─────────────────────────────────────────────────────────────
  const pageStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: CSSProperties = {
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--color-neutral-100)',
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: 'var(--text-xl)',
    fontWeight: 700,
    color: '#111827',
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr 1.6fr',
    gap: 'var(--space-4)',
    flex: 1,
    overflow: 'hidden',
    padding: 'var(--space-4) var(--space-5)',
  };

  const leftColumnStyle: CSSProperties = {
    overflowY: 'auto',
    paddingRight: 'var(--space-2)',
  };

  const centerColumnStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  };

  const rightColumnStyle: CSSProperties = {
    overflow: 'hidden',
    borderRadius: 'var(--radius-lg)',
  };

  const createButtonContainerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: 'var(--space-3) 0',
    marginTop: 'auto',
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>{t('page.newInspection')}</h1>
      </div>

      <div style={gridStyle}>
        {/* Left Column — Form */}
        <div style={leftColumnStyle}>
          <InspectionConfigForm
            windFarms={windFarms}
            selectedWindFarmId={windFarmId}
            inspectionType={inspectionType}
            inspectionMethod={inspectionMethod}
            scheduledDate={scheduledDate}
            campaignName={campaignName}
            notes={notes}
            errors={errors}
            isLoadingFarms={isLoadingFarms}
            onWindFarmChange={handleWindFarmChange}
            onTypeChange={setInspectionType}
            onMethodChange={setInspectionMethod}
            onDateChange={setScheduledDate}
            onCampaignNameChange={setCampaignName}
            onNotesChange={setNotes}
          />
        </div>

        {/* Center Column — Subassets Table + CREATE button */}
        <div style={centerColumnStyle}>
          <SubassetsSelectionPanel
            data={subassets}
            isLoading={isLoadingSubassets}
            selectedIds={selectedTurbineIds}
            onSelectionChange={setSelectedTurbineIds}
          />
          <div style={createButtonContainerStyle}>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={isCreateDisabled}
              loading={createMutation.isPending}
              style={{
                backgroundColor: isCreateDisabled ? undefined : '#5A8F5A',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              {t('button.createInspection')}
            </Button>
          </div>
        </div>

        {/* Right Column — Weather Map */}
        <div style={rightColumnStyle}>
          <WeatherMapPanel
            latitude={coordinates?.latitude ?? null}
            longitude={coordinates?.longitude ?? null}
            isLoading={isLoadingCoords}
          />
        </div>
      </div>
    </div>
  );
}
