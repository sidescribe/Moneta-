'use client';
import { Plus, Edit, Trash2, Receipt, Calendar, Paperclip } from 'lucide-react';
import { Button } from './ui/Button';
import { formatMoney } from '../lib/formatMoney';
import type { Account, Category, Transaction, TransactionsProps } from '../types';

export default function Transactions({ transactions, accounts, categories, filterType, setFilterType, onAddTransaction, onEditTransaction, onDeleteTransaction }: TransactionsProps) {
  const filtered = filterType === 'all' ? transactions : transactions.filter(t => t.type === filterType);
  const sortedTransactions = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-nowrap touch-pan-x">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`shrink-0 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation ${
              filterType === 'all' ? 'bg-primary-500 text-white shadow-medium' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            All ({transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('personal')}
            className={`shrink-0 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation ${
              filterType === 'personal' ? 'bg-primary-500 text-white shadow-medium' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            Personal ({transactions.filter(t => t.type === 'personal').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('business')}
            className={`shrink-0 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation ${
              filterType === 'business' ? 'bg-primary-500 text-white shadow-medium' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            Business ({transactions.filter(t => t.type === 'business').length})
          </button>
        </div>
        <Button
          icon={Plus}
          onClick={onAddTransaction}
          className="w-full shrink-0 sm:w-auto"
        >
          Add Transaction
        </Button>
      </div>

      <div className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {sortedTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500 mb-4">No transactions yet</p>
            <Button icon={Plus} onClick={onAddTransaction}>
              Add Your First Transaction
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {sortedTransactions.map((tx: Transaction) => {
              const account = accounts.find((a: Account) => a.id === tx.accountId);
              const category = categories.find((c: Category) => c.id === tx.categoryId);
            return (
                <div key={tx.id} className="p-4 sm:p-6 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                  <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${
                          tx.amount >= 0 ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100 break-words">{tx.description}</p>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        tx.type === 'business'
                            ? 'bg-primary-100 text-primary-800'
                            : 'bg-neutral-100 text-neutral-700'
                      }`}>
                        {tx.type}
                      </span>
                        {tx.subscriptionType && (
                          <span className="px-2 py-1 text-xs rounded-full bg-secondary-100 text-secondary-800 font-medium">
                            {tx.subscriptionType}
                          </span>
                        )}
                        {tx.attachmentIds && tx.attachmentIds.length > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700 font-medium"
                            title={`${tx.attachmentIds.length} receipt(s)`}
                          >
                            <Paperclip className="w-3 h-3" />
                            {tx.attachmentIds.length}
                          </span>
                        )}
                        {(tx.kind ?? 'income_expense') === 'transfer' && (
                          <span className="px-2 py-1 text-xs rounded-full bg-violet-100 text-violet-800 font-medium">
                            Transfer
                          </span>
                        )}
                        {tx.recurringId && (
                          <button
                            onClick={() => {
                              try {
                                window.dispatchEvent(new CustomEvent('moneta:openRecurring', { detail: { recurringId: tx.recurringId } }));
                                // also ensure tab switches (App listener will handle it)
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="ml-2 px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800 font-medium"
                            title="Open recurring rule"
                          >
                            Recurring
                          </button>
                        )}
                    </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 shrink-0" />
                          {new Date(tx.date).toLocaleDateString()}
                        </span>
                        <span>{category?.name}</span>
                        <span className="text-neutral-400 dark:text-neutral-600">•</span>
                        <span className="truncate max-w-[12rem] sm:max-w-none">{account?.name}</span>
                      </div>
                    {tx.notes && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 italic break-words">"{tx.notes}"</p>
                    )}
                  </div>
                    <div className="flex flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0 shrink-0">
                    <div className="text-left sm:text-right">
                        <p className={`text-lg sm:text-xl font-bold ${
                        tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatMoney(tx.amount, 'USD', { showSign: true })}
                      </p>
                      {tx.originalCurrency && tx.originalAmount != null && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                          {tx.originalCurrency} {Math.abs(tx.originalAmount).toFixed(2)}
                          {tx.exchangeRate != null ? ` @ ${tx.exchangeRate}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                        onClick={() => onEditTransaction(tx)}
                        title="Edit transaction"
                          className="min-h-11 min-w-11 p-0 sm:min-h-0 sm:min-w-0 sm:w-8 sm:h-8"
                      >
                        <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                        onClick={() => onDeleteTransaction(tx.id)}
                        title="Delete transaction"
                          className="min-h-11 min-w-11 p-0 sm:min-h-0 sm:min-w-0 sm:w-8 sm:h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
