import { describe, expect, it } from 'vitest';
import {
  buildTrialBalance,
  isJournalBalanced,
  journalFromTransaction,
} from './journal';
import type { Account, Category, Transaction } from '../types';

const accounts: Account[] = [
  {
    id: 'checking',
    name: 'Business Checking',
    type: 'checking',
    category: 'business',
    isActive: true,
    ledgerType: 'asset',
  },
];

const categories: Category[] = [
  { id: 'rev', name: 'Revenue', type: 'income', businessRelevant: true },
];

describe('journalFromTransaction', () => {
  it('produces balanced journal lines for a simple income transaction', () => {
    const tx: Transaction = {
      id: 'tx1',
      accountId: 'checking',
      date: '2026-03-10T00:00:00.000Z',
      amount: 250,
      categoryId: 'rev',
      description: 'Client payment',
      type: 'business',
      kind: 'income_expense',
    };

    const entry = journalFromTransaction(tx, accounts, categories);

    expect(entry).not.toBeNull();
    expect(isJournalBalanced(entry!.lines)).toBe(true);

    const debits = entry!.lines.reduce((s, l) => s + l.debit, 0);
    const credits = entry!.lines.reduce((s, l) => s + l.credit, 0);
    expect(debits).toBe(250);
    expect(credits).toBe(250);
    expect(entry!.lines).toEqual([
      { accountId: 'checking', debit: 250, credit: 0 },
      { accountId: 'cat:rev', debit: 0, credit: 250 },
    ]);
  });
});

describe('buildTrialBalance', () => {
  it('includes balanced debit and credit totals for the income posting', () => {
    const tx: Transaction = {
      id: 'tx1',
      accountId: 'checking',
      date: '2026-03-10',
      amount: 100,
      categoryId: 'rev',
      description: 'Sale',
      type: 'business',
      kind: 'income_expense',
    };
    const entry = journalFromTransaction(tx, accounts, categories)!;
    const tb = buildTrialBalance(accounts, categories, [entry]);

    const totalDebit = tb.reduce((s, r) => s + r.debitTotal, 0);
    const totalCredit = tb.reduce((s, r) => s + r.creditTotal, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(100);
  });
});
