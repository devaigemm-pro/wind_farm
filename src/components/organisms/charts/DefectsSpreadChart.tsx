import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { useLanguage } from '@/components/design-system';

export interface DefectsSpreadDataItem {
  category: string;
  [severity: string]: string | number;
}

export interface DefectsSpreadChartProps {
  data: DefectsSpreadDataItem[];
}

const SEVERITY_COLORS: Record<string, string> = {
  sev1: '#b8b8b8',   // Severity 1 - matte light grey
  sev2: '#8a8a8a',   // Severity 2 - matte grey
  sev3: '#5a9e5a',   // Severity 3 - matte green
  sev4: '#2c3e6b',   // Severity 4 - matte navy
  sev5: '#b84a4a',   // Severity 5 - matte red
};

export function DefectsSpreadChart({ data }: DefectsSpreadChartProps) {
  const { t } = useLanguage();
  const firstItem = data[0];
  const severityKeys = firstItem
    ? Object.keys(firstItem).filter((k) => k !== 'category')
    : [];

  const SEVERITY_LABELS_I18N: Record<string, string> = {
    sev1: `${t('chart.severity')} 1`,
    sev2: `${t('chart.severity')} 2`,
    sev3: `${t('chart.severity')} 3`,
    sev4: `${t('chart.severity')} 4`,
    sev5: `${t('chart.severity')} 5`,
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200, #e2e8f0)" vertical={false} />
        <XAxis
          dataKey="category"
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
          formatter={(value: string) => SEVERITY_LABELS_I18N[value] ?? value}
        />
        {severityKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="severity"
            fill={SEVERITY_COLORS[key] ?? '#94a3b8'}
            radius={index === severityKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          >
            {index === severityKeys.length - 1 && (
              <LabelList dataKey={key} position="top" fontSize={10} fill="var(--color-neutral-500, #64748b)" />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
