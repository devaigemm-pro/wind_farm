import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/design-system';

interface TopBarV2Props {
  title: string;
  onCommandPalette?: () => void;
}

export function TopBarV2({ title, onCommandPalette }: TopBarV2Props) {
  const { locale, setLocale } = useLanguage();

  return (
    <header className="sticky top-0 z-30 h-11 flex items-center px-6 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <span className="text-sm font-medium text-gray-900">{title}</span>

      <div className="ml-auto flex items-center gap-3">
        {/* Command palette trigger */}
        <button
          onClick={onCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 bg-gray-50 rounded-md border border-gray-100 hover:bg-gray-100 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span>Search...</span>
          <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">⌘K</kbd>
        </button>

        {/* Language toggle */}
        <button
          onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
          className="flex items-center justify-center w-8 h-8 border border-gray-200 rounded-md text-[11px] font-bold text-gray-600 uppercase hover:bg-gray-50 transition"
        >
          {locale}
        </button>
      </div>
    </header>
  );
}
