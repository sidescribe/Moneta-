import { useState } from 'react';
import { DATE_RANGE_PRESETS, presetToRange, type DateRangePreset } from '../lib/dateRange';

interface DateRangePickerProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  className?: string;
}

function detectPreset(start: string, end: string): DateRangePreset {
  for (const { id } of DATE_RANGE_PRESETS) {
    if (id === 'custom') continue;
    const range = presetToRange(id);
    if (range.start === start && range.end === end) return id;
  }
  return 'custom';
}

export default function DateRangePicker({ start, end, onChange, className = '' }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<DateRangePreset>(() => detectPreset(start, end));
  const isCustom = activePreset === 'custom';

  const selectPreset = (id: DateRangePreset) => {
    setActivePreset(id);
    if (id === 'custom') return;
    const range = presetToRange(id);
    onChange(range.start, range.end);
  };

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {DATE_RANGE_PRESETS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectPreset(id)}
            className={`shrink-0 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors whitespace-nowrap ${
              activePreset === id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500 mb-1">Start Date</label>
            <input
              type="date"
              value={start}
              onChange={e => {
                setActivePreset('custom');
                onChange(e.target.value, end);
              }}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500 mb-1">End Date</label>
            <input
              type="date"
              value={end}
              onChange={e => {
                setActivePreset('custom');
                onChange(start, e.target.value);
              }}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
