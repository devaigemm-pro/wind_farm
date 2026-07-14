import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface DefectsSpreadDataItem {
  category: string;
  [severity: string]: string | number;
}

export interface DefectsSpreadChartProps {
  data: DefectsSpreadDataItem[];
}

const SEVERITY_COLORS: Record<string, string> = {
  sev1: '#22c55e',
  sev2: '#84cc16',
  sev3: '#eab308',
  sev4: '#f97316',
  sev5: '#ef4444',
};

export function DefectsSpreadChart({ data }: DefectsSpreadChartProps) {
  // Derive severity keys from data (excluding 'category')
  const firstItem = data[0];
  const severityKeys = firstItem
    ? Object.keys(firstItem).filter((k) => k !== 'category')
    : [];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {severityKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="severity"
            fill={SEVERITY_COLORS[key] ?? '#94a3b8'}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
