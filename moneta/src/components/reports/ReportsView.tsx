'use client';
import { Calendar, TrendingUp, TrendingDown, ArrowUp, ArrowDown, PieChart, BookOpen, BarChart3 } from 'lucide-react';
import type { Transaction, Category, ReportsProps } from '../../types';
import { buildTrialBalance, buildBalanceSheet } from '../../lib/journal';
import { formatMoney } from '../../lib/formatMoney';

export function ReportsView({ transactions, categories, metrics, accounts, journalEntries }: ReportsProps) {
  const businessExpenses = transactions.filter(
    (t: Transaction) => t.type === 'business' && t.amount < 0 && (t.kind ?? 'income_expense') !== 'transfer',
  );
  const expensesByCategory: Record<string, number> = {};

  businessExpenses.forEach((tx: Transaction) => {
    const category = categories.find((c: Category) => c.id === tx.categoryId);
    const categoryName = category?.name || 'Uncategorized';
    expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + Math.abs(tx.amount);
  });

  const sortedExpenses = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);

  // Prepare monthly series for sparklines (last 6 months)
  const monthsBack = 6;
  const monthLabels: string[] = [];
  const incomeSeries: number[] = [];
  const expenseSeries: number[] = [];
  const netSeries: number[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    monthLabels.push(d.toLocaleDateString(undefined, { month: 'short' }));
    const monthIncome = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === y && td.getMonth() === m && t.amount > 0;
    }).reduce((s, t) => s + t.amount, 0);
    const monthExpenses = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === y && td.getMonth() === m && t.amount < 0;
    }).reduce((s, t) => s + Math.abs(t.amount), 0);
    incomeSeries.push(monthIncome);
    expenseSeries.push(monthExpenses);
    netSeries.push(monthIncome - monthExpenses);
  }

  const renderSparkline = (values: number[], stroke: string) => {
    const w = 92; const h = 24; const pad = 2;
    if (!values || values.length === 0) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const step = (w - pad * 2) / (values.length - 1 || 1);
    const points = values.map((v, i) => {
      const x = pad + i * step;
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={w} height={h} className="inline-block align-middle">
        <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    );
  };

  return (
    <div className="space-y-8">
      {/* Monthly Overview Card - neutral, high-contrast */}
      <div className="bg-white p-8 rounded-2xl shadow-soft border border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-neutral-900">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-neutral-600">Business Performance Overview</p>
          </div>
          <Calendar className="w-12 h-12 text-neutral-300" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-neutral-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 mb-2 uppercase tracking-wide">Revenue</p>
                <p className="text-2xl font-bold text-neutral-900">{formatMoney(metrics.income)}</p>
                <div className="mt-2">{renderSparkline(incomeSeries, '#10b981')}</div>
              </div>
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <div className="bg-neutral-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 mb-2 uppercase tracking-wide">Expenses</p>
                <p className="text-2xl font-bold text-red-700">{formatMoney(-metrics.expenses)}</p>
                <div className="mt-2">{renderSparkline(expenseSeries, '#ef4444')}</div>
              </div>
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>

          <div className={`rounded-xl p-4`}>
            <div className="flex items-center justify-between bg-neutral-50 rounded-xl p-4">
              <div>
                <p className={`text-sm ${metrics.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Net</p>
                <p className={`text-2xl font-bold ${metrics.net >= 0 ? 'text-neutral-900' : 'text-neutral-900'}`}>
                  {formatMoney(metrics.net)}
                </p>
                <div className="mt-2">{renderSparkline(netSeries, '#6366f1')}</div>
              </div>
              {metrics.net >= 0 ? (
                <ArrowUp className="w-6 h-6 text-emerald-500" />
              ) : (
                <ArrowDown className="w-6 h-6 text-red-500" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expense Categories Chart */}
      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-soft">
        <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
          <PieChart className="w-5 h-5 mr-2 text-neutral-700" />
          Expense Breakdown
        </h3>

        {sortedExpenses.length === 0 ? (
          <div className="text-center py-12">
            <PieChart className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500">No expenses recorded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedExpenses.map(([category, amount], index) => {
              const percentage = (amount / totalExpenses) * 100;
              const colors = [
                'bg-blue-500', 'bg-green-500', 'bg-purple-500',
                'bg-red-500', 'bg-yellow-500', 'bg-indigo-500'
              ];

              return (
                <div key={category} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${colors[index % colors.length]}`} />
                    <span className="font-medium text-neutral-900">{category}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-900">{formatMoney(amount)}</p>
                    <p className="text-sm text-neutral-500">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-soft">
        <h3 className="text-lg font-semibold text-neutral-900 mb-2 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-neutral-700" />
          Trial balance (ledger)
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          Double-entry register balances for the active books. Category rows use your income/expense categories as P&amp;L accounts.
        </p>
        {journalEntries.length === 0 ? (
          <p className="text-neutral-500 text-sm">No journal activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-600">
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4 text-right">Debit</th>
                  <th className="py-2 pr-4 text-right">Credit</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {buildTrialBalance(accounts, categories, journalEntries).map(row => (
                  <tr key={row.accountId} className="border-b border-neutral-100">
                    <td className="py-2 pr-4 text-neutral-900">{row.label}</td>
                    <td className="py-2 pr-4 text-neutral-500 capitalize">{row.ledgerType}</td>
                    <td className="py-2 pr-4 text-right font-mono">{formatMoney(row.debitTotal)}</td>
                    <td className="py-2 pr-4 text-right font-mono">{formatMoney(row.creditTotal)}</td>
                    <td className="py-2 text-right font-mono font-medium">{formatMoney(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-soft">
        <h3 className="text-lg font-semibold text-neutral-900 mb-2 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-neutral-700" />
          Balance sheet (simplified)
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          Assets and liabilities from bank/card registers; equity includes opening balance equity and open P&amp;L (uncategorized to retained earnings).
        </p>
        {(() => {
          const bs = buildBalanceSheet(accounts, categories, journalEntries);
          const Line = ({ label, amount }: { label: string; amount: number }) => (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-neutral-700">{label}</span>
              <span className="font-mono font-medium">{formatMoney(amount)}</span>
            </div>
          );
          return (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-lg border border-neutral-200 p-4">
                <h4 className="font-semibold text-neutral-900 mb-2">Assets</h4>
                {bs.assetLines.map(l => (
                  <Line key={l.id} label={l.label} amount={l.amount} />
                ))}
                <div className="flex justify-between pt-2 mt-2 border-t border-neutral-200 font-semibold">
                  <span>Total assets</span>
                  <span className="font-mono">{formatMoney(bs.totalAssets)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4">
                <h4 className="font-semibold text-neutral-900 mb-2">Liabilities</h4>
                {bs.liabilityLines.length === 0 ? (
                  <p className="text-neutral-500 text-sm">None</p>
                ) : (
                  bs.liabilityLines.map(l => <Line key={l.id} label={l.label} amount={l.amount} />)
                )}
                <div className="flex justify-between pt-2 mt-2 border-t border-neutral-200 font-semibold">
                  <span>Total liabilities</span>
                  <span className="font-mono">{formatMoney(bs.totalLiabilities)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4">
                <h4 className="font-semibold text-neutral-900 mb-2">Equity</h4>
                {bs.equityLines.map(l => (
                  <Line key={l.id} label={l.label} amount={l.amount} />
                ))}
                <div className="flex justify-between pt-2 mt-2 border-t border-neutral-200 font-semibold">
                  <span>Total equity</span>
                  <span className="font-mono">{formatMoney(bs.totalEquity)}</span>
                </div>
                <p className={`text-xs mt-3 ${Math.abs(bs.check) < 0.02 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  Accounting check (A − L − E): {formatMoney(bs.check)}
                  {Math.abs(bs.check) < 0.02 ? ' — balanced' : ' — review transfers and openings'}
                </p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
