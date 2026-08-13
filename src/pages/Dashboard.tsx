import { useState } from 'react';
import './Dashboard.css';
import type { DashboardFilters } from '@/services/dashboard.service';
import {
  useInspectionPipeline,
  useDefectsSpread,
  useInspectionOperations,
  useSubassetsStatus,
} from '@/hooks/useDashboard';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { ChartCard } from '@/components/organisms/ChartCard';
import {
  InspectionPipelineChart,
  DefectsSpreadChart,
  InspectionOperationsChart,
  SubassetsStatusChart,
} from '@/components/organisms/charts';
import { FilterSelect } from '@/components/atoms/FilterSelect';

// Asset type options — "Type(s)" refers to sub-asset types in Skyvisor
const TYPE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Blades', value: 'blades' },
  { label: 'Tower', value: 'tower' },
  { label: 'Nacelle', value: 'nacelle' },
];

const SEVERITY_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Severity 1', value: '1' },
  { label: 'Severity 2', value: '2' },
  { label: 'Severity 3', value: '3' },
  { label: 'Severity 4', value: '4' },
  { label: 'Severity 5', value: '5' },
];

export default function Dashboard() {
  const { data: filterOptions } = useDashboardFilters();

  const FARM_OPTIONS = filterOptions?.farmOptions ?? [{ label: 'All Farms', value: '' }];
  const MODEL_OPTIONS = filterOptions?.modelOptions ?? [{ label: 'All Models', value: '' }];

  // ─── Inspection Pipeline filters (Type only) ────────────────────────
  const [pipelineType, setPipelineType] = useState('');
  const pipelineFilters: DashboardFilters | undefined = pipelineType
    ? { types: [pipelineType] }
    : undefined;

  // ─── Defects Spread filters (Type, Farm, Model, Severity) ───────────
  const [defectsType, setDefectsType] = useState('');
  const [defectsFarm, setDefectsFarm] = useState('');
  const [defectsModel, setDefectsModel] = useState('');
  const [defectsSeverity, setDefectsSeverity] = useState('');
  const defectsFilters: DashboardFilters | undefined =
    defectsType || defectsFarm || defectsModel || defectsSeverity
      ? {
          types: defectsType ? [defectsType] : undefined,
          farms: defectsFarm ? [defectsFarm] : undefined,
          models: defectsModel ? [defectsModel] : undefined,
          severity: defectsSeverity ? Number(defectsSeverity) : undefined,
        }
      : undefined;

  // ─── Inspection Operations filters (Type, Farm) ─────────────────────
  const [opsType, setOpsType] = useState('');
  const [opsFarm, setOpsFarm] = useState('');
  const opsFilters: DashboardFilters | undefined =
    opsType || opsFarm
      ? {
          types: opsType ? [opsType] : undefined,
          farms: opsFarm ? [opsFarm] : undefined,
        }
      : undefined;

  // ─── Subassets Status filters (Type only) ───────────────────────────
  const [subassetType, setSubassetType] = useState('');
  const subassetFilters: DashboardFilters | undefined = subassetType
    ? { types: [subassetType] }
    : undefined;

  // ─── Data hooks ─────────────────────────────────────────────────────
  const pipeline = useInspectionPipeline(pipelineFilters);
  const defects = useDefectsSpread(defectsFilters);
  const operations = useInspectionOperations(opsFilters);
  const subassets = useSubassetsStatus(subassetFilters);

  // ─── Filter slots per chart ─────────────────────────────────────────

  const pipelineFilterSlot = (
    <FilterSelect
      label="Type(s)"
      value={pipelineType}
      options={TYPE_OPTIONS}
      onChange={setPipelineType}
    />
  );

  const defectsFilterSlot = (
    <>
      <FilterSelect
        label="Type(s)"
        value={defectsType}
        options={TYPE_OPTIONS}
        onChange={setDefectsType}
      />
      <FilterSelect
        label="Farm(s)"
        value={defectsFarm}
        options={FARM_OPTIONS}
        onChange={setDefectsFarm}
      />
      <FilterSelect
        label="Model(s)"
        value={defectsModel}
        options={MODEL_OPTIONS}
        onChange={setDefectsModel}
      />
      <FilterSelect
        label="Severity"
        value={defectsSeverity}
        options={SEVERITY_OPTIONS}
        onChange={setDefectsSeverity}
      />
    </>
  );

  const opsFilterSlot = (
    <>
      <FilterSelect
        label="Type(s)"
        value={opsType}
        options={TYPE_OPTIONS}
        onChange={setOpsType}
      />
      <FilterSelect
        label="Farm(s)"
        value={opsFarm}
        options={FARM_OPTIONS}
        onChange={setOpsFarm}
      />
    </>
  );

  const subassetFilterSlot = (
    <FilterSelect
      label="Type(s)"
      value={subassetType}
      options={TYPE_OPTIONS}
      onChange={setSubassetType}
    />
  );

  return (
    <div className="dashboard-page">
      {/* Header row */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
      </div>

      {/* Top row: pipeline (smaller) + defects spread (larger) */}
      <div className="dashboard-grid dashboard-grid--top">
        <ChartCard
          title="Inspection Pipeline"
          isLoading={pipeline.isLoading}
          isError={pipeline.isError}
          isEmpty={!pipeline.data || pipeline.data.length === 0}
          filterSlot={pipelineFilterSlot}
        >
          {pipeline.data && <InspectionPipelineChart data={pipeline.data} />}
        </ChartCard>

        <ChartCard
          title="Defects Spread"
          isLoading={defects.isLoading}
          isError={defects.isError}
          isEmpty={!defects.data || defects.data.length === 0}
          filterSlot={defectsFilterSlot}
          className="dashboard-card--wide"
        >
          {defects.data && <DefectsSpreadChart data={defects.data} />}
        </ChartCard>
      </div>

      {/* Bottom row: operations (larger) + subassets status (smaller) */}
      <div className="dashboard-grid dashboard-grid--bottom">
        <ChartCard
          title="Inspection Operations"
          isLoading={operations.isLoading}
          isError={operations.isError}
          isEmpty={!operations.data || operations.data.length === 0}
          filterSlot={opsFilterSlot}
          className="dashboard-card--wide"
        >
          {operations.data && <InspectionOperationsChart data={operations.data} />}
        </ChartCard>

        <ChartCard
          title="Sub-assets Status"
          isLoading={subassets.isLoading}
          isError={subassets.isError}
          isEmpty={!subassets.data || subassets.data.length === 0}
          filterSlot={subassetFilterSlot}
        >
          {subassets.data && <SubassetsStatusChart data={subassets.data} />}
        </ChartCard>
      </div>
    </div>
  );
}
