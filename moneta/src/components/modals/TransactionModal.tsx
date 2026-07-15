'use client';
import { useState, type ChangeEvent } from 'react';
import { X, Receipt, AlertTriangle, Paperclip } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Account, Business, Category, Transaction, TransactionModalProps } from '../../types';
import { applyRulesToTransaction, findMatchingRule } from '../../lib/categoryRules';
import {
  saveAttachment,
  deleteAttachment,
  getAttachment,
  objectUrlForBlob,
} from '../../lib/attachmentsDb';
import { COMMON_CURRENCIES } from '../../lib/formatMoney';

export default function TransactionModal({
  accounts,
  categories,
  categoryRules,
  onClose,
  onSave,
  transaction,
}: TransactionModalProps) {
  const isEditing = !!transaction;
  const [draftTxId] = useState(
    () => transaction?.id ?? `draft_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
  );
  const activeBusinessId = typeof window !== 'undefined' ? window.localStorage.getItem('moneta:activeBusinessId') : null;
  const businessAccounts = accounts.filter(a => a.category === 'business');
  const defaultAccountId = transaction?.accountId || (activeBusinessId && businessAccounts[0]?.id) || accounts[0]?.id || '';
  const [accountId, setAccountId] = useState(transaction?.accountId || defaultAccountId);
  const [date, setDate] = useState(transaction ? new Date(transaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(transaction ? Math.abs(transaction.amount).toString() : '');
  const [isExpense, setIsExpense] = useState(transaction ? transaction.amount < 0 : true);
  const [categoryId, setCategoryId] = useState(transaction?.categoryId || '');
  const [description, setDescription] = useState(transaction?.description || '');
  const [notes, setNotes] = useState(transaction?.notes || '');
  const [subscriptionType, setSubscriptionType] = useState(transaction?.subscriptionType || 'one-time');
  const [businessCategory, setBusinessCategory] = useState(transaction?.businessCategory || '');
  const [attachmentIds, setAttachmentIds] = useState<string[]>(transaction?.attachmentIds ?? []);
  const [showForeignCurrency, setShowForeignCurrency] = useState(!!transaction?.originalCurrency);
  const [originalCurrency, setOriginalCurrency] = useState(transaction?.originalCurrency || '');
  const [originalAmount, setOriginalAmount] = useState(
    transaction?.originalAmount != null ? Math.abs(transaction.originalAmount).toString() : '',
  );
  const [exchangeRate, setExchangeRate] = useState(
    transaction?.exchangeRate != null ? String(transaction.exchangeRate) : '',
  );

  const selectedAccount = accounts.find((a: Account) => a.id === accountId);
  const filteredCategories = categories.filter((c: Category) =>
    isExpense ? c.type === 'expense' : c.type === 'income'
  );

  const activeBusiness = (() => {
    try {
      const raw = window.localStorage.getItem('moneta:businesses');
      if (!raw) return null;
      const list = JSON.parse(raw) as Business[];
      return list.find(b => b.id === activeBusinessId) || null;
    } catch {
      return null;
    }
  })();

  const updateUsdFromForeign = (orig: string, rate: string) => {
    const o = parseFloat(orig);
    const r = parseFloat(rate);
    if (!isNaN(o) && !isNaN(r) && o > 0 && r > 0) {
      setAmount((o * r).toFixed(2));
    }
  };

  const tryAutoCategory = () => {
    const match = findMatchingRule({ description, notes }, categoryRules);
    if (!match) return;
    const cat = categories.find(c => c.id === match.categoryId);
    if (!cat) return;
    if (isExpense && cat.type === 'expense') setCategoryId(match.categoryId);
    if (!isExpense && cat.type === 'income') setCategoryId(match.categoryId);
  };

  const onPickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const ids: string[] = [];
    for (const f of files) {
      try {
        ids.push(await saveAttachment(draftTxId, f));
      } catch (err) {
        console.error(err);
      }
    }
    setAttachmentIds(prev => [...prev, ...ids]);
    e.target.value = '';
  };

  const removeAttachment = async (id: string) => {
    try {
      await deleteAttachment(id);
    } catch (e) {
      console.error(e);
    }
    setAttachmentIds(prev => prev.filter(x => x !== id));
  };

  const openAttachment = async (id: string) => {
    const rec = await getAttachment(id);
    if (!rec) return;
    const url = objectUrlForBlob(rec.blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  };

  const handleSave = () => {
    if (!accountId || !date || !amount || !categoryId || !description) {
      alert('Please fill in all required fields');
      return;
    }

    const amountNum = isExpense ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));
    const origAmt = originalCurrency && originalAmount ? parseFloat(originalAmount) : undefined;
    const rate = originalCurrency && exchangeRate ? parseFloat(exchangeRate) : undefined;

    const draft: Transaction = {
      id: transaction?.id ?? draftTxId,
      accountId,
      date: new Date(date).toISOString(),
      amount: amountNum,
      categoryId,
      description,
      notes,
      type: (selectedAccount?.category as 'personal' | 'business') || 'personal',
      kind: 'income_expense',
      businessId:
        selectedAccount?.category === 'business' && activeBusinessId ? activeBusinessId : undefined,
      subscriptionType: !isExpense ? subscriptionType : undefined,
      businessCategory: isExpense && selectedAccount?.category === 'business' ? businessCategory : undefined,
      createdAt: transaction?.createdAt || Date.now(),
      attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      ...(originalCurrency
        ? {
            originalCurrency,
            originalAmount: origAmt != null && !isNaN(origAmt) ? origAmt : undefined,
            exchangeRate: rate != null && !isNaN(rate) ? rate : undefined,
          }
        : {}),
    };

    const withRules = applyRulesToTransaction(draft, categoryRules, categories);

    const transactionData = {
      ...(transaction && { id: transaction.id }),
      ...(!transaction && { id: draftTxId }),
      accountId,
      date: withRules.date,
      amount: withRules.amount,
      categoryId: withRules.categoryId,
      description: withRules.description,
      notes: withRules.notes,
      type: withRules.type,
      kind: 'income_expense' as const,
      businessId: withRules.businessId,
      subscriptionType: withRules.subscriptionType,
      businessCategory: withRules.businessCategory,
      createdAt: withRules.createdAt,
      attachmentIds: withRules.attachmentIds,
      ...(originalCurrency
        ? {
            originalCurrency,
            originalAmount: origAmt != null && !isNaN(origAmt) ? origAmt : undefined,
            exchangeRate: rate != null && !isNaN(rate) ? rate : undefined,
          }
        : {}),
    };

    onSave(transactionData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white dark:bg-neutral-950 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 max-h-[94dvh] overflow-y-auto shadow-large border border-neutral-200 dark:border-neutral-800">
        {activeBusiness && (
          <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-md text-sm text-neutral-700 dark:text-neutral-300">
            Active business: <strong>{activeBusiness.name}</strong>
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <Receipt className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900">
            {isEditing ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
        <div className="space-y-4">
            {/* Account Selection */}
          <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Account
              </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
                <option value="">Select an account</option>
                {accounts.map((account: Account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.category})
                </option>
              ))}
            </select>
          </div>

            {/* Date */}
          <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>

            {/* Amount Input with Type Toggle */}
          <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Amount
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-neutral-500 sm:text-sm">$</span>
                </div>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="0.00"
            />
              </div>

              <div className="flex gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => { setIsExpense(false); setCategoryId(''); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    !isExpense
                      ? 'bg-green-100 text-green-800 border-2 border-green-300'
                      : 'bg-white text-neutral-600 border-2 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  💰 Income
                </button>
                <button
                  type="button"
                  onClick={() => { setIsExpense(true); setCategoryId(''); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    isExpense
                      ? 'bg-red-100 text-red-800 border-2 border-red-300'
                      : 'bg-white text-neutral-600 border-2 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  💸 Expense
                </button>
            </div>
          </div>

            {/* Foreign currency (optional, collapsed by default) */}
            <div>
              {!showForeignCurrency ? (
                <button
                  type="button"
                  onClick={() => setShowForeignCurrency(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Add foreign currency
                </button>
              ) : (
                <div className="space-y-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">Foreign currency (optional)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForeignCurrency(false);
                        setOriginalCurrency('');
                        setOriginalAmount('');
                        setExchangeRate('');
                      }}
                      className="text-xs text-neutral-500 hover:text-neutral-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Currency</label>
                      <select
                        value={originalCurrency}
                        onChange={(e) => setOriginalCurrency(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">—</option>
                        {COMMON_CURRENCIES.filter(c => c !== 'USD').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Original amt</label>
                      <input
                        type="number"
                        step="0.01"
                        value={originalAmount}
                        onChange={(e) => {
                          setOriginalAmount(e.target.value);
                          updateUsdFromForeign(e.target.value, exchangeRate);
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Rate</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={exchangeRate}
                        onChange={(e) => {
                          setExchangeRate(e.target.value);
                          updateUsdFromForeign(originalAmount, e.target.value);
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="1.00"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">USD amount = original × rate</p>
                </div>
              )}
            </div>

            {/* Category Selection */}
          <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
              <option value="">Select a category</option>
                {filteredCategories.map((category: Category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

            {/* Subscription Type for Income */}
          {!isExpense && (
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Subscription Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSubscriptionType('one-time')}
                    className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      subscriptionType === 'one-time'
                        ? 'bg-primary-100 text-primary-800 border-2 border-primary-300'
                        : 'bg-white text-neutral-600 border-2 border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    📅 One-time
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubscriptionType('recurring')}
                    className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      subscriptionType === 'recurring'
                        ? 'bg-secondary-100 text-secondary-800 border-2 border-secondary-300'
                        : 'bg-white text-neutral-600 border-2 border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    🔄 Recurring
                  </button>
              </div>
            </div>
          )}

            {/* Business Category for Business Expenses */}
          {isExpense && selectedAccount?.category === 'business' && (
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">🏢 Business Category (for taxes)</label>
              <select
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">Select business category</option>
                  <option value="software">💻 Software & SaaS</option>
                  <option value="legal">⚖️ Legal & Professional Services</option>
                  <option value="marketing">📢 Marketing & Advertising</option>
                  <option value="travel">✈️ Travel & Transportation</option>
                  <option value="office">🏢 Office & Supplies</option>
                  <option value="insurance">🛡️ Insurance</option>
                  <option value="utilities">⚡ Utilities & Communications</option>
                  <option value="other">📋 Other Business Expenses</option>
              </select>
            </div>
          )}

            {/* Description */}
          <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={tryAutoCategory}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="e.g., OpenAI API subscription"
            />
            <p className="text-xs text-neutral-500 mt-1">Rules on the Rules tab can set category from this text when you leave the field.</p>
          </div>

            {/* Notes */}
          <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={tryAutoCategory}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
              placeholder="Additional details..."
            />
            </div>

            {/* Receipts — IndexedDB in this browser only */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Receipts (stored locally)
              </label>
              <input type="file" multiple accept="image/*,.pdf,application/pdf" onChange={onPickFiles} className="block w-full text-sm text-neutral-600" />
              {attachmentIds.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {attachmentIds.map(id => (
                    <li key={id} className="flex items-center justify-between gap-2 bg-neutral-50 rounded px-2 py-1">
                      <span className="text-xs text-neutral-600 truncate" title={id}>
                        Receipt
                      </span>
                      <span className="flex gap-2 shrink-0">
                        <button type="button" onClick={() => openAttachment(id)} className="text-blue-600 text-xs hover:underline">
                          Open
                        </button>
                        <button type="button" onClick={() => removeAttachment(id)} className="text-red-600 text-xs hover:underline">
                          Remove
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Business Warning */}
          {selectedAccount?.category === 'business' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Business Transaction</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Make sure this transaction is appropriate for your LLC and properly categorized for tax purposes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              loading={false}
            >
              {isEditing ? 'Update Transaction' : 'Save Transaction'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
