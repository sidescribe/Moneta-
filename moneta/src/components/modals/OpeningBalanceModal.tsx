'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Account } from '../../types';

export default function OpeningBalanceModal({
  account,
  onClose,
  onApply,
}: {
  account: Account;
  onClose: () => void;
  onApply: (amount: number, asOfDate: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const lt = account.ledgerType ?? (account.type === 'credit_card' ? 'liability' : 'asset');

  const submit = () => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n < 0) {
      alert('Enter a non-negative opening amount.');
      return;
    }
    onApply(n, asOf);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-large max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Opening balance</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100" aria-label="Close">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <p className="text-sm text-neutral-600 mb-2">
          <strong>{account.name}</strong> — {lt === 'asset' ? 'Asset register (e.g. cash in bank).' : 'Liability register (e.g. amount owed on card).'}
        </p>
        <p className="text-xs text-neutral-500 mb-4">
          Creates a balanced journal entry against Opening balance equity. Adjusting this replaces any prior opening entry for this register.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Opening amount</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">As of date</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={submit}>
            Save opening entry
          </Button>
        </div>
      </div>
    </div>
  );
}
