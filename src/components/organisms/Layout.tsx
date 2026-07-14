import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Breadcrumbs } from './Breadcrumbs';
import type { BreadcrumbItem } from './Breadcrumbs';
import type { Profile } from '@/types';

export interface LayoutProps {
  children: ReactNode;
  user: Profile | null;
  onLogout: () => void;
  breadcrumbs?: BreadcrumbItem[];
}

export function Layout({ children, user, onLogout, breadcrumbs = [] }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    if (path === '/logout') {
      onLogout();
      return;
    }
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleSearch = (query: string) => {
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  };

  const sidebarDesktopStyle: React.CSSProperties = {
    display: 'block',
  };

  const overlayStyle: React.CSSProperties = {
    display: mobileMenuOpen ? 'block' : 'none',
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 40,
  };

  const mobileSidebarStyle: React.CSSProperties = {
    display: mobileMenuOpen ? 'block' : 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 50,
  };

  const mainAreaStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-6)',
  };

  const breadcrumbContainerStyle: React.CSSProperties = {
    padding: '0 var(--space-6)',
  };

  return (
    <div style={wrapperStyle}>
      {/* Desktop sidebar */}
      <div style={sidebarDesktopStyle} className="sidebar-desktop">
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentPath={location.pathname}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Mobile overlay */}
      <div
        style={overlayStyle}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile sidebar */}
      <div style={mobileSidebarStyle} className="sidebar-mobile">
        <Sidebar
          isCollapsed={false}
          onToggleCollapse={() => setMobileMenuOpen(false)}
          currentPath={location.pathname}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Main content area */}
      <div style={mainAreaStyle}>
        <TopBar
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          user={user}
          onLogout={onLogout}
          onSearch={handleSearch}
        />

        {breadcrumbs.length > 0 && (
          <div style={breadcrumbContainerStyle}>
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}

        <main style={contentStyle}>{children}</main>
      </div>
    </div>
  );
}
