import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export interface CampaignCategoryChartData {
  turbine: string;
  cat5: number;
  cat4: number;
  cat3: number;
  cat2: number;
  cat1: number;
}

export interface CampaignCategoryChartProps {
  data: CampaignCategoryChartData[];
}

const COLORS = {
  cat5: '#E53E3E',
  cat4: '#FF5500',
  cat3: '#FFA500',
  cat2: '#006A4E',
  cat1: '#68D391',
};

export function CampaignCategoryChart({ data }: CampaignCategoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
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
        <Bar dataKey="cat2" stackId="a" fill={COLORS.cat2} />
        <Bar dataKey="cat3" stackId="a" fill={COLORS.cat3} />
        <Bar dataKey="cat4" stackId="a" fill={COLORS.cat4} />
        <Bar dataKey="cat5" stackId="a" fill={COLORS.cat5} />
        <Bar dataKey="cat1" stackId="a" fill={COLORS.cat1} />
      </BarChart>
    </ResponsiveContainer>
  );
}
