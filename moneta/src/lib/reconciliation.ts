import type { Transaction } from '../types';

export interface ReconciliationState {
  accountId: string;
  statementEndDate: string;
  statementBalance: number;
  clearedTransactionIds: Set<string>;
}

export function getReconciliationDifference(
  transactions: Transaction[],
  state: ReconciliationState,
  openingBalance: number,
): { clearedBalance: number; difference: number; unclearedCount: number } {
  const accountTxs = transactions.filter(t => t.accountId === state.accountId);
  const clearedBalance = accountTxs
    .filter(t => state.clearedTransactionIds.has(t.id))
    .reduce((sum, t) => sum + t.amount, openingBalance);
  const unclearedCount = accountTxs.length - state.clearedTransactionIds.size;
  return {
    clearedBalance,
    difference: state.statementBalance - clearedBalance,
    unclearedCount,
  };
}
