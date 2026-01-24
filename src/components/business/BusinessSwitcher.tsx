import React, { useEffect, useState } from 'react';
import { createPersistence } from '../../lib/persistence';
import type { Business } from '../../types/index';
import { Button } from '../ui/Button';
import { Plus } from 'lucide-react';

const persistence = createPersistence();

export const BusinessSwitcher: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      const list = await persistence.getBusinesses();
      setBusinesses(list);
      const active = await persistence.getActiveBusinessId();
      setActiveId(active);
    })();
  }, []);

  const switchBusiness = async (id: string) => {
    await persistence.setActiveBusinessId(id);
    setActiveId(id);
    // optionally, apps can listen for storage events or call a reload
    window.dispatchEvent(new CustomEvent('moneta:businessSwitched', { detail: { businessId: id } }));
  };

  const createBusiness = async () => {
    if (!name.trim()) return;
    const id = 'b_' + Math.random().toString(36).slice(2, 9);
    const b: Business = {
      id,
      name: name.trim(),
      currency: 'USD',
      createdAt: Date.now(),
    };
    await persistence.addBusiness(b);
    setBusinesses(prev => [...prev, b]);
    setName('');
    setCreating(false);
    await switchBusiness(id);
  };

  return (
    <div className="relative inline-block">
      <div className="flex items-center space-x-2">
        <select
          value={activeId ?? ''}
          onChange={e => switchBusiness(e.target.value)}
          className="px-3 py-2 rounded-md border border-neutral-200 bg-white text-sm"
        >
          <option value="">Select business...</option>
          {businesses.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <Button variant="outline" size="sm" onClick={() => setCreating(v => !v)}>
          <Plus className="w-4 h-4 mr-2" />
          New
        </Button>
      </div>

      {creating && (
        <div className="mt-2 p-3 bg-white border rounded-md shadow-sm w-64">
          <label className="block text-xs text-neutral-600 mb-1">Business name</label>
          <input
            className="w-full px-3 py-2 border rounded-md text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Acme LLC"
          />
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setCreating(false)} className="mr-2">Cancel</Button>
            <Button variant="primary" size="sm" onClick={createBusiness}>Create</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessSwitcher;
