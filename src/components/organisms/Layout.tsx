import { useState, useEffect, type ReactNode } from 'react';
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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

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
      {/* Desktop sidebar — controlled by responsive.css .sidebar-desktop */}
      <div className="sidebar-desktop">
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentPath={location.pathname}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Mobile overlay — controlled by responsive.css .sidebar-overlay */}
      <div
        className={`sidebar-overlay ${mobileMenuOpen ? 'sidebar-overlay--visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile sidebar — controlled by responsive.css .sidebar-mobile */}
      <div className={`sidebar-mobile ${mobileMenuOpen ? 'sidebar-mobile--open' : ''}`}>
        <Sidebar
          isCollapsed={false}
          onToggleCollapse={() => setMobileMenuOpen(false)}
          currentPath={location.pathname}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Main content area */}
      <div style={mainAreaStyle}>
        {!location.pathname.includes('/workflow') && (
          <TopBar
            onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
            user={user}
            onLogout={onLogout}
            onSearch={() => {}}
          />
        )}

        {breadcrumbs.length > 0 && (
          <div style={breadcrumbContainerStyle} className="layout-breadcrumb-container">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}

        <main style={contentStyle} className="layout-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
