import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export interface CampaignTypeChartData {
  turbine: string;
  [defectType: string]: string | number;
}

export interface CampaignTypeChartProps {
  data: CampaignTypeChartData[];
}

const TYPE_COLORS: Record<string, string> = {
  le_erosion: 'firebrick',
  crack: '#1d1160',
  delamination: '#58111A',
  lightning_damage: '#FEBE10',
  vortex: 'forestgreen',
  paint_defect: 'seagreen',
  oil: '#4B6F44',
  other: '#A45A52',
};

export function CampaignTypeChart({ data }: CampaignTypeChartProps) {
  // Get all type keys from first data item
  const firstItem = data[0];
  const typeKeys = firstItem
    ? Object.keys(firstItem).filter((k) => k !== 'turbine')
    : [];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="turbine"
          tick={{ fontSize: 10, fill: '#666' }}
          axisLine={{ stroke: '#666' }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: '#666' }}
          axisLine={{ stroke: '#666' }}
        />
        <Tooltip
          contentStyle={{ borderRadius: '4px', fontSize: '12px', border: '1px solid #ccc' }}
        />
        {typeKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="types"
            fill={TYPE_COLORS[key] ?? '#94a3b8'}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
