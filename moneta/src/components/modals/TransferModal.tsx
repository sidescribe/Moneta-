'use client';
import { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Account, Transaction } from '../../types';

export default function TransferModal({
  accounts,
  activeBusinessId,
  onClose,
  onSave,
}: {
  accounts: Account[];
  activeBusinessId: string | null;
  onClose: () => void;
  onSave: (draft: Omit<Transaction, 'id' | 'createdAt' | 'kind'>) => void;
}) {
  const eligible = accounts.filter(a => a.isActive);
  const [fromId, setFromId] = useState(eligible[0]?.id ?? '');
  const [toId, setToId] = useState(eligible.find(a => a.id !== eligible[0]?.id)?.id ?? eligible[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('Transfer');

  const submit = () => {
    const amt = parseFloat(amount);
    if (!fromId || !toId || fromId === toId || !amt || amt <= 0) {
      alert('Choose two different accounts and a positive amount.');
      return;
    }
    const fromAcc = accounts.find(a => a.id === fromId);
    const toAcc = accounts.find(a => a.id === toId);
    const businessSide =
      fromAcc?.category === 'business' || toAcc?.category === 'business';
    const businessId = businessSide ? activeBusinessId ?? undefined : undefined;
    onSave({
      accountId: fromId,
      transferToAccountId: toId,
      amount: amt,
      date: new Date(date).toISOString(),
      description: description.trim() || 'Transfer',
      categoryId: '',
      type: (fromAcc?.category as 'personal' | 'business') || 'personal',
      businessId,
      notes: undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-large max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Transfer between accounts
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100" aria-label="Close">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <p className="text-sm text-neutral-600 mb-4">
          Posts Dr to the destination register and Cr from the source (double-entry). Use for card payments, checking → savings, or business ↔ personal when appropriate.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">From</label>
            <select
              value={fromId}
              onChange={e => setFromId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            >
              {eligible.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.category})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">To</label>
            <select
              value={toId}
              onChange={e => setToId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            >
              {eligible.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.category})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Memo</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={submit}>
            Record transfer
          </Button>
        </div>
      </div>
    </div>
  );
}
