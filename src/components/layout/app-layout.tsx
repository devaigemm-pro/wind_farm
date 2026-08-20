import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppSidebar } from '@/components/navigation/app-sidebar';
import { TopBarV2 } from '@/components/navigation/top-bar-v2';
import { CommandPalette } from '@/components/navigation/command-palette';
import type { Profile } from '@/types';

interface AppLayoutProps {
  children: ReactNode;
  user: Profile | null;
  onLogout: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/assets-wind': 'Wind Farms',
  '/inspections': 'Inspections',
  '/inspections/new': 'New Inspection',
  '/inspections/upload': 'Upload',
  '/inspections/ongoing': 'Ongoing',
  '/inspections/reports': 'Reports',
  '/profile': 'Profile',
};

export function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);

  // Derive page title from path
  const title = PAGE_TITLES[location.pathname] || 'CORE Insight';

  // Command palette shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleNavigate = useCallback((path: string) => {
    if (path === '/logout') {
      onLogout();
      return;
    }
    navigate(path);
  }, [navigate, onLogout]);

  // Hide sidebar and use minimal chrome for workflow pages
  const isWorkflow = location.pathname.includes('/workflow');

  if (isWorkflow) {
    return (
      <div className="min-h-screen bg-white">
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Sidebar (dock mode) */}
      <AppSidebar
        currentPath={location.pathname}
        onNavigate={handleNavigate}
      />

      {/* Main content area — offset by sidebar width (56px) */}
      <div className="ml-14 flex flex-col min-h-screen">
        {/* Top bar */}
        <TopBarV2
          title={title}
          onCommandPalette={() => setCmdOpen(true)}
        />

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      {/* Command palette overlay */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={(path) => { handleNavigate(path); setCmdOpen(false); }}
      />
    </div>
  );
}
