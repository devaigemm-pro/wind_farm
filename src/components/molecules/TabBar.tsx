import { useCallback } from 'react';

export interface Tab {
  id: string;
  label: string;
}

export interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  const handleClick = useCallback(
    (tabId: string) => {
      onChange(tabId);
    },
    [onChange],
  );

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid var(--color-neutral-200)',
  };

  const getTabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: 'var(--space-3) var(--space-4)',
    minWidth: '120px',
    textAlign: 'center',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? 'var(--color-primary-600)' : 'var(--color-neutral-500)',
    background: 'none',
    border: 'none',
    borderBottom: isActive
      ? '2px solid var(--color-primary-600)'
      : '2px solid transparent',
    cursor: 'pointer',
    transition: 'color var(--duration-normal) var(--easing-default), border-color var(--duration-normal) var(--easing-default)',
    marginBottom: '-1px',
    whiteSpace: 'nowrap',
  });

  return (
    <nav style={containerStyle} role="tablist" aria-label="Wind Farms Dashboard Tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          style={getTabStyle(activeTab === tab.id)}
          onClick={() => handleClick(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
