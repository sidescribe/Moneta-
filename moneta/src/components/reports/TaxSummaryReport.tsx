import { useState } from 'react';
import type { Transaction, Category } from '../../types';
import { buildTaxSummary } from '../../lib/taxSummary';
import { FileText, DollarSign } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function getAvailableYears(transactions: Transaction[]): number[] {
  const years = new Set<number>();
  for (const tx of transactions) {
    years.add(new Date(tx.date).getFullYear());
  }
  const sorted = [...years].sort((a, b) => b - a);
  if (sorted.length === 0) sorted.push(new Date().getFullYear());
  return sorted;
}

export default function TaxSummaryReport({ transactions, categories }: Props) {
  const availableYears = getAvailableYears(transactions);
  const [year, setYear] = useState(availableYears[0]);
  const summary = buildTaxSummary(transactions, categories, year);

  return (
    <div className="space-y-6">
      {/* Year picker */}
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-neutral-500" />
        <label className="text-sm font-medium text-neutral-600">Tax Year</label>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-600" />
            <p className="text-xs font-medium text-green-700">Gross Income</p>
          </div>
          <p className="text-xl font-bold text-green-800">{fmt(summary.grossIncome)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-red-600" />
            <p className="text-xs font-medium text-red-700">Total Deductions</p>
          </div>
          <p className="text-xl font-bold text-red-800">{fmt(summary.totalDeductions)}</p>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-neutral-600" />
            <p className="text-xs font-medium text-neutral-600">Net Profit</p>
          </div>
          <p className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
            {fmt(summary.netProfit)}
          </p>
        </div>
      </div>

      {/* Schedule C line items table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden print:border-black print:rounded-none">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 print:bg-white print:border-black">
              <th className="px-4 py-3 text-left font-semibold text-neutral-700">Schedule C Line</th>
              <th className="px-4 py-3 text-left font-semibold text-neutral-700 hidden sm:table-cell">Categories</th>
              <th className="px-4 py-3 text-right font-semibold text-neutral-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.lineItems.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-neutral-400 italic">
                  No deductible expenses found for {year}
                </td>
              </tr>
            ) : (
              summary.lineItems.map((item, i) => (
                <tr
                  key={item.scheduleC}
                  className={`border-b border-neutral-100 last:border-b-0 print:border-neutral-300 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-neutral-50 print:bg-white'
                  }`}
                >
                  <td className="px-4 py-3 text-neutral-800 font-medium">{item.scheduleC}</td>
                  <td className="px-4 py-3 text-neutral-500 hidden sm:table-cell">
                    {item.categoryNames.join(', ')}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-700">{fmt(item.total)}</td>
                </tr>
              ))
            )}
            {summary.lineItems.length > 0 && (
              <tr className="bg-neutral-100 border-t border-neutral-300 print:bg-white print:border-black">
                <td className="px-4 py-3 font-bold text-neutral-800">Total Deductions</td>
                <td className="px-4 py-3 hidden sm:table-cell" />
                <td className="px-4 py-3 text-right font-bold text-red-800">{fmt(summary.totalDeductions)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: show categories below table for small screens */}
      {summary.lineItems.length > 0 && (
        <div className="sm:hidden space-y-2">
          {summary.lineItems.map(item => (
            <div key={item.scheduleC} className="bg-neutral-50 rounded-lg px-3 py-2 text-xs">
              <p className="font-medium text-neutral-700">{item.scheduleC}</p>
              <p className="text-neutral-500">{item.categoryNames.join(', ')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-neutral-400 text-center italic print:text-neutral-600">
        This is an estimate. Consult your tax professional.
      </p>
    </div>
  );
}
