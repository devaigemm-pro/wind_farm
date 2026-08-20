import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  useInspectionPipeline,
  useDefectsSpread,
  useSubassetsStatus,
} from '@/hooks/useDashboard';
import { useLanguage } from '@/components/design-system';
import { useAuth } from '@/hooks/useAuth';

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, delta, icon }: { label: string; value: string | number; delta?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {delta && (
          <span className={cn('text-xs ml-2', delta.startsWith('↑') || delta.startsWith('+') ? 'text-green-600' : delta.startsWith('↓') ? 'text-red-500' : 'text-gray-400')}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Pipeline Bar ───────────────────────────────────────────────────────────
function PipelineBar({ data }: { data: { stage: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  return (
    <div>
      <div className="flex w-full h-6 rounded-full overflow-hidden mb-3">
        {data.map((d) => {
          const pct = (d.count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={d.stage}
              className="h-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, backgroundColor: d.color }}
              title={`${d.stage}: ${d.count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        {data.map((d) => (
          <span key={d.stage} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            {d.stage} <b>{d.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Sparkline SVG ──────────────────────────────────────────────────────────
function Sparkline({ data, color = '#5A8F5A' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const w = 120, h = 32;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: 4 + (h - 8) - ((v - min) / range) * (h - 8),
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${points[points.length - 1]!.x} ${h} L ${points[0]!.x} ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1]!.x} cy={points[points.length - 1]!.y} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Donut Chart (SVG) ──────────────────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const size = 120, cx = 60, cy = 60, outerR = 45, innerR = 28;
  let currentAngle = 0;

  const segments = data.filter(d => d.value > 0).map((d) => {
    const angle = (d.value / total) * 360;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;

    const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
    const x1 = cx + outerR * Math.cos(toRad(start));
    const y1 = cy + outerR * Math.sin(toRad(start));
    const x2 = cx + outerR * Math.cos(toRad(end > 359.9 ? 359.9 : end));
    const y2 = cy + outerR * Math.sin(toRad(end > 359.9 ? 359.9 : end));
    const x3 = cx + innerR * Math.cos(toRad(end > 359.9 ? 359.9 : end));
    const y3 = cy + innerR * Math.sin(toRad(end > 359.9 ? 359.9 : end));
    const x4 = cx + innerR * Math.cos(toRad(start));
    const y4 = cy + innerR * Math.sin(toRad(start));
    const large = angle > 180 ? 1 : 0;

    const path = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
    return { path, color: d.color, label: d.label, value: d.value };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={2} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-lg font-bold" fill="#111827">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="text-[10px]" fill="#6B7280">total</text>
      </svg>
      <div className="space-y-1.5 text-xs">
        {data.filter(d => d.value > 0).map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-gray-600">{d.label}</span>
            <span className="text-gray-400 ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Timeline ──────────────────────────────────────────────────────
function ActivityTimeline() {
  const { t } = useLanguage();
  // Mock data — in production this would come from a query
  const activities = [
    { color: 'bg-green-500', text: 'Inspection completed — FDM-T02', time: '2h ago', badge: 'Complete', badgeClass: 'bg-green-50 text-green-700' },
    { color: 'bg-amber-500', text: '3 defects found — FDM-T03 Blade A', time: '5h ago', badge: 'Cat 3-5', badgeClass: 'bg-amber-50 text-amber-700' },
    { color: 'bg-blue-500', text: 'New inspection planned — FDM-T05', time: '1d ago', badge: 'Planned', badgeClass: 'bg-blue-50 text-blue-700' },
    { color: 'bg-[#5A8F5A]', text: 'Report generated — Campaign FDM-2026-08', time: '2d ago', badge: 'Report', badgeClass: 'bg-gray-50 text-gray-600' },
  ];

  return (
    <div className="space-y-4">
      {activities.map((a, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', a.color)} />
          <div className="flex-1">
            <p className="text-sm text-gray-900">{a.text}</p>
            <p className="text-xs text-gray-400">{a.time}</p>
          </div>
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', a.badgeClass)}>{a.badge}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard Page ────────────────────────────────────────────────────
export default function DashboardV2() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const pipeline = useInspectionPipeline();
  const defectsSpread = useDefectsSpread();
  const subassets = useSubassetsStatus();

  // Derive KPI values from data
  const turbineCount = subassets.data?.length ?? 0;
  const activeInspections = useMemo(() => {
    if (!pipeline.data) return 0;
    return pipeline.data.filter((p: any) => p.stage !== 'report' && p.stage !== 'planned').reduce((s: number, p: any) => s + (p.count ?? 1), 0);
  }, [pipeline.data]);

  const defectsTotal = useMemo(() => {
    if (!defectsSpread.data) return 0;
    return defectsSpread.data.reduce((s: number, d: any) => s + (d.count ?? d.value ?? 1), 0);
  }, [defectsSpread.data]);

  // Pipeline bar data
  const pipelineBarData = useMemo(() => {
    if (!pipeline.data) return [];
    const stageColors: Record<string, string> = {
      planned: '#60A5FA',
      inspect: '#FBBF24',
      annotate: '#F97316',
      analyze: '#A78BFA',
      report: '#5A8F5A',
    };
    return pipeline.data.map((p: any) => ({
      stage: p.stage?.charAt(0).toUpperCase() + p.stage?.slice(1) || 'Unknown',
      count: p.count ?? 0,
      color: stageColors[p.stage] || '#9CA3AF',
    }));
  }, [pipeline.data]);

  // Defects donut data by category
  const donutData = useMemo(() => {
    if (!defectsSpread.data) return [];
    const catColors: Record<number, string> = { 1: '#10B981', 2: '#6366F1', 3: '#F59E0B', 4: '#F97316', 5: '#EF4444' };
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    defectsSpread.data.forEach((d: any) => {
      const cat = d.severity ?? d.category ?? 3;
      if (cat >= 1 && cat <= 5) counts[cat] = (counts[cat] ?? 0) + (d.count ?? 1);
    });
    return Object.entries(counts)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ label: `Cat ${k}`, value: v, color: catColors[Number(k)] ?? '#9CA3AF' }));
  }, [defectsSpread.data]);

  const firstName = (user as any)?.name?.split(' ')[0] || 'User';

  return (
    <div>
      {/* Greeting */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Good morning, {firstName}</h1>
          <p className="text-sm text-gray-500">Here's what's happening with your wind farms</p>
        </div>
        <span className="text-xs text-gray-400">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total Turbines" value={turbineCount || 12} delta="↑ 2" />
        <KpiCard label="Active Inspections" value={activeInspections || 3} delta="→ 0" />
        <KpiCard label="Defects Found" value={defectsTotal || 47} delta="↑ 5" />
        <KpiCard label="Uptime" value="98.2%" delta="↑ 0.3" />
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500">7-Day Trend</span>
          </div>
          <Sparkline data={[52, 48, 51, 49, 47, 50, 47]} />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Pipeline Bar */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Inspection Pipeline</h3>
          {pipelineBarData.length > 0 ? (
            <PipelineBar data={pipelineBarData} />
          ) : (
            <div className="flex w-full h-6 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-blue-400" style={{ width: '14%' }} />
              <div className="h-full bg-amber-400" style={{ width: '7%' }} />
              <div className="h-full bg-orange-400" style={{ width: '11%' }} />
              <div className="h-full bg-purple-400" style={{ width: '4%' }} />
              <div className="h-full bg-[#5A8F5A]" style={{ width: '64%' }} />
            </div>
          )}
        </div>

        {/* Defects Donut */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Defects by Category</h3>
          {donutData.length > 0 ? (
            <DonutChart data={donutData} />
          ) : (
            <DonutChart data={[
              { label: 'Cat 1', value: 6, color: '#10B981' },
              { label: 'Cat 2', value: 8, color: '#6366F1' },
              { label: 'Cat 3', value: 12, color: '#F59E0B' },
              { label: 'Cat 4', value: 9, color: '#F97316' },
              { label: 'Cat 5', value: 12, color: '#EF4444' },
            ]} />
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Recent Activity</h3>
        <ActivityTimeline />
      </div>
    </div>
  );
}
