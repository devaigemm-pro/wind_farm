import { useState } from 'react';
import {
  LayoutDashboard,
  Wind,
  PlusCircle,
  Upload,
  Clock,
  FileText,
  ClipboardList,
  User,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/design-system';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface AppSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function AppSidebar({ currentPath, onNavigate }: AppSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();
  const { role } = useAuth();

  const sections: NavSection[] = [
    {
      items: [
        { icon: LayoutDashboard, label: t('sidebar.dashboard'), path: '/dashboard' },
        { icon: Wind, label: t('sidebar.windFarms'), path: '/assets-wind' },
        { icon: ClipboardList, label: t('sidebar.quotes'), path: '/quotes' },
      ],
    },
    {
      title: t('sidebar.inspections'),
      items: [
        { icon: PlusCircle, label: t('sidebar.new'), path: '/inspections/new' },
        { icon: Upload, label: t('sidebar.uploader'), path: '/inspections/upload' },
        { icon: Clock, label: t('sidebar.ongoing'), path: '/inspections/ongoing' },
        { icon: FileText, label: t('sidebar.reports'), path: '/inspections/reports' },
      ],
    },
  ];

  const bottomItems: NavItem[] = [
    { icon: User, label: t('sidebar.profile'), path: '/profile' },
    { icon: LogOut, label: t('sidebar.logout'), path: '/logout' },
  ];

  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/');

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={cn(
        'fixed left-0 top-0 h-screen z-40 flex flex-col overflow-hidden transition-all duration-200 ease-out',
        'bg-[#1E1E1E]',
        expanded ? 'w-60' : 'w-14'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-white/10 min-h-[56px]">
        <img
          src="/core-insight-eye.svg"
          width="15"
          height="10"
          alt="CORE Insight"
          className="flex-shrink-0"
        />
        <span
          className={cn(
            'text-white font-semibold text-sm whitespace-nowrap transition-all duration-200',
            expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
          )}
        >
          CORE Insight
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-1.5 space-y-3 overflow-y-auto">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.title && expanded && (
              <p className="px-2.5 mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => onNavigate(item.path)}
                    className={cn(
                      'relative w-full flex items-center gap-3 px-2.5 py-2 rounded-md transition-colors duration-150',
                      active
                        ? 'bg-[rgba(90,143,90,0.15)] text-[#5A8F5A]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#5A8F5A] rounded-r" />
                    )}
                    <item.icon size={18} className="flex-shrink-0" strokeWidth={1.5} />
                    <span
                      className={cn(
                        'text-sm whitespace-nowrap transition-all duration-200',
                        expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-1.5 space-y-0.5">
        {bottomItems.map((item) => (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={cn(
              'w-full flex items-center gap-3 px-2.5 py-2 rounded-md transition-colors duration-150',
              isActive(item.path)
                ? 'bg-[rgba(90,143,90,0.15)] text-[#5A8F5A]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            <item.icon size={18} className="flex-shrink-0" strokeWidth={1.5} />
            <span
              className={cn(
                'text-sm whitespace-nowrap transition-all duration-200',
                expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
              )}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
