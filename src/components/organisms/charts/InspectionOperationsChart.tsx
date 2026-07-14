import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface OperationsDataItem {
  month: string;
  planned: number;
  done: number;
}

export interface InspectionOperationsChartProps {
  data: OperationsDataItem[];
}

export function InspectionOperationsChart({ data }: InspectionOperationsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="planned" fill="var(--color-primary-300, #93c5fd)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="done" fill="var(--color-primary-600, #2563eb)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
