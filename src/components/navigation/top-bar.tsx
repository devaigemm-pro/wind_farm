import { Search, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/design-system';

interface TopBarV2Props {
  pageTitle?: string;
  onCommandPaletteOpen: () => void;
}

export function TopBarV2({ pageTitle, onCommandPaletteOpen }: TopBarV2Props) {
  const { locale, setLocale } = useLanguage();

  const toggleLocale = () => {
    setLocale(locale === 'es' ? 'en' : 'es');
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between',
        'h-[var(--topbar-height)] px-6',
        'bg-[var(--color-topbar)] backdrop-blur-md',
        'border-b border-[var(--color-border-subtle)]'
      )}
    >
      {/* Left: page title */}
      <h1 className="text-base font-semibold text-[var(--color-text-primary)] font-[var(--font-display)]">
        {pageTitle}
      </h1>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Command palette trigger */}
        <button
          type="button"
          onClick={onCommandPaletteOpen}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg',
            'text-sm text-[var(--color-text-muted)]',
            'border border-[var(--color-border)] bg-white',
            'hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]',
            'transition-colors duration-150'
          )}
          aria-label="Open command palette"
        >
          <Search size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--color-page)] rounded border border-[var(--color-border)]">
            ⌘K
          </kbd>
        </button>

        {/* Language toggle */}
        <button
          type="button"
          onClick={toggleLocale}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
            'text-sm text-[var(--color-text-muted)]',
            'hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-card-hover)]',
            'transition-colors duration-150'
          )}
          aria-label={`Switch language to ${locale === 'es' ? 'English' : 'Español'}`}
        >
          <Globe size={14} aria-hidden="true" />
          <span className="uppercase text-xs font-medium">{locale}</span>
        </button>
      </div>
    </header>
  );
}
