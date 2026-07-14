import {
  LayoutDashboard,
  Wind,
  PlusCircle,
  Upload,
  Clock,
  FileText,
  User,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavItem } from '@/components/molecules';

interface NavSection {
  title: string;
  items: {
    icon: LucideIcon;
    label: string;
    path: string;
    badge?: number;
  }[];
}

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    ],
  },
  {
    title: 'Assets',
    items: [{ icon: Wind, label: 'Wind Farms', path: '/wind-farms' }],
  },
  {
    title: 'Inspections',
    items: [
      { icon: PlusCircle, label: 'New', path: '/inspections/new' },
      { icon: Upload, label: 'Uploader', path: '/inspections/upload' },
      { icon: Clock, label: 'Ongoing', path: '/inspections/ongoing' },
      { icon: FileText, label: 'Reports', path: '/inspections/reports' },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: User, label: 'Profile', path: '/profile' },
      { icon: LogOut, label: 'Logout', path: '/logout' },
    ],
  },
];

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  currentPath,
  onNavigate,
}: SidebarProps) {
  const sidebarStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: isCollapsed ? '64px' : '256px',
    height: '100vh',
    backgroundColor: 'var(--color-neutral-0)',
    borderRight: '1px solid var(--color-neutral-200)',
    transition: `width var(--duration-slow) var(--easing-default)`,
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
  };

  const logoAreaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: isCollapsed ? 'var(--space-4) var(--space-3)' : 'var(--space-4) var(--space-4)',
    borderBottom: '1px solid var(--color-neutral-200)',
    minHeight: '64px',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
  };

  const logoIconStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-primary-500)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-neutral-0)',
    flexShrink: 0,
  };

  const logoTextStyle: React.CSSProperties = {
    fontSize: 'var(--text-lg)',
    fontWeight: 700,
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-900)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  };

  const navStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-400)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 var(--space-3)',
    marginBottom: 'var(--space-1)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  };

  const sectionItemsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  };

  const toggleButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 'var(--space-3)',
    border: 'none',
    borderTop: '1px solid var(--color-neutral-200)',
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-400)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
    transition: `color var(--duration-normal) var(--easing-default)`,
  };

  return (
    <aside style={sidebarStyle} aria-label="Main navigation">
      <div style={logoAreaStyle}>
        <div style={logoIconStyle}>
          <Wind size={18} aria-hidden="true" />
        </div>
        {!isCollapsed && <span style={logoTextStyle}>WindBlade</span>}
      </div>

      <nav style={navStyle}>
        {navSections.map((section) => (
          <div key={section.title}>
            {!isCollapsed && (
              <div style={sectionTitleStyle}>{section.title}</div>
            )}
            <div style={sectionItemsStyle}>
              {section.items.map((item) => (
                <NavItem
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  badge={item.badge}
                  isActive={currentPath === item.path}
                  isCollapsed={isCollapsed}
                  onClick={() => onNavigate(item.path)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <button
        type="button"
        style={toggleButtonStyle}
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronsRight size={18} aria-hidden="true" />
        ) : (
          <ChevronsLeft size={18} aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}
