import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

export interface PipelineDataItem {
  stage: string;
  count: number;
}

export interface InspectionPipelineChartProps {
  data: PipelineDataItem[];
}

const STAGE_COLORS = [
  'darkblue',  // To plan
  '#E8833A',   // Planned - orange
  '#F7C325',   // Upload - yellow
  '#4CAF50',   // Annotate - green
  '#ADD8E6',   // Analyze - light blue
  '#207868',   // Finalized - teal green
];

export function InspectionPipelineChart({ data }: InspectionPipelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200, #e2e8f0)" vertical={false} />
        <XAxis
          dataKey="stage"
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
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="count" position="top" fontSize={11} fill="var(--color-neutral-500, #64748b)" />
          {data.map((_, index) => (
            <Cell key={index} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
