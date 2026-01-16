'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Download, DollarSign, X, Edit, Trash2 } from 'lucide-react';
import PWAInstall from './PWAInstall';
import { Transaction, Account, Category, SaaSMetrics, BusinessMetrics, DashboardProps, TransactionsProps, ReportsProps, TransactionModalProps } from '../types';

// Simple in-memory storage
const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};

// Default categories
const DEFAULT_CATEGORIES = [
  { id: '1', name: 'Owner Contribution', type: 'income', businessRelevant: true },
  { id: '2', name: 'Revenue', type: 'income', businessRelevant: true },
  { id: '3', name: 'Salary', type: 'income', businessRelevant: false },
  { id: '4', name: 'Software/SaaS', type: 'expense', businessRelevant: true },
  { id: '5', name: 'Hosting', type: 'expense', businessRelevant: true },
  { id: '6', name: 'Marketing', type: 'expense', businessRelevant: true },
  { id: '7', name: 'Office Supplies', type: 'expense', businessRelevant: true },
  { id: '8', name: 'Travel', type: 'expense', businessRelevant: true },
  { id: '9', name: 'Meals & Entertainment', type: 'expense', businessRelevant: true },
  { id: '10', name: 'Professional Services', type: 'expense', businessRelevant: true },
  { id: '11', name: 'Taxes & Licenses', type: 'expense', businessRelevant: true },
  { id: '12', name: 'Groceries', type: 'expense', businessRelevant: false },
  { id: '13', name: 'Rent/Mortgage', type: 'expense', businessRelevant: false },
  { id: '14', name: 'Utilities', type: 'expense', businessRelevant: false },
  { id: '15', name: 'Transportation', type: 'expense', businessRelevant: false },
  { id: '16', name: 'Healthcare', type: 'expense', businessRelevant: false },
  { id: '17', name: 'Entertainment', type: 'expense', businessRelevant: false },
];

const DEFAULT_ACCOUNTS = [
  { id: '1', name: 'Personal Checking', type: 'checking', category: 'personal', isActive: true },
  { id: '2', name: 'LLC Checking', type: 'checking', category: 'business', isActive: true },
  { id: '3', name: 'Credit Card', type: 'credit_card', category: 'personal', isActive: true },
];

