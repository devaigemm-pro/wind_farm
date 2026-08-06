import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';

export interface SubassetStatusItem {
  name: string;
  value: number;
}

export interface SubassetsStatusChartProps {
  data: SubassetStatusItem[];
}

const COLORS = ['green', '#4CAF50', 'darkblue'];
const LABELS_MAP: Record<string, string> = {
  recent: '< 3 months',
  moderate: '6 to 3 months',
  overdue: '> 6 months',
};

export function SubassetsStatusChart({ data }: SubassetsStatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

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
            value="Total assets"
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
          formatter={(value: string) => LABELS_MAP[value] ?? value}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
