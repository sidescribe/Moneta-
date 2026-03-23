import React, { useState } from 'react';
import type { Category, CategoryRule } from '../../types';
import { Button } from '../ui/Button';
import { newRuleId, sortRulesByPriority } from '../../lib/categoryRules';
import { Trash2, Plus, Wand2 } from 'lucide-react';

type Props = {
  rules: CategoryRule[];
  categories: Category[];
  onChange: (rules: CategoryRule[]) => void;
  onApplyToExisting: () => void;
};

export const RulesList: React.FC<Props> = ({ rules, categories, onChange, onApplyToExisting }) => {
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [priority, setPriority] = useState(10);
  const [matchField, setMatchField] = useState<CategoryRule['matchField']>('description');

  const sorted = sortRulesByPriority(rules);

  const addRule = () => {
    const p = pattern.trim();
    if (!p || !categoryId) return;
    onChange([
      ...rules,
      { id: newRuleId(), pattern: p, categoryId, priority, matchField },
    ]);
    setPattern('');
  };

  const remove = (id: string) => {
    onChange(rules.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-neutral-900 mb-2 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-violet-600" />
          Auto-categorization rules
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          When a transaction description or notes contains the text (case-insensitive), Moneta can set the category. Lower priority numbers run first. Rules apply when you save a transaction or when you run &quot;Apply to existing&quot;.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Contains text</label>
            <input
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              placeholder="e.g. OPENAI, AWS, PAYROLL"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Priority (lower first)</label>
            <input
              type="number"
              value={priority}
              onChange={e => setPriority(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Match in</label>
            <select
              value={matchField}
              onChange={e => setMatchField(e.target.value as CategoryRule['matchField'])}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="description">Description only</option>
              <option value="notes">Notes only</option>
              <option value="both">Description or notes</option>
            </select>
          </div>
        </div>
        <Button type="button" icon={Plus} onClick={addRule}>
          Add rule
        </Button>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h4 className="font-semibold text-neutral-900">Active rules ({rules.length})</h4>
          <Button type="button" variant="outline" size="sm" icon={Wand2} onClick={onApplyToExisting}>
            Apply to existing transactions
          </Button>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-neutral-500">No rules yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {sorted.map(r => {
              const cat = categories.find(c => c.id === r.categoryId);
              return (
                <li key={r.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-900">
                      &quot;{r.pattern}&quot; → {cat?.name ?? r.categoryId}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Priority {r.priority} · {r.matchField}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RulesList;
