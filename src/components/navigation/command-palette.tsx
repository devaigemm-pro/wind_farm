import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useLanguage } from '@/components/design-system';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  const { t } = useLanguage();

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;

  const handleSelect = (path: string) => {
    onNavigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Command dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <Command className="[&_[cmdk-input]]:h-12">
          <Command.Input
            placeholder="Search or type a command..."
            className="w-full px-4 h-12 text-sm border-b border-gray-100 outline-none placeholder:text-gray-400"
            autoFocus
          />
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-gray-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5">
              <Command.Item onSelect={() => handleSelect('/dashboard')} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-md cursor-pointer data-[selected]:bg-accent-50 data-[selected]:text-accent-700">
                Dashboard
              </Command.Item>
              <Command.Item onSelect={() => handleSelect('/assets-wind')} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-md cursor-pointer data-[selected]:bg-accent-50 data-[selected]:text-accent-700">
                Wind Farms
              </Command.Item>
              <Command.Item onSelect={() => handleSelect('/inspections')} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-md cursor-pointer data-[selected]:bg-accent-50 data-[selected]:text-accent-700">
                Inspections
              </Command.Item>
              <Command.Item onSelect={() => handleSelect('/inspections/new')} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-md cursor-pointer data-[selected]:bg-accent-50 data-[selected]:text-accent-700">
                New Inspection
              </Command.Item>
              <Command.Item onSelect={() => handleSelect('/inspections/reports')} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-md cursor-pointer data-[selected]:bg-accent-50 data-[selected]:text-accent-700">
                Reports
              </Command.Item>
              <Command.Item onSelect={() => handleSelect('/inspections/ongoing')} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-md cursor-pointer data-[selected]:bg-accent-50 data-[selected]:text-accent-700">
                Ongoing Inspections
              </Command.Item>
              <Command.Item onSelect={() => handleSelect('/profile')} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-md cursor-pointer data-[selected]:bg-accent-50 data-[selected]:text-accent-700">
                Profile
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
