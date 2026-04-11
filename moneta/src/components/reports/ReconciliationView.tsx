import { useState, useMemo } from 'react';
import type { Transaction, Account } from '../../types';
import { getReconciliationDifference, type ReconciliationState } from '../../lib/reconciliation';
import { CheckCircle, Circle, AlertTriangle, DollarSign } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  accounts: Account[];
  transactions: Transaction[];
  getAccountBalance: (id: string) => number;
  onMarkReconciled: (txIds: string[]) => void;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

type Step = 'setup' | 'reconcile';

export default function ReconciliationView({
  accounts,
  transactions,
  getAccountBalance,
  onMarkReconciled,
}: Props) {
  const [step, setStep] = useState<Step>('setup');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [statementEndDate, setStatementEndDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [statementBalance, setStatementBalance] = useState('');
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());

  const accountTxs = useMemo(() => {
    if (!accountId) return [];
    return transactions
      .filter(t => t.accountId === accountId && t.date <= statementEndDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
  }, [transactions, accountId, statementEndDate]);

  const reconState: ReconciliationState = {
    accountId,
    statementEndDate,
    statementBalance: Number(statementBalance) || 0,
    clearedTransactionIds: clearedIds,
  };

  const openingBalance = accountId ? getAccountBalance(accountId) : 0;

  const { clearedBalance, difference, unclearedCount } = getReconciliationDifference(
    transactions,
    reconState,
    openingBalance,
  );

  const isBalanced = Math.abs(difference) < 0.005;

  function toggleCleared(txId: string) {
    setClearedIds(prev => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  }

  function handleBeginReconciliation() {
    const preCleared = new Set<string>();
    for (const tx of accountTxs) {
      if (tx.reconciled) preCleared.add(tx.id);
    }
    setClearedIds(preCleared);
    setStep('reconcile');
  }

  function handleFinish() {
    onMarkReconciled([...clearedIds]);
    setStep('setup');
    setClearedIds(new Set());
    setStatementBalance('');
  }

  if (step === 'setup') {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6 max-w-lg mx-auto space-y-5">
        <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary-600" />
          Begin Reconciliation
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-600 mb-1">Account</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-600 mb-1">Statement End Date</label>
            <input
              type="date"
              value={statementEndDate}
              onChange={e => setStatementEndDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-600 mb-1">Statement Ending Balance</label>
            <input
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={e => setStatementBalance(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!accountId || !statementBalance}
          onClick={handleBeginReconciliation}
        >
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      {/* Status bar */}
      <div className="px-4 py-4 border-b border-neutral-200 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm">
            <span className="text-neutral-500">Statement Balance:</span>{' '}
            <span className="font-semibold text-neutral-800">{fmt(Number(statementBalance))}</span>
          </div>
          <div className="text-sm">
            <span className="text-neutral-500">Cleared Balance:</span>{' '}
            <span className="font-semibold text-neutral-800">{fmt(clearedBalance)}</span>
          </div>
        </div>

        <div className={`text-sm font-bold px-3 py-1.5 rounded-lg text-center ${
          isBalanced
            ? 'bg-green-100 text-green-800'
            : 'bg-amber-100 text-amber-800'
        }`}>
          {isBalanced ? (
            <span className="flex items-center gap-1.5 justify-center">
              <CheckCircle className="w-4 h-4" /> Balanced!
            </span>
          ) : (
            <span className="flex items-center gap-1.5 justify-center">
              <AlertTriangle className="w-4 h-4" /> Difference: {fmt(difference)}
            </span>
          )}
        </div>
      </div>

      {/* Transaction list */}
      <div className="divide-y divide-neutral-100 max-h-[60vh] overflow-y-auto">
        {accountTxs.length === 0 ? (
          <p className="px-4 py-8 text-center text-neutral-400 italic text-sm">
            No transactions found for this account through {statementEndDate}
          </p>
        ) : (
          accountTxs.map(tx => {
            const cleared = clearedIds.has(tx.id);
            return (
              <label
                key={tx.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={cleared}
                  onClick={() => toggleCleared(tx.id)}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {cleared ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <Circle className="w-6 h-6 text-neutral-300" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${cleared ? 'text-neutral-800' : 'text-neutral-500'}`}>
                    {tx.description}
                  </p>
                  <p className="text-xs text-neutral-400">{tx.date}</p>
                </div>
                <span className={`text-sm font-semibold whitespace-nowrap ${
                  tx.amount >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {fmt(tx.amount)}
                </span>
              </label>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-neutral-200 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <p className="text-xs text-neutral-500">
          {clearedIds.size} cleared &middot; {unclearedCount} uncleared
        </p>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="md"
            className="flex-1 sm:flex-none"
            onClick={() => {
              setStep('setup');
              setClearedIds(new Set());
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            className="flex-1 sm:flex-none"
            disabled={!isBalanced}
            onClick={handleFinish}
          >
            Finish Reconciliation
          </Button>
        </div>
      </div>
    </div>
  );
}
