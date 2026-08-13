import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { useLanguage } from '@/components/design-system';

export interface OperationsDataItem {
  month: string;
  planned: number;
  done: number;
  toPlan?: number;
}

export interface InspectionOperationsChartProps {
  data: OperationsDataItem[];
}

export function InspectionOperationsChart({ data }: InspectionOperationsChartProps) {
  const { t } = useLanguage();
  // Find index of current month to draw a "Now" reference line
  const now = new Date();
  const currentMonthShort = now.toLocaleString('en', { month: 'short' });
  const nowIndex = data.findIndex(
    (d) => d.month.toLowerCase().startsWith(currentMonthShort.toLowerCase())
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200, #e2e8f0)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: 'var(--color-neutral-500, #64748b)' }}
          axisLine={{ stroke: 'var(--color-neutral-200, #e2e8f0)' }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--color-neutral-500, #64748b)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: '13px',
          }}
          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              toPlan: t('chart.inspectionsToPlan'),
              planned: t('chart.inspectionsPlanned'),
              done: t('chart.inspectionsDone'),
            };
            return labels[value] ?? value;
          }}
        />
        {nowIndex >= 0 && (
          <ReferenceLine
            x={data[nowIndex]?.month}
            stroke="#5a9e5a"
            label={{ value: t('chart.now'), position: 'top', fill: '#5a9e5a', fontSize: 11, fontWeight: 600 }}
          />
        )}
        <Bar dataKey="toPlan" fill="#2c3e6b" radius={[4, 4, 0, 0]} maxBarSize={32}>
          <LabelList dataKey="toPlan" position="top" fontSize={10} fill="var(--color-neutral-500, #64748b)" />
        </Bar>
        <Bar dataKey="planned" fill="#8a8a8a" radius={[4, 4, 0, 0]} maxBarSize={32}>
          <LabelList dataKey="planned" position="top" fontSize={10} fill="var(--color-neutral-500, #64748b)" />
        </Bar>
        <Bar dataKey="done" fill="#5a9e5a" radius={[4, 4, 0, 0]} maxBarSize={32}>
          <LabelList dataKey="done" position="top" fontSize={10} fill="var(--color-neutral-500, #64748b)" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
