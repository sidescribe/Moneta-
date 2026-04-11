import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, X, Calendar } from 'lucide-react';
import type { Transaction, Account, Category } from '../types';
import { searchTransactions } from '../lib/search';

interface SearchBarProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onSelectTransaction: (tx: Transaction) => void;
}

export default function SearchBar({
  transactions,
  accounts,
  categories,
  onSelectTransaction,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(void 0);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(
    () => searchTransactions(debouncedQuery, transactions, accounts, categories).slice(0, 10),
    [debouncedQuery, transactions, accounts, categories],
  );

  const showDropdown = open && debouncedQuery.trim().length > 0;

  function clear() {
    setQuery('');
    setDebouncedQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function select(tx: Transaction) {
    onSelectTransaction(tx);
    setOpen(false);
  }

  function highlightMatch(text: string) {
    if (!debouncedQuery.trim()) return text;
    const idx = text.toLowerCase().indexOf(debouncedQuery.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary-100 text-primary-800 rounded px-0.5">
          {text.slice(idx, idx + debouncedQuery.length)}
        </mark>
        {text.slice(idx + debouncedQuery.length)}
      </>
    );
  }

  const fieldLabel: Record<string, string> = {
    description: 'Description',
    notes: 'Notes',
    category: 'Category',
    account: 'Account',
    amount: 'Amount',
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search transactions..."
          className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
        />
        {query && (
          <button
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-1 z-20 bg-white rounded-xl border border-neutral-200 shadow-soft overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-neutral-500">
              No transactions match &ldquo;{debouncedQuery}&rdquo;
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
              {results.map(r => {
                const tx = r.transaction;
                const isNeg = tx.amount < 0;
                return (
                  <li key={tx.id}>
                    <button
                      onClick={() => select(tx)}
                      className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {r.matchField === 'description'
                            ? highlightMatch(tx.description)
                            : tx.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                          <span className="text-xs text-neutral-500">{tx.date}</span>
                          {r.matchField !== 'description' && (
                            <span className="text-xs text-neutral-400">
                              {fieldLabel[r.matchField]}:{' '}
                              {highlightMatch(r.snippet)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          isNeg ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {isNeg ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
