import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Wind, Cog, Fan } from 'lucide-react';
import { Skeleton } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import type { WindFarm } from '@/types';

export interface AssetTreeProps {
  data: WindFarm[] | undefined;
  selectedId: string | null;
  onSelect: (id: string, type: 'wind_farm' | 'turbine' | 'blade') => void;
}

export function AssetTree({ data, selectedId, onSelect }: AssetTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { t } = useLanguage();

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (!data) {
    return (
      <div style={{ padding: 'var(--space-3)' }} aria-label={t('assetTree.loading')}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 'var(--space-2)' }}>
            <Skeleton variant="text" width="80%" height="24px" />
          </div>
        ))}
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
    overflow: 'auto',
  };

  return (
    <ul role="tree" style={{ ...containerStyle, listStyle: 'none', margin: 0, padding: 0 }}>
      {data.map((farm) => (
        <FarmNode
          key={farm.id}
          farm={farm}
          expanded={expanded}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}

// ─── Farm Node ──────────────────────────────────────────────────────────────

interface FarmNodeProps {
  farm: WindFarm;
  expanded: Set<string>;
  selectedId: string | null;
  onSelect: (id: string, type: 'wind_farm' | 'turbine' | 'blade') => void;
  onToggle: (id: string) => void;
}

function FarmNode({ farm, expanded, selectedId, onSelect, onToggle }: FarmNodeProps) {
  const isExpanded = expanded.has(farm.id);
  const isSelected = selectedId === farm.id;
  const hasTurbines = farm.turbines && farm.turbines.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasTurbines ? isExpanded : undefined}>
      <TreeRow
        icon={<Wind size={14} aria-hidden="true" />}
        label={farm.name}
        isSelected={isSelected}
        hasChildren={!!hasTurbines}
        isExpanded={isExpanded}
        depth={0}
        onToggle={() => onToggle(farm.id)}
        onSelect={() => onSelect(farm.id, 'wind_farm')}
      />
      {isExpanded && hasTurbines && (
        <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {farm.turbines!.map((turbine) => (
            <TurbineNode
              key={turbine.id}
              turbine={turbine}
              expanded={expanded}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Turbine Node ───────────────────────────────────────────────────────────

interface TurbineNodeProps {
  turbine: WindFarm['turbines'] extends (infer T)[] | undefined ? T : never;
  expanded: Set<string>;
  selectedId: string | null;
  onSelect: (id: string, type: 'wind_farm' | 'turbine' | 'blade') => void;
  onToggle: (id: string) => void;
}

function TurbineNode({ turbine, expanded, selectedId, onSelect, onToggle }: TurbineNodeProps) {
  if (!turbine) return null;
  const isExpanded = expanded.has(turbine.id);
  const isSelected = selectedId === turbine.id;
  const hasBlades = turbine.blades && turbine.blades.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasBlades ? isExpanded : undefined}>
      <TreeRow
        icon={<Cog size={14} aria-hidden="true" />}
        label={turbine.name}
        isSelected={isSelected}
        hasChildren={!!hasBlades}
        isExpanded={isExpanded}
        depth={1}
        onToggle={() => onToggle(turbine.id)}
        onSelect={() => onSelect(turbine.id, 'turbine')}
      />
      {isExpanded && hasBlades && (
        <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {turbine.blades!.map((blade) => (
            <li key={blade.id} role="treeitem">
              <TreeRow
                icon={<Fan size={14} aria-hidden="true" />}
                label={blade.serial_number ?? `Blade #${blade.position}`}
                isSelected={selectedId === blade.id}
                hasChildren={false}
                isExpanded={false}
                depth={2}
                onToggle={() => {}}
                onSelect={() => onSelect(blade.id, 'blade')}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Tree Row (shared) ──────────────────────────────────────────────────────

interface TreeRowProps {
  icon: React.ReactNode;
  label: string;
  isSelected: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  depth: number;
  onToggle: () => void;
  onSelect: () => void;
}

function TreeRow({ icon, label, isSelected, hasChildren, isExpanded, depth, onToggle, onSelect }: TreeRowProps) {
  const paddingLeft = `calc(var(--space-3) + ${depth * 16}px)`;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    paddingLeft,
    paddingRight: 'var(--space-3)',
    paddingTop: 'var(--space-1)',
    paddingBottom: 'var(--space-1)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: isSelected ? 'var(--color-primary-50)' : 'transparent',
    color: isSelected ? 'var(--color-primary-700)' : 'var(--color-neutral-800)',
    fontWeight: isSelected ? 500 : 400,
    transition: 'background-color var(--duration-fast) var(--easing-default)',
    userSelect: 'none',
  };

  const chevronStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    flexShrink: 0,
    color: 'var(--color-neutral-400)',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
    if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      e.preventDefault();
      onToggle();
    }
    if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      style={rowStyle}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={label}
    >
      <span style={chevronStyle} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        {hasChildren && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
      </span>
      {icon}
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
    </div>
  );
}