function App() {
  const [accounts] = useLocalStorage('accounts', DEFAULT_ACCOUNTS) as [Account[], (value: Account[] | ((prev: Account[]) => Account[])) => void];
  const [transactions, setTransactions] = useLocalStorage('transactions', []) as [Transaction[], (value: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void];
  const [categories] = useLocalStorage('categories', DEFAULT_CATEGORIES) as [Category[], (value: Category[] | ((prev: Category[]) => Category[])) => void];
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [view, setView] = useState('dashboard');
  const [filterType, setFilterType] = useState('all');

  const getAccountBalance = (accountId: string) => {
    return transactions
      .filter((t: Transaction) => t.accountId === accountId)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getFilteredTransactions = () => {
    if (filterType === 'all') return transactions;
    return transactions.filter(t => t.type === filterType);
  };

  const getBusinessMetrics = (): BusinessMetrics => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const businessTransactions = transactions.filter((t: Transaction) => {
      const txDate = new Date(t.date);
      return t.type === 'business' && txDate >= startOfMonth;
    });

    const income = businessTransactions
      .filter((t: Transaction) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = businessTransactions
      .filter((t: Transaction) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return { income, expenses, net: income - expenses };
  };

  const getSaaSMetrics = (): SaaSMetrics => {
    const businessTransactions = transactions.filter((t: Transaction) => t.type === 'business');

    // MRR: Monthly Recurring Revenue from recurring income
    const mrr = businessTransactions
      .filter((t: Transaction) => t.amount > 0 && t.subscriptionType === 'recurring')
      .reduce((sum, t) => sum + t.amount, 0);

    // Total Income (all business income)
    const totalIncome = businessTransactions
      .filter((t: Transaction) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    // Fixed Costs (API, Hosting, Software/SaaS categories)
    const fixedCostCategories = ['Software/SaaS', 'Hosting'];
    const fixedCosts = businessTransactions
      .filter((t: Transaction) => t.amount < 0 && fixedCostCategories.some(cat =>
        categories.find((c: Category) => c.id === t.categoryId)?.name === cat
      ))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Tax Reserve: 30% of total income
    const taxReserve = totalIncome * 0.30;

    // Burn Rate: Monthly fixed costs vs monthly revenue
    const monthlyBurnRate = fixedCosts;

    return {
      mrr,
      totalIncome,
      fixedCosts,
      taxReserve,
      monthlyBurnRate,
      burnRateVsRevenue: monthlyBurnRate > 0 ? (monthlyBurnRate / mrr) * 100 : 0
    };
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Account', 'Account Type', 'Description', 'Category', 'Amount', 'Type', 'Notes'];
    const rows = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(t => {
        const account = accounts.find(a => a.id === t.accountId);
        const category = categories.find(c => c.id === t.categoryId);
        return [
          new Date(t.date).toISOString().split('T')[0], // YYYY-MM-DD format
          account?.name || '',
          account?.category || '',
          t.description,
          category?.name || '',
          t.amount.toFixed(2),
          t.type,
          t.notes || ''
        ];
      });

    const csv = [headers, ...rows].map(row =>
      row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `moneta-transactions-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`Exported ${transactions.length} transactions to CSV file.`);
  };

  const exportAllData = () => {
    const data = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        appName: 'Moneta',
        totalTransactions: transactions.length,
        totalAccounts: accounts.length,
        totalCategories: categories.length,
        dateRange: transactions.length > 0 ? {
          earliest: transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0]?.date),
          latest: transactions.reduce((max, t) => t.date > max ? t.date : max, transactions[0]?.date)
        } : null
      },
      accounts: accounts.map(account => ({
        ...account,
        balance: getAccountBalance(account.id)
      })),
      categories,
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `moneta-full-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`Exported complete accounting data (${accounts.length} accounts, ${categories.length} categories, ${transactions.length} transactions) to JSON file.`);
  };

  const addTransaction = (transaction: any) => {
    setTransactions([...transactions, { ...transaction, id: Date.now().toString() }]);
    setShowAddTransaction(false);
  };

  const updateTransaction = (updatedTransaction: any) => {
    setTransactions(transactions.map(t =>
      t.id === updatedTransaction.id ? updatedTransaction : t
    ));
    setEditingTransaction(null);
    setShowAddTransaction(false);
  };

  const deleteTransaction = (transactionId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    const account = accounts.find(a => a.id === transaction.accountId);
    const category = categories.find(c => c.id === transaction.categoryId);

    const message = `Are you sure you want to delete this transaction?\n\n` +
      `Description: ${transaction.description}\n` +
      `Amount: ${transaction.amount >= 0 ? '+' : '-'}$${Math.abs(transaction.amount).toFixed(2)}\n` +
      `Account: ${account?.name || 'Unknown'}\n` +
      `Date: ${new Date(transaction.date).toLocaleDateString()}\n\n` +
      `This action cannot be undone.`;

    if (window.confirm(message)) {
      setTransactions(transactions.filter(t => t.id !== transactionId));
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowAddTransaction(true);
  };

  const handleCloseModal = () => {
    setShowAddTransaction(false);
    setEditingTransaction(null);
  };

  const metrics = getBusinessMetrics();
  const saasMetrics = getSaaSMetrics();
  const personalAccounts = accounts.filter(a => a.category === 'personal' && a.isActive);
  const businessAccounts = accounts.filter(a => a.category === 'business' && a.isActive);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">💰 Moneta</h1>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title={`Export ${transactions.length} transactions to CSV file`}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={exportAllData}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                title="Export complete backup (accounts, categories, transactions)"
              >
                <Download className="w-4 h-4" />
                Backup All Data
              </button>
              <PWAInstall />
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setView('dashboard')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                view === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView('transactions')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                view === 'transactions' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Transactions
            </button>
            <button
              onClick={() => setView('reports')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                view === 'reports' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Reports
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {view === 'dashboard' && (
          <Dashboard
            personalAccounts={personalAccounts}
            businessAccounts={businessAccounts}
            getAccountBalance={getAccountBalance}
            metrics={metrics}
            saasMetrics={saasMetrics}
            onAddTransaction={() => setShowAddTransaction(true)}
          />
        )}

        {view === 'transactions' && (
          <Transactions
            transactions={getFilteredTransactions()}
            accounts={accounts}
            categories={categories}
            filterType={filterType}
            setFilterType={setFilterType}
            onAddTransaction={() => setShowAddTransaction(true)}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={deleteTransaction}
          />
        )}

        {view === 'reports' && (
          <Reports
            transactions={transactions}
            categories={categories}
            metrics={metrics}
          />
        )}
      </div>

      {showAddTransaction && (
        <TransactionModal
          accounts={accounts}
          categories={categories}
          onClose={handleCloseModal}
          onSave={editingTransaction ? updateTransaction : addTransaction}
          transaction={editingTransaction}
        />
      )}

      <button
        onClick={() => setShowAddTransaction(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}

function Dashboard({ personalAccounts, businessAccounts, getAccountBalance, metrics, saasMetrics, onAddTransaction }: DashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Accounts</h2>
          <div className="space-y-3">
            {personalAccounts.map((account: any) => {
              const balance = getAccountBalance(account.id);
              return (
                <div key={account.id} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">{account.name}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${balance.toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Accounts</h2>
          <div className="space-y-3">
            {businessAccounts.map((account: any) => {
              const balance = getAccountBalance(account.id);
              return (
                <div key={account.id} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">{account.name}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${balance.toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">This Month (Business)</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Income</p>
            <p className="text-2xl font-bold text-green-600">${metrics.income.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Expenses</p>
            <p className="text-2xl font-bold text-red-600">${metrics.expenses.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Net</p>
            <p className={`text-2xl font-bold ${metrics.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${metrics.net.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">SaaS Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">MRR</p>
            <p className="text-2xl font-bold text-blue-600">${saasMetrics.mrr.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Monthly Recurring Revenue</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fixed Costs</p>
            <p className="text-2xl font-bold text-red-600">${saasMetrics.fixedCosts.toFixed(2)}</p>
            <p className="text-xs text-gray-500">API + Hosting</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tax Reserve</p>
            <p className="text-2xl font-bold text-yellow-600">${saasMetrics.taxReserve.toFixed(2)}</p>
            <p className="text-xs text-gray-500">30% of income</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Burn Rate</p>
            <p className={`text-2xl font-bold ${saasMetrics.burnRateVsRevenue > 50 ? 'text-red-600' : 'text-green-600'}`}>
              {saasMetrics.burnRateVsRevenue.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500">Costs vs MRR</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Burn Rate Analysis</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Monthly Revenue (MRR)</span>
            <span className="text-sm font-bold text-green-600">${saasMetrics.mrr.toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-green-500 h-4 rounded-full"
              style={{ width: '100%' }}
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Fixed Costs (API + Hosting)</span>
            <span className="text-sm font-bold text-red-600">${saasMetrics.fixedCosts.toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-red-500 h-4 rounded-full"
              style={{
                width: saasMetrics.mrr > 0 ? `${Math.min((saasMetrics.fixedCosts / saasMetrics.mrr) * 100, 100)}%` : '0%'
              }}
            />
          </div>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900">Net Monthly Cash Flow</span>
              <span className={`text-lg font-bold ${(saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${(saasMetrics.mrr - saasMetrics.fixedCosts).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {saasMetrics.burnRateVsRevenue > 100
                ? `⚠️ Burning cash faster than earning (${saasMetrics.burnRateVsRevenue.toFixed(0)}% of revenue)`
                : saasMetrics.burnRateVsRevenue > 50
                ? `⚠️ High burn rate (${saasMetrics.burnRateVsRevenue.toFixed(0)}% of revenue)`
                : `✅ Healthy burn rate (${saasMetrics.burnRateVsRevenue.toFixed(0)}% of revenue)`
              }
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onAddTransaction}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
      >
        Add Transaction
      </button>
    </div>
  );
}

function Transactions({ transactions, accounts, categories, filterType, setFilterType, onAddTransaction, onEditTransaction, onDeleteTransaction }: TransactionsProps) {
  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              filterType === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('personal')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              filterType === 'personal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Personal
          </button>
          <button
            onClick={() => setFilterType('business')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              filterType === 'business' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Business
          </button>
        </div>
        <button
          onClick={onAddTransaction}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {sortedTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No transactions yet. Add your first transaction to get started!
          </div>
        ) : (
          sortedTransactions.map((tx: any) => {
            const account = accounts.find((a: any) => a.id === tx.accountId);
            const category = categories.find((c: any) => c.id === tx.categoryId);
            return (
              <div key={tx.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{tx.description}</p>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        tx.type === 'business'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {tx.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {new Date(tx.date).toLocaleDateString()} • {category?.name} • {account?.name}
                    </p>
                    {tx.notes && (
                      <p className="text-sm text-gray-500 mt-1">{tx.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-4">
                      <p className={`text-lg font-bold ${
                        tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.amount >= 0 ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEditTransaction(tx)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-sm"
                        title="Edit transaction"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:shadow-sm"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Reports({ transactions, categories, metrics }: ReportsProps) {
  const businessExpenses = transactions.filter((t: Transaction) => t.type === 'business' && t.amount < 0);
  const expensesByCategory: Record<string, number> = {};

  businessExpenses.forEach((tx: Transaction) => {
    const category = categories.find((c: Category) => c.id === tx.categoryId);
    const categoryName = category?.name || 'Uncategorized';
    expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + Math.abs(tx.amount);
  });

  const sortedExpenses = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - Business
        </h2>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-200">
            <span className="text-gray-600">Income</span>
            <span className="text-xl font-bold text-green-600">${metrics.income.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200">
            <span className="text-gray-600">Expenses</span>
            <span className="text-xl font-bold text-red-600">-${metrics.expenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-3 pt-4 border-t-2 border-gray-300">
            <span className="font-semibold text-gray-900">Net Profit</span>
            <span className={`text-2xl font-bold ${
              metrics.net >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${metrics.net.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h2>

        {sortedExpenses.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No expenses recorded yet</p>
        ) : (
          <div className="space-y-3">
            {sortedExpenses.map(([category, amount]) => {
              const percentage = (amount / totalExpenses) * 100;
              return (
                <div key={category}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700">{category}</span>
                    <span className="text-sm font-medium text-gray-900">
                      ${amount.toFixed(2)} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
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

function TransactionModal({ accounts, categories, onClose, onSave, transaction }: TransactionModalProps) {
  const isEditing = !!transaction;

  const [accountId, setAccountId] = useState(transaction?.accountId || accounts[0]?.id || '');
  const [date, setDate] = useState(transaction ? new Date(transaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(transaction ? Math.abs(transaction.amount).toString() : '');
  const [isExpense, setIsExpense] = useState(transaction ? transaction.amount < 0 : true);
  const [categoryId, setCategoryId] = useState(transaction?.categoryId || '');
  const [description, setDescription] = useState(transaction?.description || '');
  const [notes, setNotes] = useState(transaction?.notes || '');
  const [subscriptionType, setSubscriptionType] = useState(transaction?.subscriptionType || 'one-time');
  const [businessCategory, setBusinessCategory] = useState(transaction?.businessCategory || '');

  const selectedAccount = accounts.find((a: any) => a.id === accountId);
  const filteredCategories = categories.filter((c: any) =>
    isExpense ? c.type === 'expense' : c.type === 'income'
  );

  const handleSave = () => {
    if (!accountId || !date || !amount || !categoryId || !description) {
      alert('Please fill in all required fields');
      return;
    }

    const transactionData = {
      ...(transaction && { id: transaction.id }),
      accountId,
      date: new Date(date).toISOString(),
      amount: isExpense ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
      categoryId,
      description,
      notes,
      type: (selectedAccount?.category as 'personal' | 'business') || 'personal',
      subscriptionType: !isExpense ? subscriptionType : undefined,
      businessCategory: isExpense && selectedAccount?.category === 'business' ? businessCategory : undefined,
      createdAt: transaction?.createdAt || Date.now(),
    };

    onSave(transactionData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {accounts.map((account: any) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.category})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!isExpense}
                  onChange={() => { setIsExpense(false); setCategoryId(''); }}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Income</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={isExpense}
                  onChange={() => { setIsExpense(true); setCategoryId(''); }}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Expense</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a category</option>
              {filteredCategories.map((category: any) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {!isExpense && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={subscriptionType === 'one-time'}
                    onChange={() => setSubscriptionType('one-time')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">One-time</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={subscriptionType === 'recurring'}
                    onChange={() => setSubscriptionType('recurring')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Recurring</span>
                </label>
              </div>
            </div>
          )}

          {isExpense && selectedAccount?.category === 'business' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Category (for taxes)</label>
              <select
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select business category</option>
                <option value="software">Software & SaaS</option>
                <option value="legal">Legal & Professional Services</option>
                <option value="marketing">Marketing & Advertising</option>
                <option value="travel">Travel & Transportation</option>
                <option value="office">Office & Supplies</option>
                <option value="insurance">Insurance</option>
                <option value="utilities">Utilities & Communications</option>
                <option value="other">Other Business Expenses</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., OpenAI API subscription"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Additional details..."
            />
          </div>

          {selectedAccount?.category === 'business' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                ⚠️ Business transaction - Make sure this is appropriate for your LLC
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isEditing ? 'Update Transaction' : 'Save Transaction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;