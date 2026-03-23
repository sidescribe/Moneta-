import React, { useEffect, useState } from 'react';
import type { Recurring, Account, Category } from '../../types/index';
import { createPersistence } from '../../lib/persistence';
import RecurringCreate from './RecurringCreate';
import { Button } from '../ui/Button';

const persistence = createPersistence();

interface Props {
  businessId: string | null;
  accounts: Account[];
  categories: Category[];
}

export const RecurringList: React.FC<Props> = ({ businessId, accounts, categories }) => {
  const [items, setItems] = useState<Recurring[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);

  const load = async () => {
    if (!businessId) return setItems([]);
    const list = await persistence.getRecurrings(businessId);
    setItems(list || []);
  };

  useEffect(() => { load(); }, [businessId]);

  useEffect(() => {
    const handler = (e: any) => {
      const id = e?.detail?.recurringId;
      if (!id) return;
      // ensure list is loaded
      (async () => {
        if (!businessId) return;
        const list = await persistence.getRecurrings(businessId);
        setItems(list || []);
        const found = (list || []).find(x => x.id === id);
        if (found) {
          setEditing(found);
          setShowCreate(true);
        }
      })();
    };
    window.addEventListener('moneta:openRecurring', handler as EventListener);
    return () => window.removeEventListener('moneta:openRecurring', handler as EventListener);
  }, [businessId]);

  const remove = async (id: string) => {
    if (!businessId) return;
    if (!confirm('Delete recurring rule?')) return;
    await persistence.deleteRecurring(businessId, id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Recurring rules</h3>
        <Button variant="primary" size="sm" onClick={() => { setEditing(null); setShowCreate(true); }}>New</Button>
      </div>

      {items.length === 0 && (
        <div className="p-4 bg-neutral-50 border rounded">No recurring rules for this business.</div>
      )}

      <div className="grid gap-3">
        {items.map(r => (
          <div key={r.id} className="p-3 bg-white border rounded flex justify-between items-center">
            <div>
              <div className="font-medium">{r.description || `${r.amount} ${r.frequency}`}</div>
              <div className="text-sm text-neutral-500">{r.isExpense ? 'Expense' : 'Income'} • Account: {accounts.find(a => a.id === r.accountId)?.name || r.accountId} • Category: {categories.find(c => c.id === r.categoryId)?.name || r.categoryId}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(r); setShowCreate(true); }}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl">
            <RecurringCreate
              businessId={businessId}
              accounts={accounts}
              categories={categories}
              existing={editing}
              onClose={() => setShowCreate(false)}
              onSaved={() => { setShowCreate(false); load(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringList;
