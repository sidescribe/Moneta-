import type { Transaction, Category } from '../types';

export interface PnlLine {
  categoryId: string;
  categoryName: string;
  total: number;
}

export interface ProfitLossReport {
  startDate: string;
  endDate: string;
  incomeLines: PnlLine[];
  expenseLines: PnlLine[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export function buildProfitLoss(
  transactions: Transaction[],
  categories: Category[],
  startDate: string,
  endDate: string,
): ProfitLossReport {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const filtered = transactions.filter(t => {
    if ((t.kind ?? 'income_expense') === 'transfer') return false;
    const d = new Date(t.date);
    return d >= start && d <= end;
  });

  const incomeMap: Record<string, number> = {};
  const expenseMap: Record<string, number> = {};

  for (const tx of filtered) {
    if (tx.amount > 0) {
      incomeMap[tx.categoryId] = (incomeMap[tx.categoryId] ?? 0) + tx.amount;
    } else {
      expenseMap[tx.categoryId] = (expenseMap[tx.categoryId] ?? 0) + Math.abs(tx.amount);
    }
  }

  const makeLine = (map: Record<string, number>): PnlLine[] =>
    Object.entries(map)
      .map(([id, total]) => ({
        categoryId: id,
        categoryName: categories.find(c => c.id === id)?.name ?? 'Uncategorized',
        total,
      }))
      .sort((a, b) => b.total - a.total);

  const incomeLines = makeLine(incomeMap);
  const expenseLines = makeLine(expenseMap);
  const totalIncome = incomeLines.reduce((s, l) => s + l.total, 0);
  const totalExpenses = expenseLines.reduce((s, l) => s + l.total, 0);

  return {
    startDate,
    endDate,
    incomeLines,
    expenseLines,
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
  };
}

export type DateRangePreset = 'this-month' | 'last-month' | 'this-quarter' | 'last-quarter' | 'ytd' | 'last-year' | 'last-90' | 'custom';

export function presetToRange(preset: DateRangePreset, now = new Date()): { start: string; end: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'this-month':
      return { start: fmt(new Date(y, m, 1)), end: fmt(now) };
    case 'last-month': {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return { start: fmt(s), end: fmt(e) };
    }
    case 'this-quarter': {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
      return { start: fmt(qStart), end: fmt(now) };
    }
    case 'last-quarter': {
      const q = Math.floor(m / 3);
      const qs = q === 0 ? new Date(y - 1, 9, 1) : new Date(y, (q - 1) * 3, 1);
      const qe = q === 0 ? new Date(y - 1, 12, 0) : new Date(y, q * 3, 0);
      return { start: fmt(qs), end: fmt(qe) };
    }
    case 'ytd':
      return { start: fmt(new Date(y, 0, 1)), end: fmt(now) };
    case 'last-year':
      return { start: fmt(new Date(y - 1, 0, 1)), end: fmt(new Date(y - 1, 11, 31)) };
    case 'last-90': {
      const s = new Date(now);
      s.setDate(s.getDate() - 90);
      return { start: fmt(s), end: fmt(now) };
    }
    case 'custom':
      return { start: fmt(new Date(y, m, 1)), end: fmt(now) };
  }
}
