import { describe, expect, it } from 'vitest';
import { searchTransactions } from './search';
import type { Account, Category, Transaction } from '../types';

const accounts: Account[] = [
  { id: 'a1', name: 'Checking', type: 'checking', category: 'personal', isActive: true },
];

const categories: Category[] = [
  { id: 'c1', name: 'Groceries', type: 'expense', businessRelevant: false },
];

const transactions: Transaction[] = [
  {
    id: '1',
    accountId: 'a1',
    date: '2026-03-10T00:00:00.000Z',
    amount: -25.5,
    categoryId: 'c1',
    description: 'Whole Foods Market',
    type: 'personal',
    kind: 'income_expense',
  },
  {
    id: '2',
    accountId: 'a1',
    date: '2026-03-11T00:00:00.000Z',
    amount: 99.99,
    categoryId: 'c1',
    description: 'Refund',
    type: 'personal',
    kind: 'income_expense',
  },
];

describe('searchTransactions', () => {
  it('finds transactions by description', () => {
    const results = searchTransactions('whole foods', transactions, accounts, categories);
    expect(results).toHaveLength(1);
    expect(results[0].matchField).toBe('description');
    expect(results[0].transaction.id).toBe('1');
  });

  it('finds transactions by amount', () => {
    const results = searchTransactions('99.99', transactions, accounts, categories);
    expect(results).toHaveLength(1);
    expect(results[0].matchField).toBe('amount');
    expect(results[0].transaction.id).toBe('2');
  });
});
