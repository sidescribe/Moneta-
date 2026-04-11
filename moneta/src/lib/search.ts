import type { Transaction, Account, Category } from '../types';

export interface SearchResult {
  transaction: Transaction;
  matchField: 'description' | 'notes' | 'category' | 'account' | 'amount';
  snippet: string;
}

export function searchTransactions(
  query: string,
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const tx of transactions) {
    if (tx.description.toLowerCase().includes(q)) {
      results.push({ transaction: tx, matchField: 'description', snippet: tx.description });
      continue;
    }
    if (tx.notes && tx.notes.toLowerCase().includes(q)) {
      results.push({ transaction: tx, matchField: 'notes', snippet: tx.notes });
      continue;
    }
    const cat = categories.find(c => c.id === tx.categoryId);
    if (cat && cat.name.toLowerCase().includes(q)) {
      results.push({ transaction: tx, matchField: 'category', snippet: cat.name });
      continue;
    }
    const acct = accounts.find(a => a.id === tx.accountId);
    if (acct && acct.name.toLowerCase().includes(q)) {
      results.push({ transaction: tx, matchField: 'account', snippet: acct.name });
      continue;
    }
    const amtStr = Math.abs(tx.amount).toFixed(2);
    if (amtStr.includes(q) || `$${amtStr}`.includes(q)) {
      results.push({ transaction: tx, matchField: 'amount', snippet: `$${amtStr}` });
    }
  }

  return results.sort((a, b) => new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime());
}
