import { Wind, Cog, Fan } from 'lucide-react';
import { Skeleton } from '@/components/atoms';
import { EmptyState } from '@/components/molecules';
import type { WindFarm, Turbine, Blade } from '@/types';

export interface AssetDetailPanelProps {
  type: 'wind_farm' | 'turbine' | 'blade' | null;
  data: WindFarm | Turbine | Blade | null | undefined;
  loading?: boolean;
}

export function AssetDetailPanel({ type, data, loading }: AssetDetailPanelProps) {
  const containerStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-sans)',
    padding: 'var(--space-4)',
    height: '100%',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <Skeleton variant="text" width="60%" height="24px" />
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Skeleton variant="text" width="100%" height="16px" />
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Skeleton variant="text" width="80%" height="16px" />
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Skeleton variant="text" width="50%" height="16px" />
          </div>
        </div>
      </div>
    );
  }

  if (!type || !data) {
    return (
      <div style={containerStyle}>
        <EmptyState
          icon={Wind}
          title="No asset selected"
          description="Select a wind farm, turbine, or blade from the tree to view its details."
        />
      </div>
    );
  }

  if (type === 'wind_farm') {
    return <WindFarmDetail farm={data as WindFarm} />;
  }

  if (type === 'turbine') {
    return <TurbineDetail turbine={data as Turbine} />;
  }

  return <BladeDetail blade={data as Blade} />;
}

// ─── Wind Farm Detail ───────────────────────────────────────────────────────

function WindFarmDetail({ farm }: { farm: WindFarm }) {
  const turbineCount = farm.turbines?.length ?? 0;
  const bladeCount = farm.turbines?.reduce((acc, t) => acc + (t.blades?.length ?? 0), 0) ?? 0;

  return (
    <DetailContainer>
      <DetailHeader icon={<Wind size={20} />} title={farm.name} subtitle="Wind Farm" />
      <DetailGrid>
        <DetailItem label="Location" value={farm.location} />
        {farm.latitude != null && farm.longitude != null && (
          <DetailItem
            label="Coordinates"
            value={`${farm.latitude.toFixed(4)}, ${farm.longitude.toFixed(4)}`}
          />
        )}
        <DetailItem label="Turbines" value={String(turbineCount)} />
        <DetailItem label="Total Blades" value={String(bladeCount)} />
      </DetailGrid>
    </DetailContainer>
  );
}

// ─── Turbine Detail ─────────────────────────────────────────────────────────

function TurbineDetail({ turbine }: { turbine: Turbine }) {
  const bladeCount = turbine.blades?.length ?? 0;

  return (
    <DetailContainer>
      <DetailHeader icon={<Cog size={20} />} title={turbine.name} subtitle="Turbine" />
      <DetailGrid>
        {turbine.model && <DetailItem label="Model" value={turbine.model} />}
        {turbine.wind_farm && <DetailItem label="Wind Farm" value={turbine.wind_farm.name} />}
        <DetailItem label="Blades" value={String(bladeCount)} />
        {turbine.blades && turbine.blades.length > 0 && (
          <DetailItem
            label="Blade Positions"
            value={turbine.blades.map((b) => `#${b.position}`).join(', ')}
          />
        )}
      </DetailGrid>
    </DetailContainer>
  );
}

// ─── Blade Detail ───────────────────────────────────────────────────────────

function BladeDetail({ blade }: { blade: Blade }) {
  return (
    <DetailContainer>
      <DetailHeader
        icon={<Fan size={20} />}
        title={blade.serial_number ?? `Blade #${blade.position}`}
        subtitle="Blade"
      />
      <DetailGrid>
        <DetailItem label="Position" value={String(blade.position)} />
        {blade.serial_number && <DetailItem label="Serial Number" value={blade.serial_number} />}
        {blade.length_meters != null && (
          <DetailItem label="Length" value={`${blade.length_meters} m`} />
        )}
        {blade.turbine && <DetailItem label="Turbine" value={blade.turbine.name} />}
      </DetailGrid>
    </DetailContainer>
  );
}

// ─── Shared Layout Helpers ──────────────────────────────────────────────────

function DetailContainer({ children }: { children: React.ReactNode }) {
  const style: React.CSSProperties = {
    fontFamily: 'var(--font-family-sans)',
    padding: 'var(--space-4)',
  };
  return <div style={style}>{children}</div>;
}

function DetailHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-4)',
    paddingBottom: 'var(--space-3)',
    borderBottom: '1px solid var(--color-neutral-100)',
  };

  const iconWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-primary-50)',
    color: 'var(--color-primary-600)',
    flexShrink: 0,
  };

  return (
    <div style={headerStyle}>
      <div style={iconWrapperStyle}>{icon}</div>
      <div>
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-neutral-900)' }}>
          {title}
        </h2>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-neutral-500)' }}>{subtitle}</span>
      </div>
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 'var(--space-4)',
  };
  return <div style={style}>{children}</div>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)', marginBottom: 'var(--space-1)' }}>
        {label}
      </dt>
      <dd style={{ fontSize: 'var(--text-sm)', color: 'var(--color-neutral-900)', fontWeight: 500, margin: 0 }}>
        {value}
      </dd>
    </div>
  );
}
