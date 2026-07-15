import { describe, expect, it } from 'vitest';
import { buildProfitLoss, presetToRange } from './profitLoss';
import type { Category, Transaction } from '../types';

const categories: Category[] = [
  { id: 'inc', name: 'Revenue', type: 'income', businessRelevant: true },
  { id: 'exp', name: 'Hosting', type: 'expense', businessRelevant: true },
];

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'date' | 'categoryId'>): Transaction {
  return {
    accountId: 'a1',
    description: 'Test',
    type: 'business',
    kind: 'income_expense',
    ...partial,
  };
}

describe('buildProfitLoss', () => {
  it('sums income and expense totals by category', () => {
    const transactions = [
      tx({ id: '1', amount: 1000, date: '2026-03-10T12:00:00.000Z', categoryId: 'inc', description: 'Sale' }),
      tx({ id: '2', amount: 500, date: '2026-03-15T12:00:00.000Z', categoryId: 'inc', description: 'Sale 2' }),
      tx({ id: '3', amount: -200, date: '2026-03-12T12:00:00.000Z', categoryId: 'exp', description: 'Server' }),
    ];

    const report = buildProfitLoss(transactions, categories, '2026-03-01', '2026-03-31');

    expect(report.totalIncome).toBe(1500);
    expect(report.totalExpenses).toBe(200);
    expect(report.netIncome).toBe(1300);
    expect(report.incomeLines).toHaveLength(1);
    expect(report.incomeLines[0]).toMatchObject({ categoryId: 'inc', categoryName: 'Revenue', total: 1500 });
    expect(report.expenseLines[0]).toMatchObject({ categoryId: 'exp', categoryName: 'Hosting', total: 200 });
  });

  it('excludes transfer transactions', () => {
    const transactions = [
      tx({ id: '1', amount: 1000, date: '2026-03-10T12:00:00.000Z', categoryId: 'inc' }),
      tx({
        id: '2',
        amount: 400,
        date: '2026-03-11T12:00:00.000Z',
        categoryId: '',
        kind: 'transfer',
        transferToAccountId: 'a2',
        description: 'Transfer',
      }),
      tx({ id: '3', amount: -50, date: '2026-03-12T12:00:00.000Z', categoryId: 'exp' }),
    ];

    const report = buildProfitLoss(transactions, categories, '2026-03-01', '2026-03-31');

    expect(report.totalIncome).toBe(1000);
    expect(report.totalExpenses).toBe(50);
    expect(report.netIncome).toBe(950);
  });

  it('filters by date range', () => {
    const transactions = [
      tx({ id: '1', amount: 100, date: '2026-02-28T12:00:00.000Z', categoryId: 'inc' }),
      tx({ id: '2', amount: 200, date: '2026-03-01T12:00:00.000Z', categoryId: 'inc' }),
      tx({ id: '3', amount: 300, date: '2026-04-01T12:00:00.000Z', categoryId: 'inc' }),
    ];

    const report = buildProfitLoss(transactions, categories, '2026-03-01', '2026-03-31');

    expect(report.totalIncome).toBe(200);
    expect(report.incomeLines).toHaveLength(1);
  });
});

describe('presetToRange', () => {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;

  it("returns valid ISO dates for 'this-month'", () => {
    const now = new Date('2026-07-14T15:00:00.000Z');
    const range = presetToRange('this-month', now);
    expect(range.start).toMatch(isoDate);
    expect(range.end).toMatch(isoDate);
    expect(range.start).toBe('2026-07-01');
    expect(range.end).toBe(now.toISOString().slice(0, 10));
  });

  it("returns valid ISO dates for 'ytd'", () => {
    const now = new Date('2026-07-14T15:00:00.000Z');
    const range = presetToRange('ytd', now);
    expect(range.start).toMatch(isoDate);
    expect(range.end).toMatch(isoDate);
    expect(range.start).toBe('2026-01-01');
    expect(range.end).toBe(now.toISOString().slice(0, 10));
  });

  it("returns valid ISO dates for 'last-month'", () => {
    const now = new Date('2026-07-14T15:00:00.000Z');
    const range = presetToRange('last-month', now);
    expect(range.start).toMatch(isoDate);
    expect(range.end).toMatch(isoDate);
    expect(range.start).toBe('2026-06-01');
    expect(range.end).toBe('2026-06-30');
  });
});
