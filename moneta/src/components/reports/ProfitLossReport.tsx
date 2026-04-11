import { useState } from 'react';
import type { Transaction, Category } from '../../types';
import { buildProfitLoss, presetToRange, type DateRangePreset } from '../../lib/profitLoss';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: 'this-month', label: 'This Month' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'this-quarter', label: 'This Quarter' },
  { key: 'last-quarter', label: 'Last Quarter' },
  { key: 'ytd', label: 'YTD' },
  { key: 'last-year', label: 'Last Year' },
  { key: 'last-90', label: 'Last 90 Days' },
  { key: 'custom', label: 'Custom' },
];

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function ProfitLossReport({ transactions, categories }: Props) {
  const [preset, setPreset] = useState<DateRangePreset>('this-month');
  const defaultRange = presetToRange('this-month');
  const [customStart, setCustomStart] = useState(defaultRange.start);
  const [customEnd, setCustomEnd] = useState(defaultRange.end);

  const range = preset === 'custom'
    ? { start: customStart, end: customEnd }
    : presetToRange(preset);

  const report = buildProfitLoss(transactions, categories, range.start, range.end);

  return (
    <div className="space-y-6">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              preset === key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {preset === 'custom' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500 mb-1">Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500 mb-1">End Date</label>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-green-700">Total Income</p>
            <p className="text-lg font-bold text-green-800">{fmt(report.totalIncome)}</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <TrendingDown className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-red-700">Total Expenses</p>
            <p className="text-lg font-bold text-red-800">{fmt(report.totalExpenses)}</p>
          </div>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-neutral-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-neutral-600">Net Income</p>
            <p className={`text-lg font-bold ${report.netIncome >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              {fmt(report.netIncome)}
            </p>
          </div>
        </div>
      </div>

      {/* Income table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-4 py-3 bg-green-50 border-b border-green-200">
          <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Income
          </h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {report.incomeLines.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-neutral-400 italic">No income in this period</td>
              </tr>
            ) : (
              report.incomeLines.map(line => (
                <tr key={line.categoryId} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-4 py-2.5 text-neutral-700">{line.categoryName}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-green-700">{fmt(line.total)}</td>
                </tr>
              ))
            )}
            <tr className="bg-green-50">
              <td className="px-4 py-2.5 font-bold text-green-800">Total Income</td>
              <td className="px-4 py-2.5 text-right font-bold text-green-800">{fmt(report.totalIncome)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Expenses table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" /> Expenses
          </h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {report.expenseLines.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-neutral-400 italic">No expenses in this period</td>
              </tr>
            ) : (
              report.expenseLines.map(line => (
                <tr key={line.categoryId} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-4 py-2.5 text-neutral-700">{line.categoryName}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-red-700">{fmt(line.total)}</td>
                </tr>
              ))
            )}
            <tr className="bg-red-50">
              <td className="px-4 py-2.5 font-bold text-red-800">Total Expenses</td>
              <td className="px-4 py-2.5 text-right font-bold text-red-800">{fmt(report.totalExpenses)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Net income footer */}
      <div className={`rounded-xl border-2 p-4 text-center ${
        report.netIncome >= 0
          ? 'border-green-300 bg-green-50'
          : 'border-red-300 bg-red-50'
      }`}>
        <p className="text-xs font-medium text-neutral-500 mb-1">Net Income</p>
        <p className={`text-2xl font-bold ${report.netIncome >= 0 ? 'text-green-800' : 'text-red-800'}`}>
          {fmt(report.netIncome)}
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          {range.start} &mdash; {range.end}
        </p>
      </div>
    </div>
  );
}
