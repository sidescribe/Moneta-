import type { Transaction } from '../types';

export interface MonthlyChartPoint {
  label: string;
  year: number;
  month: number;
  income: number;
  expenses: number;
  net: number;
}

export function buildMonthlyChart(
  transactions: Transaction[],
  monthsBack = 12,
): MonthlyChartPoint[] {
  const points: MonthlyChartPoint[] = [];
  const now = new Date();

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

    const monthTxs = transactions.filter(t => {
      if ((t.kind ?? 'income_expense') === 'transfer') return false;
      const td = new Date(t.date);
      return td.getFullYear() === y && td.getMonth() === m;
    });

    const income = monthTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = monthTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    points.push({ label, year: y, month: m, income, expenses, net: income - expenses });
  }

  return points;
}

export function buildCashFlowTrend(
  transactions: Transaction[],
  monthsBack = 12,
): { label: string; cumulativeNet: number }[] {
  const monthly = buildMonthlyChart(transactions, monthsBack);
  let cumulative = 0;
  return monthly.map(p => {
    cumulative += p.net;
    return { label: p.label, cumulativeNet: cumulative };
  });
}
