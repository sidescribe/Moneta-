import type { Category, CategoryRule, Transaction } from '../types';

export function sortRulesByPriority(rules: CategoryRule[]): CategoryRule[] {
  return [...rules].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

function fieldText(tx: Pick<Transaction, 'description' | 'notes'>, field: CategoryRule['matchField']): string {
  const d = (tx.description || '').toLowerCase();
  const n = (tx.notes || '').toLowerCase();
  if (field === 'description') return d;
  if (field === 'notes') return n;
  return `${d} ${n}`;
}

/** First matching rule wins (lowest priority number first). */
export function findMatchingRule(
  tx: Pick<Transaction, 'description' | 'notes'>,
  rules: CategoryRule[],
): CategoryRule | null {
  const sorted = sortRulesByPriority(rules);
  const patternTest = (haystack: string, pattern: string) => {
    const p = pattern.trim().toLowerCase();
    if (!p) return false;
    return haystack.includes(p);
  };
  for (const r of sorted) {
    const field = r.matchField ?? 'description';
    const text = fieldText(tx, field);
    if (patternTest(text, r.pattern)) return r;
  }
  return null;
}

export function applyRulesToTransaction(
  tx: Transaction,
  rules: CategoryRule[],
  categories: Category[],
): Transaction {
  const kind = tx.kind ?? 'income_expense';
  if (kind !== 'income_expense') return tx;
  const match = findMatchingRule(tx, rules);
  if (!match) return tx;
  const cat = categories.find(c => c.id === match.categoryId);
  if (!cat) return tx;
  const isExpense = tx.amount < 0;
  if (isExpense && cat.type !== 'expense') return tx;
  if (!isExpense && cat.type !== 'income') return tx;
  return { ...tx, categoryId: match.categoryId };
}

export function newRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
