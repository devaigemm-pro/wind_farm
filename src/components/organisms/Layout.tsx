import { useState, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
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

  // Remove tabindex from Recharts sectors to prevent focus ring on click
  useEffect(() => {
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.recharts-sector[tabindex]').forEach(el => {
        el.removeAttribute('tabindex');
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex'] });
    // Initial cleanup
    document.querySelectorAll('.recharts-sector[tabindex]').forEach(el => {
      el.removeAttribute('tabindex');
    });
    return () => observer.disconnect();
  }, [location.pathname]);

  const handleNavigate = (path: string) => {
    if (path === '/logout') {
      onLogout();
      return;
    }
    navigate(path);
    setMobileMenuOpen(false);
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
    outline: 'none',
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
        {breadcrumbs.length > 0 && (
          <div style={breadcrumbContainerStyle}>
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}

        <main style={contentStyle} tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
