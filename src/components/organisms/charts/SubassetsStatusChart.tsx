import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { useLanguage } from '@/components/design-system';

export interface SubassetStatusItem {
  name: string;
  value: number;
}

export interface SubassetsStatusChartProps {
  data: SubassetStatusItem[];
}

const COLORS = ['#5a9e5a', '#5a9e5a', '#2c3e6b'];

export function SubassetsStatusChart({ data }: SubassetsStatusChartProps) {
  const { t } = useLanguage();
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const LABELS_MAP_I18N: Record<string, string> = {
    recent: t('chart.lessThan3Months'),
    moderate: t('chart.6to3Months'),
    overdue: t('chart.moreThan6Months'),
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
          strokeWidth={0}
          isAnimationActive={false}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} style={{ outline: 'none' }} tabIndex={undefined as unknown as number} />
          ))}
          <Label
            value={total.toString()}
            position="centerBottom"
            dy={-4}
            style={{ fontSize: '24px', fontWeight: 700, fill: 'var(--color-neutral-800, #1e293b)' }}
          />
          <Label
            value={t('chart.totalAssets')}
            position="centerTop"
            dy={12}
            style={{ fontSize: '11px', fill: 'var(--color-neutral-500, #64748b)' }}
          />
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: '13px',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          formatter={(value: string) => LABELS_MAP_I18N[value] ?? value}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
