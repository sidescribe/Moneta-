import type { Transaction } from '../types';
import { presetToRange, type DateRangePreset } from './profitLoss';

export type { DateRangePreset };
export { presetToRange };

export function filterByDateRange(
  transactions: Transaction[],
  start: string,
  end: string,
): Transaction[] {
  if (!start && !end) return transactions;
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (e) e.setHours(23, 59, 59, 999);
  return transactions.filter(t => {
    const d = new Date(t.date);
    if (s && d < s) return false;
    if (e && d > e) return false;
    return true;
  });
}

export const DATE_RANGE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'this-quarter', label: 'This Quarter' },
  { id: 'ytd', label: 'YTD' },
  { id: 'last-90', label: 'Last 90 Days' },
  { id: 'last-year', label: 'Last Year' },
  { id: 'custom', label: 'Custom' },
];
