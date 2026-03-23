import React, { useState, useEffect } from 'react';
import type { Recurring, Account, Category } from '../../types/index';
import { Button } from '../ui/Button';
import { createPersistence } from '../../lib/persistence';

const persistence = createPersistence();

interface Props {
  businessId: string | null;
  accounts: Account[];
  categories: Category[];
  existing?: Recurring | null;
  onClose: () => void;
  onSaved: () => void;
}

export const RecurringCreate: React.FC<Props> = ({ businessId, accounts, categories, existing = null, onClose, onSaved }) => {
  const [accountId, setAccountId] = useState(existing?.accountId || accounts[0]?.id || '');
  const [amount, setAmount] = useState(existing?.amount?.toString() || '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId || categories[0]?.id || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [isExpense, setIsExpense] = useState(existing?.isExpense ?? true);
  const [frequency, setFrequency] = useState<Recurring['frequency']>(existing?.frequency || 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(existing?.dayOfMonth || 1);
  const [startDate, setStartDate] = useState(existing?.startDate || new Date().toISOString().split('T')[0]);
  const [active, setActive] = useState(existing?.active ?? true);

  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [accounts, categories]);

  const save = async () => {
    if (!businessId) return alert('Select a business first');
    if (!accountId || !amount || !categoryId) return alert('Please fill required fields');

    const r: Recurring = {
      id: existing?.id || 'r_' + Math.random().toString(36).slice(2, 9),
      businessId: businessId || undefined,
      accountId,
      amount: parseFloat(amount),
      isExpense,
      categoryId,
      description,
      frequency,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      startDate,
      active,
      lastRunAt: existing?.lastRunAt,
      nextRunAt: existing?.nextRunAt,
    };

    if (existing) await persistence.updateRecurring(businessId, r);
    else await persistence.addRecurring(businessId, r);
    onSaved();
    onClose();
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md w-full max-w-md">
      <h3 className="text-lg font-semibold mb-3">{existing ? 'Edit Recurring' : 'New Recurring'}</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-neutral-600 mb-1">Account</label>
          <select className="w-full px-3 py-2 border rounded" value={accountId} onChange={e => setAccountId(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-neutral-600 mb-1">Amount</label>
          <input className="w-full px-3 py-2 border rounded" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-neutral-600 mb-1">Category</label>
          <select className="w-full px-3 py-2 border rounded" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-neutral-600 mb-1">Description (optional)</label>
          <input className="w-full px-3 py-2 border rounded" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-neutral-600 mb-1">Frequency</label>
          <select className="w-full px-3 py-2 border rounded" value={frequency} onChange={e => setFrequency(e.target.value as any)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-neutral-600 mb-1">Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setIsExpense(false)} className={`px-3 py-2 rounded ${!isExpense ? 'bg-green-100 text-green-800' : 'bg-white border'}`}>
              Income
            </button>
            <button type="button" onClick={() => setIsExpense(true)} className={`px-3 py-2 rounded ${isExpense ? 'bg-red-100 text-red-800' : 'bg-white border'}`}>
              Expense
            </button>
          </div>
        </div>
        {frequency === 'monthly' && (
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Day of month</label>
            <input className="w-full px-3 py-2 border rounded" type="number" min={1} max={31} value={dayOfMonth} onChange={e => setDayOfMonth(parseInt(e.target.value || '1'))} />
          </div>
        )}
        <div>
          <label className="block text-sm text-neutral-600 mb-1">Start date</label>
          <input className="w-full px-3 py-2 border rounded" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <input id="active" type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          <label htmlFor="active" className="text-sm">Active</label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
};

export default RecurringCreate;
