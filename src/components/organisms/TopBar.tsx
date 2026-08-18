import { useState } from 'react';
import { Menu, Bell, LogOut } from 'lucide-react';
import { Avatar } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import type { Profile } from '@/types';

export interface TopBarProps {
  onMenuToggle: () => void;
  user: Profile | null;
  onLogout: () => void;
  onSearch: (query: string) => void;
  notificationCount?: number;
}

export function TopBar({
  onMenuToggle,
  user,
  onLogout,
  onSearch,
  notificationCount = 0,
}: TopBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { locale, setLocale, t } = useLanguage();

  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    height: '64px',
    padding: '0 var(--space-4)',
    backgroundColor: 'var(--color-neutral-0)',
    borderBottom: '1px solid var(--color-neutral-200)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  };

  const hamburgerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-800)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginLeft: 'auto',
  };

  const iconButtonStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-500)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
  };

  const badgeCountStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
    fontSize: '10px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-danger-500)',
    color: 'var(--color-neutral-0)',
    fontFamily: 'var(--font-family-sans)',
  };

  const avatarButtonStyle: React.CSSProperties = {
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
    padding: 0,
    position: 'relative',
  };

  const langButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    border: '1.5px solid var(--color-neutral-300)',
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-700)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-family-sans)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 'var(--space-2)',
    width: '220px',
    backgroundColor: 'var(--color-neutral-0)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    padding: 'var(--space-2)',
    zIndex: 50,
  };

  const dropdownHeaderStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-3)',
    borderBottom: '1px solid var(--color-neutral-200)',
    marginBottom: 'var(--space-2)',
  };

  const dropdownNameStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-900)',
    margin: 0,
  };

  const dropdownRoleStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-500)',
    margin: 0,
    marginTop: '2px',
  };

  const dropdownItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-800)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
    textAlign: 'left',
  };

  return (
    <header style={barStyle}>
      <button
        type="button"
        style={hamburgerStyle}
        className="topbar-hamburger"
        onClick={onMenuToggle}
        aria-label={t('topbar.toggleNav')}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <div style={actionsStyle}>
        <button
          type="button"
          style={langButtonStyle}
          onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
          aria-label={t('topbar.language')}
          title={t('topbar.language')}
        >
          {locale.toUpperCase()}
        </button>

        <button
          type="button"
          style={iconButtonStyle}
          aria-label={`${t('topbar.notifications')}${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
        >
          <Bell size={20} aria-hidden="true" />
          {notificationCount > 0 && (
            <span style={badgeCountStyle} aria-hidden="true">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            style={avatarButtonStyle}
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label={t('topbar.userMenu')}
            aria-expanded={showDropdown}
            aria-haspopup="true"
          >
            <Avatar
              name={user?.name ?? 'User'}
              size="sm"
              status="online"
            />
          </button>

          {showDropdown && (
            <div style={dropdownStyle} role="menu">
              <div style={dropdownHeaderStyle}>
                <p style={dropdownNameStyle}>{user?.name ?? 'User'}</p>
                <p style={dropdownRoleStyle}>{user?.role ?? 'user'}</p>
              </div>
              <button
                type="button"
                style={dropdownItemStyle}
                onClick={() => {
                  setShowDropdown(false);
                  onLogout();
                }}
                role="menuitem"
              >
                <LogOut size={16} aria-hidden="true" />
                {t('sidebar.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
