import { describe, expect, it } from 'vitest';
import { autoDetectMapping, deduplicateTransactions, parseCsvText } from './csvImport';
import type { Transaction } from '../types';

describe('parseCsvText', () => {
  it('parses quoted fields with commas and escaped quotes', () => {
    const text = [
      'Date,Description,Amount',
      '2026-01-15,"Coffee, Inc.",12.50',
      '2026-01-16,"Said ""hello""",-5.00',
    ].join('\n');

    const result = parseCsvText(text);

    expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(['2026-01-15', 'Coffee, Inc.', '12.50']);
    expect(result.rows[1]).toEqual(['2026-01-16', 'Said "hello"', '-5.00']);
    expect(result.preview).toHaveLength(2);
  });
});

describe('autoDetectMapping', () => {
  it('detects typical bank headers with a single amount column', () => {
    const mapping = autoDetectMapping(['Posted Date', 'Payee', 'Amount']);
    expect(mapping).toEqual({
      date: 0,
      description: 1,
      amount: 2,
      debit: undefined,
      credit: undefined,
    });
  });

  it('detects debit/credit bank headers', () => {
    const mapping = autoDetectMapping(['Transaction Date', 'Description', 'Withdrawal', 'Deposit']);
    expect(mapping).not.toBeNull();
    expect(mapping!.date).toBe(0);
    expect(mapping!.description).toBe(1);
    expect(mapping!.amount).toBe(-1);
    expect(mapping!.debit).toBe(2);
    expect(mapping!.credit).toBe(3);
  });
});

describe('deduplicateTransactions', () => {
  const base = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'in-1',
    accountId: 'a1',
    date: '2026-03-10T00:00:00.000Z',
    amount: -42.5,
    categoryId: 'exp',
    description: 'Coffee Shop',
    type: 'personal',
    kind: 'income_expense',
    ...overrides,
  });

  it('separates duplicates from unique incoming rows', () => {
    const existing = [base({ id: 'ex-1' })];
    const incoming = [
      base({ id: 'in-1' }),
      base({ id: 'in-2', amount: -10, description: 'Different' }),
    ];

    const { unique, duplicates } = deduplicateTransactions(incoming, existing);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].id).toBe('in-1');
    expect(unique).toHaveLength(1);
    expect(unique[0].id).toBe('in-2');
  });
});
