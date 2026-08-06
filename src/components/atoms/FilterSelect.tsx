import { ChevronDown } from 'lucide-react';

export interface FilterSelectProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

export function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="filter-select">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="filter-select__input"
        aria-label={label}
      >
        <option value="">{label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="filter-select__icon" />
    </div>
  );
}
