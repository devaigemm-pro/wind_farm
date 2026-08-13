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
import { useAuth } from '@/hooks/useAuth';

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
    items: [{ icon: Wind, label: 'Wind Farms', path: '/assets-wind' }],
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
  const { role } = useAuth();

  const visibleSections: NavSection[] =
    !role
      ? [] // Don't show nav while role is loading to prevent flash
      : role === 'supervisor'
        ? [
            {
              title: 'Overview',
              items: [
                { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
              ],
            },
            {
              title: 'Assets',
              items: [{ icon: Wind, label: 'Wind Farms', path: '/assets-wind' }],
            },
            {
              title: 'Reports',
              items: [{ icon: FileText, label: 'Reports', path: '/reports' }],
            },
            {
              title: 'Account',
              items: [
                { icon: User, label: 'Profile', path: '/profile' },
                { icon: LogOut, label: 'Logout', path: '/logout' },
              ],
            },
          ]
        : navSections;
  const sidebarStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: isCollapsed ? '64px' : '256px',
    height: '100vh',
    backgroundColor: '#2C2C2C',
    borderRight: 'none',
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
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    minHeight: '64px',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
  };

  const logoTextStyle: React.CSSProperties = {
    fontSize: 'var(--text-lg)',
    fontWeight: 700,
    fontFamily: 'var(--font-family-sans)',
    color: '#ffffff',
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
    color: 'rgba(255, 255, 255, 0.5)',
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
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'transparent',
    color: 'rgba(255, 255, 255, 0.5)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
    transition: `color var(--duration-normal) var(--easing-default)`,
  };

  return (
    <aside style={sidebarStyle} aria-label="Main navigation">
      <div style={logoAreaStyle}>
        {!isCollapsed && <img src="/coretec-wordmark.svg" height="28" alt="CORE Insight" style={{ flexShrink: 0 }} />}
        {isCollapsed && <img src="/coretec-logo.svg" width="32" height="32" alt="CORE Insight" style={{ borderRadius: 'var(--radius-md)', flexShrink: 0 }} />}
      </div>

      <nav style={navStyle}>
        {visibleSections.map((section) => (
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
