import { useState } from 'react';
import type { DashboardFilters } from '@/services/dashboard.service';
import {
  useInspectionPipeline,
  useDefectsSpread,
  useInspectionOperations,
  useSubassetsStatus,
} from '@/hooks/useDashboard';
import { ChartCard } from '@/components/organisms/ChartCard';
import {
  InspectionPipelineChart,
  DefectsSpreadChart,
  InspectionOperationsChart,
  SubassetsStatusChart,
} from '@/components/organisms/charts';

export default function Dashboard() {
  const [pipelineFilters] = useState<DashboardFilters | undefined>(undefined);
  const [defectsFilters] = useState<DashboardFilters | undefined>(undefined);
  const [operationsFilters] = useState<DashboardFilters | undefined>(undefined);
  const [subassetsFilters] = useState<DashboardFilters | undefined>(undefined);

  const pipeline = useInspectionPipeline(pipelineFilters);
  const defects = useDefectsSpread(defectsFilters);
  const operations = useInspectionOperations(operationsFilters);
  const subassets = useSubassetsStatus(subassetsFilters);

  return (
    <div style={{ padding: 'var(--spacing-6, 1.5rem)' }}>
      <h1 style={{ margin: '0 0 var(--spacing-6, 1.5rem)', fontSize: 'var(--font-size-xl, 1.25rem)', fontWeight: 700 }}>
        Dashboard
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 'var(--spacing-4, 1rem)',
        }}
      >
        <ChartCard
          title="Inspection Pipeline"
          isLoading={pipeline.isLoading}
          isError={pipeline.isError}
          isEmpty={!pipeline.data || pipeline.data.length === 0}
        >
          {pipeline.data && <InspectionPipelineChart data={pipeline.data} />}
        </ChartCard>

        <ChartCard
          title="Defects Spread"
          isLoading={defects.isLoading}
          isError={defects.isError}
          isEmpty={!defects.data || defects.data.length === 0}
        >
          {defects.data && <DefectsSpreadChart data={defects.data} />}
        </ChartCard>

        <ChartCard
          title="Inspection Operations"
          isLoading={operations.isLoading}
          isError={operations.isError}
          isEmpty={!operations.data || operations.data.length === 0}
        >
          {operations.data && <InspectionOperationsChart data={operations.data} />}
        </ChartCard>

        <ChartCard
          title="Sub-assets Status"
          isLoading={subassets.isLoading}
          isError={subassets.isError}
          isEmpty={!subassets.data || subassets.data.length === 0}
        >
          {subassets.data && <SubassetsStatusChart data={subassets.data} />}
        </ChartCard>
      </div>
    </div>
  );
}
