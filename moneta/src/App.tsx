'use client';
import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Plus, Download, DollarSign, X, Edit, Trash2, TrendingUp, Flame, Shield, Wallet, Building, CreditCard, Building2, BarChart3, Receipt, PieChart, Calendar, ArrowUp, ArrowDown, AlertTriangle, TrendingDown, Sun, Moon, ArrowLeftRight, BookOpen, Upload, Wand2, Paperclip, Menu } from 'lucide-react';
import RecurringList from './components/recurring/RecurringList';
import RulesList from './components/rules/RulesList';
import PWAInstall from './PWAInstall';
import { Button } from './components/ui/Button';
import BusinessSwitcher from './components/business/BusinessSwitcher';
import { createPersistence } from './lib/persistence';
import type { Transaction, Account, Category, CategoryRule, SaaSMetrics, BusinessMetrics, DashboardProps, TransactionsProps, ReportsProps, TransactionModalProps, MonthlyStatement, AnnualStatement, JournalEntry } from './types';
import {
  filterJournalByBusiness,
  journalFromTransaction,
  ledgerBalanceForRegister,
  replaceJournalForTransaction,
  removeJournalForTransaction,
  buildTrialBalance,
  buildBalanceSheet,
  upsertOpeningJournal,
} from './lib/journal';
import { migrateLedgerIfNeeded } from './lib/migrateLedger';
import {
  parseBackupJson,
  normalizeBackup,
  mergeIntoLocal,
  finalizeImportedLedger,
} from './lib/backupImport';
import { applyRulesToTransaction, findMatchingRule } from './lib/categoryRules';
import {
  clearAllAttachments,
  deleteAttachmentsForTransaction,
  saveAttachment,
  deleteAttachment,
  getAttachment,
  objectUrlForBlob,
} from './lib/attachmentsDb';

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
  { id: '1', name: 'Personal Checking', type: 'checking', category: 'personal', isActive: true, ledgerType: 'asset' as const },
  { id: '2', name: 'LLC Checking', type: 'checking', category: 'business', isActive: true, ledgerType: 'asset' as const },
  { id: '3', name: 'Credit Card', type: 'credit_card', category: 'personal', isActive: true, ledgerType: 'liability' as const },
];

function App() {
  const [accounts, setAccounts] = useLocalStorage('accounts', DEFAULT_ACCOUNTS) as [Account[], (value: Account[] | ((prev: Account[]) => Account[])) => void];
  const [transactions, setTransactions] = useLocalStorage('transactions', []) as [Transaction[], (value: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void];
  const [categories, setCategories] = useLocalStorage('categories', DEFAULT_CATEGORIES) as [Category[], (value: Category[] | ((prev: Category[]) => Category[])) => void];
  const [categoryRules, setCategoryRules] = useLocalStorage('moneta:categoryRules', [] as CategoryRule[]) as [
    CategoryRule[],
    (value: CategoryRule[] | ((prev: CategoryRule[]) => CategoryRule[])) => void,
  ];
  const [journalEntries, setJournalEntries] = useLocalStorage('journalEntries', [] as JournalEntry[]) as [
    JournalEntry[],
    (value: JournalEntry[] | ((prev: JournalEntry[]) => JournalEntry[])) => void,
  ];
  const [schemaVersion, setSchemaVersion] = useLocalStorage('moneta:schemaVersion', 0) as [
    number,
    (value: number | ((prev: number) => number)) => void,
  ];
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [openingBalanceAccount, setOpeningBalanceAccount] = useState<Account | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [txModalNonce, setTxModalNonce] = useState(0);
  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);
  const [view, setView] = useState('dashboard');
  const [filterType, setFilterType] = useState('all');

  // New state for monthly/annual statements
  const [monthlyStatements, setMonthlyStatements] = useLocalStorage('monthlyStatements', []) as [MonthlyStatement[], (value: MonthlyStatement[] | ((prev: MonthlyStatement[]) => MonthlyStatement[])) => void];
  const [currentMonthView, setCurrentMonthView] = useState('current'); // 'current' | 'archived'

  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem('moneta:activeBusinessId');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handler = (e: any) => {
      const id = e?.detail?.businessId ?? window.localStorage.getItem('moneta:activeBusinessId');
      setActiveBusinessId(id);
    };
    window.addEventListener('moneta:businessSwitched', handler as EventListener);
    const openRecurring = (e: any) => {
      const id = e?.detail?.recurringId;
      if (id) setView('recurring');
    };
    window.addEventListener('moneta:openRecurring', openRecurring as EventListener);
    return () => {
      window.removeEventListener('moneta:businessSwitched', handler as EventListener);
      window.removeEventListener('moneta:openRecurring', openRecurring as EventListener);
    };
  }, []);

  const ledgerBootstrap = useRef(false);
  useEffect(() => {
    if (ledgerBootstrap.current) return;
    ledgerBootstrap.current = true;
    const sv = typeof schemaVersion === 'number' ? schemaVersion : 0;
    const { accounts: nextAcc, journalEntries: nextJe, nextSchemaVersion } = migrateLedgerIfNeeded({
      schemaVersion: sv,
      transactions,
      accounts,
      categories,
      journalEntries,
    });
    setAccounts(nextAcc);
    setJournalEntries(nextJe);
    if (nextSchemaVersion !== sv) setSchemaVersion(nextSchemaVersion);
  }, []);

  // Persistence instance (local by default)
  const persistence = createPersistence();

  // Scheduler: generate due recurring transactions for a business
  const runDueRecurringsForBusiness = async (businessId: string | null) => {
    if (!businessId) return;
    try {
      const recurrings = await persistence.getRecurrings(businessId);
      const now = Date.now();
      const generated: Transaction[] = [];

      const addInterval = (ts: number, r: any) => {
        const d = new Date(ts);
        switch (r.frequency) {
          case 'daily': d.setDate(d.getDate() + (r.intervalDays || 1)); break;
          case 'weekly': d.setDate(d.getDate() + 7); break;
          case 'monthly': d.setMonth(d.getMonth() + 1); break;
          case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
          default: d.setDate(d.getDate() + (r.intervalDays || 30)); break;
        }
        return d.getTime();
      };

      for (const r of recurrings) {
        if (!r.active) continue;
        // Determine next run timestamp
        let next = r.nextRunAt ?? Date.parse(r.startDate);
        if (isNaN(next)) next = Date.now();

        // If there's an endDate and next is past it, skip
        if (r.endDate && Date.parse(r.endDate) < next) continue;

        // Generate one or more runs up to now
        while (next <= now) {
          const runDate = new Date(next);
          // Respect endDate
          if (r.endDate && next > Date.parse(r.endDate)) {
            r.active = false;
            break;
          }

          // Create transaction for this recurrence
          const tx: Transaction = {
            id: `rec-${r.id}-${next}`,
            accountId: r.accountId,
            date: runDate.toISOString().split('T')[0],
            amount: r.isExpense ? -Math.abs(r.amount) : Math.abs(r.amount),
            categoryId: r.categoryId,
            description: r.description || `${r.isExpense ? 'Expense' : 'Income'} - ${r.description || ''}`.trim(),
            type: 'business',
            kind: 'income_expense',
            subscriptionType: 'recurring',
            createdAt: Date.now(),
            businessId: businessId ?? undefined,
            recurringId: r.id
          };

          generated.push(tx);

          // advance
          r.lastRunAt = next;
          next = addInterval(next, r);
          r.nextRunAt = next;
        }

        // Save updated recurring rule
        await persistence.updateRecurring(businessId, r);
      }

      if (generated.length > 0) {
        setTransactions(prev => [...prev, ...generated]);
        setJournalEntries(prev => {
          let next = prev;
          for (const tx of generated) {
            next = replaceJournalForTransaction(next, tx, accounts, categories);
          }
          return next;
        });
      }
    } catch (e) {
      console.error('Failed running recurrings for', businessId, e);
    }
  };

  // Run scheduler when active business changes or on mount
  useEffect(() => {
    runDueRecurringsForBusiness(activeBusinessId);
  }, [activeBusinessId]);

  const matchesActiveBusiness = (t: Transaction) => {
    const active = activeBusinessId;
    if (!active) return !t.businessId;
    return t.businessId === active;
  };

  const filteredTransactions = transactions.filter(matchesActiveBusiness);

  const filteredMonthlyStatements = monthlyStatements.filter(s => {
    const active = activeBusinessId;
    if (!active) return !s.businessId;
    return s.businessId === active;
  });

  const journalForBusiness = filterJournalByBusiness(journalEntries, activeBusinessId);

  const getAccountBalance = (accountId: string) => {
    const acct = accounts.find(a => a.id === accountId);
    if (!acct) return 0;
    return ledgerBalanceForRegister(accountId, acct, journalForBusiness);
  };

  const getBusinessMetrics = (): BusinessMetrics => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const businessTransactions = filteredTransactions.filter((t: Transaction) => {
      const txDate = new Date(t.date);
      const kind = t.kind ?? 'income_expense';
      return t.type === 'business' && kind !== 'transfer' && txDate >= startOfMonth;
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
    const businessTransactions = filteredTransactions.filter((t: Transaction) => {
      const kind = t.kind ?? 'income_expense';
      return t.type === 'business' && kind !== 'transfer';
    });

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

  // Function to get current month's transactions
  const getCurrentMonthTransactions = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return filteredTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });
  };

  // Function to archive completed months
  const archiveCompletedMonth = (year: number, month: number) => {
    const monthTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      const matchesMonth = txDate.getMonth() === month && txDate.getFullYear() === year;
      const active = activeBusinessId;
      const matchesBusiness = active ? tx.businessId === active : !tx.businessId;
      return matchesMonth && matchesBusiness;
    });

    if (monthTransactions.length === 0) return;

    const summary = {
      totalIncome: monthTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0),
      totalExpenses: monthTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
      netAmount: monthTransactions.reduce((sum, tx) => sum + tx.amount, 0),
      transactionCount: monthTransactions.length
    };

    const statement: MonthlyStatement = {
      id: `${year}-${month}`,
      year,
      month,
      monthName: new Date(year, month).toLocaleDateString('en-US', { month: 'long' }),
      businessId: activeBusinessId ?? undefined,
      transactions: [...monthTransactions],
      summary,
      archivedAt: Date.now()
    };

    setMonthlyStatements(prev => [...prev, statement]);

    // Remove archived transactions from active list (only those for this business/month)
    setTransactions(prev => prev.filter(tx => {
      const txDate = new Date(tx.date);
      const isSameMonth = txDate.getMonth() === month && txDate.getFullYear() === year;
      const active = activeBusinessId;
      const matchesBusiness = active ? tx.businessId === active : !tx.businessId;
      return !(isSameMonth && matchesBusiness);
    }));
  };

  const unarchiveMonth = (statementId: string) => {
    const stmt = monthlyStatements.find(s => s.id === statementId);
    if (!stmt) return;
    const active = activeBusinessId;
    if ((active && stmt.businessId !== active) || (!active && stmt.businessId)) return;
    // restore transactions
    setTransactions(prev => [...prev, ...stmt.transactions]);
    setMonthlyStatements(prev => prev.filter(s => s.id !== statementId));
  };

  // Function to get annual statements
  const getAnnualStatements = (): AnnualStatement[] => {
    const active = activeBusinessId;
    const filtered = monthlyStatements.filter(s => {
      if (!active) return !s.businessId;
      return s.businessId === active;
    });

    const yearGroups = filtered.reduce((groups, statement) => {
      if (!groups[statement.year]) {
        groups[statement.year] = [];
      }
      groups[statement.year].push(statement);
      return groups;
    }, {} as Record<number, MonthlyStatement[]>);

    return Object.entries(yearGroups).map(([year, statements]) => ({
      year: parseInt(year),
      monthlyStatements: statements.sort((a, b) => b.month - a.month),
      annualSummary: {
        totalIncome: statements.reduce((sum, s) => sum + s.summary.totalIncome, 0),
        totalExpenses: statements.reduce((sum, s) => sum + s.summary.totalExpenses, 0),
        netAmount: statements.reduce((sum, s) => sum + s.summary.netAmount, 0),
        totalTransactions: statements.reduce((sum, s) => sum + s.summary.transactionCount, 0)
      }
    })).sort((a, b) => b.year - a.year);
  };

  // Function to generate sample transactions for testing (temporary)
  const generateSampleTransactions = () => {
    const now = new Date();
    const sampleTransactions: Transaction[] = [];

    // Generate transactions for the last 3 months
    for (let i = 1; i <= 3; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 15);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      // Add some sample transactions for this month
      const samples = [
        { description: 'Client Payment', amount: 2500, categoryId: '2', accountId: '2', type: 'business' as const },
        { description: 'Software Subscription', amount: -99, categoryId: '4', accountId: '2', type: 'business' as const },
        { description: 'Office Supplies', amount: -150, categoryId: '7', accountId: '3', type: 'business' as const },
        { description: 'Grocery Shopping', amount: -200, categoryId: '12', accountId: '3', type: 'personal' as const },
        { description: 'Freelance Income', amount: 800, categoryId: '2', accountId: '2', type: 'business' as const },
        { description: 'Coffee Shop', amount: -25, categoryId: '9', accountId: '3', type: 'business' as const },
      ];

      samples.forEach((sample, index) => {
        const transactionDate = new Date(year, month, Math.floor(Math.random() * 28) + 1);
        sampleTransactions.push({
          id: `sample-${year}-${month}-${index}`,
          accountId: sample.accountId,
          date: transactionDate.toISOString().split('T')[0],
          amount: sample.amount,
          categoryId: sample.categoryId,
          description: sample.description,
          type: sample.type,
          kind: 'income_expense',
          subscriptionType: sample.amount > 0 ? 'one-time' : undefined,
          createdAt: Date.now(),
          businessId: activeBusinessId ?? undefined
        });
      });
    }

    setTransactions(prev => [...prev, ...sampleTransactions]);
    setJournalEntries(prev => {
      let next = prev;
      for (const tx of sampleTransactions) {
        next = replaceJournalForTransaction(next, tx, accounts, categories);
      }
      return next;
    });
  };

  // Function to check for completed months to archive
  const checkForArchivableMonths = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Archive months that are at least 1 month old
    for (let year = currentYear; year >= currentYear - 2; year--) { // Check last 2 years
      const startMonth = year === currentYear ? 0 : 0; // Jan for past years
      const endMonth = year === currentYear ? currentMonth - 1 : 11; // Last month for past years

      for (let month = endMonth; month >= startMonth; month--) {
        const existingStatement = monthlyStatements.find(s => s.year === year && s.month === month && (activeBusinessId ? s.businessId === activeBusinessId : !s.businessId));
        if (!existingStatement) {
          const monthTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date);
            const matchesMonth = txDate.getMonth() === month && txDate.getFullYear() === year;
            const active = activeBusinessId;
            const matchesBusiness = active ? tx.businessId === active : !tx.businessId;
            return matchesMonth && matchesBusiness;
          });

          if (monthTransactions.length > 0) {
            archiveCompletedMonth(year, month);
          }
        }
      }
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Account', 'Account Type', 'Description', 'Category', 'Amount', 'Type', 'Notes'];
    const rows = filteredTransactions
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

    alert(`Exported ${rows.length} transactions to CSV file.`);
  };

  const exportAllData = () => {
    const data = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.2',
        appName: 'Moneta',
        schemaVersion,
        totalTransactions: transactions.length,
        totalJournalEntries: journalEntries.length,
        totalAccounts: accounts.length,
        totalCategories: categories.length,
        totalArchivedMonths: monthlyStatements.length,
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
      categoryRules,
      journalEntries,
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      monthlyStatements,
      monthlyStatementsForActive: filteredMonthlyStatements
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

  const runImport = (mode: 'replace' | 'merge', jsonText: string) => {
    const raw = parseBackupJson(jsonText);
    if (!raw) {
      alert('Could not parse JSON.');
      return;
    }
    const normalized = normalizeBackup(raw);
    if (!normalized) {
      alert('This file does not look like a Moneta backup.');
      return;
    }
    if (mode === 'replace') {
      void clearAllAttachments();
    }
    const merged =
      mode === 'replace'
        ? normalized
        : mergeIntoLocal(
            {
              accounts,
              categories,
              transactions,
              journalEntries,
              monthlyStatements,
              categoryRules,
            },
            normalized,
          );
    const finalJe = finalizeImportedLedger(
      merged.transactions,
      merged.accounts,
      merged.categories,
      merged.journalEntries,
    );
    setAccounts(merged.accounts);
    setCategories(merged.categories);
    setTransactions(merged.transactions);
    setJournalEntries(finalJe);
    setMonthlyStatements(merged.monthlyStatements);
    setCategoryRules(merged.categoryRules);
    setSchemaVersion(merged.schemaVersion);
  };

  const runApplyRulesToExisting = () => {
    if (!window.confirm('Apply rules to all income/expense transactions where text matches? Transfers are unchanged.')) {
      return;
    }
    setTransactions(prev => {
      const next = prev.map(tx => applyRulesToTransaction(tx, categoryRules, categories));
      setJournalEntries(jePrev => {
        let j = jePrev;
        for (const tx of next) {
          j = replaceJournalForTransaction(j, tx, accounts, categories);
        }
        return j;
      });
      return next;
    });
  };

  const recordNewTransaction = (tx: Transaction) => {
    setTransactions(prev => [...prev, tx]);
    setJournalEntries(prev => {
      const je = journalFromTransaction(tx, accounts, categories);
      if (!je) return prev;
      return [...prev.filter(e => e.sourceTransactionId !== tx.id), je];
    });
  };

  const addTransaction = (transaction: any) => {
    const id = transaction.id ?? Date.now().toString();
    const tx: Transaction = {
      ...transaction,
      id,
      businessId: transaction.businessId,
      kind: transaction.kind ?? 'income_expense',
    };
    recordNewTransaction(tx);
    setShowAddTransaction(false);
  };

  const updateTransaction = (updatedTransaction: any) => {
    const tx = {
      ...updatedTransaction,
      kind: updatedTransaction.kind ?? 'income_expense',
    } as Transaction;
    setTransactions(prev => prev.map(t => (t.id === tx.id ? tx : t)));
    setJournalEntries(prev => replaceJournalForTransaction(prev, tx, accounts, categories));
    setEditingTransaction(null);
    setShowAddTransaction(false);
  };

  const deleteTransaction = (transactionId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    const account = accounts.find(a => a.id === transaction.accountId);

    const message = `Are you sure you want to delete this transaction?\n\n` +
      `Description: ${transaction.description}\n` +
      `Amount: ${transaction.amount >= 0 ? '+' : '-'}$${Math.abs(transaction.amount).toFixed(2)}\n` +
      `Account: ${account?.name || 'Unknown'}\n` +
      `Date: ${new Date(transaction.date).toLocaleDateString()}\n\n` +
      `This action cannot be undone.`;

    if (window.confirm(message)) {
      void deleteAttachmentsForTransaction(transactionId);
      setTransactions(transactions.filter(t => t.id !== transactionId));
      setJournalEntries(prev => removeJournalForTransaction(prev, transactionId));
    }
  };

  const openNewTransaction = () => {
    setEditingTransaction(null);
    setTxModalNonce(n => n + 1);
    setShowAddTransaction(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowAddTransaction(true);
  };

  const handleCloseModal = () => {
    setShowAddTransaction(false);
    setEditingTransaction(null);
  };

  // Auto-archive completed months on component mount
  useEffect(() => {
    checkForArchivableMonths();
  }, []);

  const metrics = getBusinessMetrics();
  const saasMetrics = getSaaSMetrics();
  const personalAccounts = accounts.filter(a => a.category === 'personal' && a.isActive);
  const businessAccounts = accounts.filter(a => a.category === 'business' && a.isActive);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return window.localStorage.getItem('moneta:darkMode') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { window.localStorage.setItem('moneta:darkMode', darkMode ? 'true' : 'false'); } catch {}
  }, [darkMode]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const headerActions = (
    <>
      <Button
        variant="ghost"
        size="sm"
        effect="magnetic"
        icon={darkMode ? Sun : Moon}
        onClick={() => setDarkMode(d => !d)}
        title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
        className="max-lg:min-h-11 max-lg:min-w-11 max-lg:px-3"
      >
        <span className="hidden lg:inline">{darkMode ? 'Light' : 'Dark'}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        effect="magnetic"
        icon={ArrowLeftRight}
        onClick={() => { setShowTransferModal(true); setMobileHeaderMenuOpen(false); }}
        title="Move money between registers (double-entry)"
        className="max-lg:w-full max-lg:justify-start"
      >
        Transfer
      </Button>
      <Button
        variant="outline"
        size="sm"
        effect="magnetic"
        icon={Calendar}
        onClick={() => { runDueRecurringsForBusiness(activeBusinessId); setMobileHeaderMenuOpen(false); }}
        title="Run scheduled recurring transactions now"
        className="max-lg:w-full max-lg:justify-start"
      >
        <span className="lg:hidden">Run scheduled</span>
        <span className="hidden lg:inline">Run Scheduled</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        effect="magnetic"
        icon={Download}
        onClick={() => { exportToCSV(); setMobileHeaderMenuOpen(false); }}
        title={`Export ${transactions.length} transactions to CSV file`}
        className="max-lg:w-full max-lg:justify-start"
      >
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        effect="magnetic"
        icon={Upload}
        onClick={() => { setShowImportModal(true); setMobileHeaderMenuOpen(false); }}
        title="Import Moneta JSON backup"
        className="max-lg:w-full max-lg:justify-start"
      >
        Import
      </Button>
      <Button
        variant="outline"
        size="sm"
        effect="magnetic"
        icon={Download}
        onClick={() => { exportAllData(); setMobileHeaderMenuOpen(false); }}
        title="Export complete backup"
        className="max-lg:w-full max-lg:justify-start"
      >
        <span className="lg:hidden">Backup</span>
        <span className="hidden lg:inline">Backup Data</span>
      </Button>
      <div className="animate-pulse max-lg:w-full flex justify-start lg:inline-flex">
        <PWAInstall />
      </div>
    </>
  );

  return (
    <div className={`min-h-screen min-h-dvh ${darkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-neutral-50 text-neutral-900'}`}>
      {/* Modern Navigation Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-soft safe-top">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-2 py-3 md:py-4">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 truncate">Moneta</h1>
            </div>

            <div className="hidden lg:flex flex-wrap items-center gap-2 justify-end flex-1 min-w-0">
              <BusinessSwitcher />
              {headerActions}
            </div>

            <div className="flex lg:hidden items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                effect="magnetic"
                icon={darkMode ? Sun : Moon}
                onClick={() => setDarkMode(d => !d)}
                title={darkMode ? 'Light theme' : 'Dark theme'}
                className="min-h-11 min-w-11 px-0"
              >
                <span className="sr-only">{darkMode ? 'Light' : 'Dark'}</span>
              </Button>
              <button
                type="button"
                onClick={() => setMobileHeaderMenuOpen(o => !o)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 touch-manipulation"
                aria-expanded={mobileHeaderMenuOpen}
                aria-label={mobileHeaderMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileHeaderMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {mobileHeaderMenuOpen && (
            <div className="lg:hidden border-t border-neutral-200 py-3 space-y-3 animate-fade-in">
              <div className="flex flex-col gap-2">{headerActions}</div>
            </div>
          )}

          <div className="lg:hidden border-t border-neutral-200 py-3 -mx-3 sm:-mx-4 px-3 sm:px-4">
            <BusinessSwitcher />
          </div>

          <div className="-mx-3 sm:-mx-4 px-3 sm:px-4 pb-3 overflow-x-auto flex gap-2 flex-nowrap touch-pan-x">
            {[
              { id: 'dashboard', label: 'Dashboard', short: 'Home', icon: BarChart3, count: null },
              { id: 'transactions', label: 'Transactions', short: 'Txns', icon: Receipt, count: filteredTransactions.length },
              { id: 'recurring', label: 'Recurring', short: 'Repeat', icon: Calendar, count: filteredMonthlyStatements.length },
              { id: 'rules', label: 'Rules', short: 'Rules', icon: Wand2, count: categoryRules.length },
              { id: 'reports', label: 'Reports', short: 'Reports', icon: PieChart, count: null }
            ].map(({ id, label, short, icon: TabIcon, count }) => (
            <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`flex shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 touch-manipulation whitespace-nowrap ${
                  view === id
                    ? 'bg-blue-500 text-white shadow-md hover-lift'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 hover-lift'
                }`}
              >
                <TabIcon className="w-4 h-4 shrink-0" />
                <span className="max-sm:hidden">{label}</span>
                <span className="sm:hidden">{short}</span>
                {count !== null && (
                  <span className={`ml-0.5 px-1.5 sm:px-2 py-0.5 rounded-full text-xs ${
                    view === id
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-200 text-neutral-700'
                  }`}>
                    {count}
                  </span>
                )}
            </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8 safe-bottom">
        {view === 'dashboard' && (
          <Dashboard
            personalAccounts={personalAccounts}
            businessAccounts={businessAccounts}
            getAccountBalance={getAccountBalance}
            metrics={metrics}
            saasMetrics={saasMetrics}
            onAddTransaction={openNewTransaction}
            onEditOpeningBalance={setOpeningBalanceAccount}
          />
        )}

        {view === 'transactions' && (
          <div className="space-y-6">
            {/* Month/Year Navigation */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-1 sm:min-w-0">
                <button
                  type="button"
                  onClick={() => setCurrentMonthView('current')}
                  className={`shrink-0 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation ${
                    currentMonthView === 'current' ? 'bg-primary-500 text-white shadow-medium' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  <span className="sm:hidden">This month</span>
                  <span className="hidden sm:inline">Current Month ({getCurrentMonthTransactions().length})</span>
                  <span className="sm:hidden"> ({getCurrentMonthTransactions().length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonthView('archived')}
                  className={`shrink-0 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation ${
                    currentMonthView === 'archived' ? 'bg-primary-500 text-white shadow-medium' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  <span className="max-sm:hidden">Archived ({filteredMonthlyStatements.length} months)</span>
                  <span className="sm:hidden">Archive ({filteredMonthlyStatements.length})</span>
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    const now = new Date();
                    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
                    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
                    archiveCompletedMonth(prevYear, prevMonth);
                  }}
                >
                  <span className="max-sm:hidden">Archive Last Month</span>
                  <span className="sm:hidden">Archive month</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateSampleTransactions}
                  className="text-orange-600 hover:text-orange-700 shrink-0"
                >
                  <span className="max-sm:hidden">Generate Sample Data</span>
                  <span className="sm:hidden">Sample data</span>
                </Button>
              </div>
              <Button icon={Plus} onClick={openNewTransaction} className="w-full shrink-0 sm:w-auto">
                Add Transaction
              </Button>
            </div>

            {/* Current Month View */}
            {currentMonthView === 'current' && (
              <div className="space-y-4">
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-primary-900 mb-2">
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 text-sm">
                    <div>
                      <p className="text-primary-600">Income</p>
                      <p className="font-bold text-green-600">
                        +${getCurrentMonthTransactions().filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-primary-600">Expenses</p>
                      <p className="font-bold text-red-600">
                        -${getCurrentMonthTransactions().filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-primary-600">Net</p>
                      <p className={`font-bold ${getCurrentMonthTransactions().reduce((sum, tx) => sum + tx.amount, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${getCurrentMonthTransactions().reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

          <Transactions
                  transactions={getCurrentMonthTransactions()}
            accounts={accounts}
            categories={categories}
            filterType={filterType}
            setFilterType={setFilterType}
            onAddTransaction={openNewTransaction}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={deleteTransaction}
          />
              </div>
            )}

            {/* Archived Months View */}
            {currentMonthView === 'archived' && (
              <div className="space-y-6">
                {getAnnualStatements().map(annual => (
                  <div key={annual.year} className="space-y-4">
                    <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-6">
                      <h3 className="text-xl font-bold text-neutral-900 mb-4">{annual.year} Annual Summary</h3>
                      <div className="grid grid-cols-4 gap-6">
                        <div className="bg-white rounded-lg p-4 shadow-soft">
                          <p className="text-neutral-600 text-sm">Total Income</p>
                          <p className="text-2xl font-bold text-green-600">
                            ${annual.annualSummary.totalIncome.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-soft">
                          <p className="text-neutral-600 text-sm">Total Expenses</p>
                          <p className="text-2xl font-bold text-red-600">
                            -${annual.annualSummary.totalExpenses.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-soft">
                          <p className="text-neutral-600 text-sm">Net Amount</p>
                          <p className={`text-2xl font-bold ${annual.annualSummary.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${annual.annualSummary.netAmount.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-soft">
                          <p className="text-neutral-600 text-sm">Transactions</p>
                          <p className="text-2xl font-bold text-neutral-900">
                            {annual.annualSummary.totalTransactions}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {annual.monthlyStatements.map(statement => (
                        <div key={statement.id} className="bg-white border border-neutral-200 rounded-xl shadow-soft overflow-hidden">
                          <div className="p-6 border-b border-neutral-200">
                            <div className="flex justify-between items-center">
                              <h4 className="text-lg font-semibold text-neutral-900">
                                {statement.monthName} {statement.year}
                              </h4>
                              <div className="flex gap-4 text-sm">
                                <span className="text-green-600 font-medium">
                                  +${statement.summary.totalIncome.toFixed(2)}
                                </span>
                                <span className="text-red-600 font-medium">
                                  -${statement.summary.totalExpenses.toFixed(2)}
                                </span>
                                <span className={`font-bold ${statement.summary.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ${statement.summary.netAmount.toFixed(2)}
                                </span>
                                <span className="text-neutral-500">
                                  {statement.summary.transactionCount} transactions
                                </span>
                                <button onClick={() => unarchiveMonth(statement.id)} className="text-sm text-primary-600 hover:text-primary-700 ml-2">
                                  Unarchive
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="divide-y divide-neutral-200">
                            {statement.transactions.slice(0, 5).map(tx => {
                              const account = accounts.find(a => a.id === tx.accountId);
                              const category = categories.find(c => c.id === tx.categoryId);
                              return (
                                <div key={tx.id} className="p-4 hover:bg-neutral-50 transition-colors">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${tx.amount >= 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                                      <div>
                                        <p className="font-medium text-neutral-900">{tx.description}</p>
                                        <p className="text-sm text-neutral-500">
                                          {category?.name} • {account?.name} • {new Date(tx.date).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                    <p className={`font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {tx.amount >= 0 ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                            {statement.transactions.length > 5 && (
                              <div className="p-4 text-center">
                                <button className="text-primary-600 hover:text-primary-700 font-medium">
                                  View all {statement.transactions.length} transactions
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'recurring' && (
          <div className="space-y-6">
            <RecurringList businessId={activeBusinessId} accounts={accounts} categories={categories} />
          </div>
        )}

        {view === 'rules' && (
          <RulesList
            rules={categoryRules}
            categories={categories}
            onChange={setCategoryRules}
            onApplyToExisting={runApplyRulesToExisting}
          />
        )}

        {view === 'reports' && (
          <Reports
            transactions={filteredTransactions}
            categories={categories}
            metrics={metrics}
            accounts={accounts}
            journalEntries={journalForBusiness}
          />
        )}
      </div>

      {showAddTransaction && (
        <TransactionModal
          key={editingTransaction ? editingTransaction.id : `new-${txModalNonce}`}
          accounts={accounts}
          categories={categories}
          categoryRules={categoryRules}
          onClose={handleCloseModal}
          onSave={editingTransaction ? updateTransaction : addTransaction}
          transaction={editingTransaction}
        />
      )}

      {showImportModal && (
        <ImportBackupModal
          onClose={() => setShowImportModal(false)}
          onImport={(mode, text) => {
            runImport(mode, text);
            setShowImportModal(false);
          }}
        />
      )}

      {showTransferModal && (
        <TransferModal
          accounts={accounts}
          activeBusinessId={activeBusinessId}
          onClose={() => setShowTransferModal(false)}
          onSave={(draft) => {
            const id = Date.now().toString();
            const tx: Transaction = {
              ...draft,
              id,
              createdAt: Date.now(),
              kind: 'transfer',
            };
            recordNewTransaction(tx);
            setShowTransferModal(false);
          }}
        />
      )}

      {openingBalanceAccount && (
        <OpeningBalanceModal
          account={openingBalanceAccount}
          onClose={() => setOpeningBalanceAccount(null)}
          onApply={(amount, asOfDate) => {
            const biz = openingBalanceAccount.category === 'business' ? activeBusinessId ?? undefined : undefined;
            setJournalEntries(prev => upsertOpeningJournal(prev, openingBalanceAccount, amount, biz, asOfDate));
            setOpeningBalanceAccount(null);
          }}
        />
      )}

      <button
        type="button"
        onClick={openNewTransaction}
        className="fixed z-40 min-h-12 min-w-12 h-14 w-14 bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1.25rem,env(safe-area-inset-right,0px))] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center transition-colors touch-manipulation"
        aria-label="Add transaction"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}

function Dashboard({ personalAccounts, businessAccounts, getAccountBalance, saasMetrics, onAddTransaction, onEditOpeningBalance }: DashboardProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Enhanced Hero Section */}
      <div className="gradient-hero rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative flex items-center justify-between">
          <div className="animate-slide-up">
            <h1 className="text-4xl font-bold mb-2 text-shadow-soft font-display">Welcome to Moneta</h1>
            <p className="text-white/90 text-lg">Your professional SaaS accounting dashboard</p>
          </div>
          <div className="hidden md:block animate-bounce-in">
            <TrendingUp className="w-20 h-20 text-white/30" />
          </div>
        </div>
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* MRR Card */}
        <div className="card-metric p-6 rounded-2xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between">
        <div>
              <p className="text-sm font-medium text-blue-600 mb-2 uppercase tracking-wide">Monthly Recurring Revenue</p>
              <p className="text-3xl font-bold text-blue-900 mb-1">${saasMetrics.mrr.toFixed(2)}</p>
              <div className="flex items-center text-xs text-blue-600">
                <TrendingUp className="w-3 h-3 mr-1" />
                MRR from subscriptions
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Burn Rate Card */}
        <div className={`card-metric p-6 rounded-2xl animate-slide-up ${
          saasMetrics.burnRateVsRevenue > 100 ? 'ring-2 ring-red-200' : ''
        }`} style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between">
                    <div>
              <p className={`text-sm font-medium mb-2 uppercase tracking-wide ${
                saasMetrics.burnRateVsRevenue > 100 ? 'text-red-600' : 'text-green-600'
              }`}>
                Burn Rate
              </p>
              <p className={`text-3xl font-bold mb-1 ${
                saasMetrics.burnRateVsRevenue > 100 ? 'text-red-900' : 'text-green-900'
              }`}>
                {saasMetrics.burnRateVsRevenue.toFixed(0)}%
              </p>
              <div className={`flex items-center text-xs ${
                saasMetrics.burnRateVsRevenue > 100 ? 'text-red-600' : 'text-green-600'
              }`}>
                <Flame className="w-3 h-3 mr-1" />
                Cost vs revenue ratio
                    </div>
                  </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              saasMetrics.burnRateVsRevenue > 100 ? 'bg-red-100' : 'bg-green-100'
            }`}>
              <Flame className={`w-6 h-6 ${
                saasMetrics.burnRateVsRevenue > 100 ? 'text-red-600' : 'text-green-600'
              }`} />
                </div>
          </div>
        </div>

        {/* Tax Reserve Card */}
        <div className="card-metric p-6 rounded-2xl animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between">
        <div>
              <p className="text-sm font-medium text-accent-600 mb-2 uppercase tracking-wide">Tax Reserve</p>
              <p className="text-3xl font-bold text-accent-900 mb-1">${saasMetrics.taxReserve.toFixed(2)}</p>
              <div className="flex items-center text-xs text-accent-600">
                <Shield className="w-3 h-3 mr-1" />
                30% of total income
              </div>
            </div>
            <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-accent-600" />
            </div>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className={`card-metric p-6 rounded-2xl animate-slide-up ${
          (saasMetrics.mrr - saasMetrics.fixedCosts) < 0 ? 'ring-2 ring-red-200' : ''
        }`} style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium mb-2 uppercase tracking-wide ${
                (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                Net Cash Flow
              </p>
              <p className={`text-3xl font-bold mb-1 ${
                (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'text-emerald-900' : 'text-red-900'
              }`}>
                ${(saasMetrics.mrr - saasMetrics.fixedCosts).toFixed(2)}
              </p>
              <div className={`flex items-center text-xs ${
                (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {((saasMetrics.mrr - saasMetrics.fixedCosts) >= 0) ? (
                  <ArrowUp className="w-3 h-3 mr-1" />
                ) : (
                  <ArrowDown className="w-3 h-3 mr-1" />
                )}
                Monthly net position
              </div>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'bg-emerald-100' : 'bg-red-100'
            }`}>
              {((saasMetrics.mrr - saasMetrics.fixedCosts) >= 0) ? (
                <TrendingUp className={`w-6 h-6 text-emerald-600`} />
              ) : (
                <TrendingDown className={`w-6 h-6 text-red-600`} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Accounts Section */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <h2 className="text-xl font-semibold text-neutral-900 mb-6 flex items-center">
            <Wallet className="w-5 h-5 mr-3 text-blue-500" />
            Personal Accounts
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              {personalAccounts.length}
            </span>
          </h2>
          <div className="space-y-3">
            {personalAccounts.map((account: Account, index) => {
              const balance = getAccountBalance(account.id);
              return (
                <div
                  key={account.id}
                  className="card-interactive p-4 bg-gradient-to-r from-neutral-50 to-neutral-100/50 rounded-xl border border-neutral-200/50"
                  style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mr-4 shadow-md">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                      </div>
                    <div>
                        <p className="font-semibold text-neutral-900">{account.name}</p>
                        <p className="text-sm text-neutral-500 capitalize">{account.type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
                        ${balance.toFixed(2)}
                      </p>
                      <p className={`text-xs ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance >= 0 ? 'Positive' : 'Negative'}
                      </p>
                      {onEditOpeningBalance && (
                        <button
                          type="button"
                          onClick={() => onEditOpeningBalance(account)}
                          className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Opening balance
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {personalAccounts.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                <Wallet className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p>No personal accounts yet</p>
          </div>
            )}
        </div>
      </div>

        <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <h2 className="text-xl font-semibold text-neutral-900 mb-6 flex items-center">
            <Building className="w-5 h-5 mr-3 text-emerald-500" />
            Business Accounts
            <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
              {businessAccounts.length}
            </span>
          </h2>
          <div className="space-y-3">
            {businessAccounts.map((account: Account, index) => {
              const balance = getAccountBalance(account.id);
              return (
                <div
                  key={account.id}
                  className="card-interactive p-4 bg-gradient-to-r from-neutral-50 to-neutral-100/50 rounded-xl border border-neutral-200/50"
                  style={{ animationDelay: `${0.7 + index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center mr-4 shadow-md">
                        <Building2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
                        <p className="font-semibold text-neutral-900">{account.name}</p>
                        <p className="text-sm text-neutral-500 capitalize">{account.type.replace('_', ' ')}</p>
          </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
                        ${balance.toFixed(2)}
                      </p>
                      <p className={`text-xs ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance >= 0 ? 'Positive' : 'Negative'}
                      </p>
                      {onEditOpeningBalance && (
                        <button
                          type="button"
                          onClick={() => onEditOpeningBalance(account)}
                          className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-800"
                        >
                          Opening balance
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {businessAccounts.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                <Building className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p>No business accounts yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Burn Rate Analysis */}
      <div className="card p-8 animate-slide-up" style={{ animationDelay: '0.8s' }}>
        <h2 className="text-2xl font-semibold text-neutral-900 mb-8 flex items-center">
          <Flame className="w-6 h-6 mr-3 text-accent-500" />
          Burn Rate Analysis
          <span className="ml-3 status-indicator status-warning">
            {saasMetrics.burnRateVsRevenue > 100 ? '🚨' : saasMetrics.burnRateVsRevenue > 50 ? '⚠️' : '✅'}
            {saasMetrics.burnRateVsRevenue.toFixed(0)}%
          </span>
        </h2>

        <div className="space-y-8">
          {/* Revenue vs Costs Comparison */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
                    <p className="text-sm font-medium text-neutral-600">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-green-700">${saasMetrics.mrr.toFixed(2)}</p>
          </div>
          </div>
          </div>
              <div className="progress-bar">
                <div className="progress-fill bg-green-500" style={{ width: '100%' }}></div>
        </div>
              <p className="text-xs text-neutral-500">Your subscription revenue</p>
      </div>

        <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Fixed Costs</p>
                    <p className="text-2xl font-bold text-red-700">${saasMetrics.fixedCosts.toFixed(2)}</p>
          </div>
          </div>
              </div>
              <div className="progress-bar">
            <div
                  className="progress-fill progress-fill-error"
              style={{
                width: saasMetrics.mrr > 0 ? `${Math.min((saasMetrics.fixedCosts / saasMetrics.mrr) * 100, 100)}%` : '0%'
              }}
                ></div>
              </div>
              <p className="text-xs text-neutral-500">API, hosting, and SaaS costs</p>
            </div>
          </div>

          {/* Net Cash Flow Summary */}
          <div className="bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-2xl p-6 border border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Monthly Cash Flow</h3>
              <div className={`text-3xl font-bold ${
                (saasMetrics.mrr - saasMetrics.fixedCosts) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                ${(saasMetrics.mrr - saasMetrics.fixedCosts).toFixed(2)}
            </div>
            </div>

            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              saasMetrics.burnRateVsRevenue > 100
                ? 'bg-red-100 text-red-800 border border-red-200'
                : saasMetrics.burnRateVsRevenue > 50
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                : 'bg-green-100 text-green-800 border border-green-200'
            }`}>
              {saasMetrics.burnRateVsRevenue > 100 ? '🚨 Critical' : saasMetrics.burnRateVsRevenue > 50 ? '⚠️ Warning' : '✅ Healthy'}
              <span className="font-semibold">
              {saasMetrics.burnRateVsRevenue > 100
                  ? `Burning ${saasMetrics.burnRateVsRevenue.toFixed(0)}% of revenue`
                : saasMetrics.burnRateVsRevenue > 50
                  ? `Moderate burn at ${saasMetrics.burnRateVsRevenue.toFixed(0)}% of revenue`
                  : `Healthy burn rate at ${saasMetrics.burnRateVsRevenue.toFixed(0)}% of revenue`
                }
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-neutral-600">Revenue Multiple</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {saasMetrics.mrr > 0 ? `${(saasMetrics.mrr / saasMetrics.fixedCosts).toFixed(1)}x` : '∞'}
            </p>
          </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-neutral-600">Runway</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {saasMetrics.mrr > saasMetrics.fixedCosts ? '∞ months' : 'Calculate with buffer'}
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-neutral-600">Break-even Point</p>
                <p className="text-lg font-semibold text-neutral-900">
                  ${Math.max(0, saasMetrics.fixedCosts - saasMetrics.mrr).toFixed(0)}/month
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Action Button */}
      <div className="flex justify-center animate-bounce-in" style={{ animationDelay: '1s' }}>
        <Button
          size="lg"
          variant="gradient"
          effect="glow"
          icon={Plus}
        onClick={onAddTransaction}
          className="shadow-2xl"
      >
          Add New Transaction
        </Button>
      </div>
    </div>
  );
}

function Transactions({ transactions, accounts, categories, filterType, setFilterType, onAddTransaction, onEditTransaction, onDeleteTransaction }: TransactionsProps) {
  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
                        {tx.amount >= 0 ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                      </p>
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

function Reports({ transactions, categories, metrics, accounts, journalEntries }: ReportsProps) {
  const businessExpenses = transactions.filter(
    (t: Transaction) => t.type === 'business' && t.amount < 0 && (t.kind ?? 'income_expense') !== 'transfer',
  );
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

  // Prepare monthly series for sparklines (last 6 months)
  const monthsBack = 6;
  const monthLabels: string[] = [];
  const incomeSeries: number[] = [];
  const expenseSeries: number[] = [];
  const netSeries: number[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    monthLabels.push(d.toLocaleDateString(undefined, { month: 'short' }));
    const monthIncome = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === y && td.getMonth() === m && t.amount > 0;
    }).reduce((s, t) => s + t.amount, 0);
    const monthExpenses = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === y && td.getMonth() === m && t.amount < 0;
    }).reduce((s, t) => s + Math.abs(t.amount), 0);
    incomeSeries.push(monthIncome);
    expenseSeries.push(monthExpenses);
    netSeries.push(monthIncome - monthExpenses);
  }

  const renderSparkline = (values: number[], stroke: string) => {
    const w = 92; const h = 24; const pad = 2;
    if (!values || values.length === 0) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const step = (w - pad * 2) / (values.length - 1 || 1);
    const points = values.map((v, i) => {
      const x = pad + i * step;
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={w} height={h} className="inline-block align-middle">
        <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    );
  };

  return (
    <div className="space-y-8">
      {/* Monthly Overview Card - neutral, high-contrast */}
      <div className="bg-white p-8 rounded-2xl shadow-soft border border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-neutral-900">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-neutral-600">Business Performance Overview</p>
          </div>
          <Calendar className="w-12 h-12 text-neutral-300" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-neutral-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 mb-2 uppercase tracking-wide">Revenue</p>
                <p className="text-2xl font-bold text-neutral-900">${metrics.income.toFixed(2)}</p>
                <div className="mt-2">{renderSparkline(incomeSeries, '#10b981')}</div>
              </div>
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <div className="bg-neutral-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 mb-2 uppercase tracking-wide">Expenses</p>
                <p className="text-2xl font-bold text-red-700">-${metrics.expenses.toFixed(2)}</p>
                <div className="mt-2">{renderSparkline(expenseSeries, '#ef4444')}</div>
              </div>
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>

          <div className={`rounded-xl p-4`}>
            <div className="flex items-center justify-between bg-neutral-50 rounded-xl p-4">
              <div>
                <p className={`text-sm ${metrics.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Net</p>
                <p className={`text-2xl font-bold ${metrics.net >= 0 ? 'text-neutral-900' : 'text-neutral-900'}`}>
                  ${metrics.net.toFixed(2)}
                </p>
                <div className="mt-2">{renderSparkline(netSeries, '#6366f1')}</div>
              </div>
              {metrics.net >= 0 ? (
                <ArrowUp className="w-6 h-6 text-emerald-500" />
              ) : (
                <ArrowDown className="w-6 h-6 text-red-500" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expense Categories Chart */}
      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-soft">
        <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
          <PieChart className="w-5 h-5 mr-2 text-neutral-700" />
          Expense Breakdown
        </h3>

        {sortedExpenses.length === 0 ? (
          <div className="text-center py-12">
            <PieChart className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500">No expenses recorded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedExpenses.map(([category, amount], index) => {
              const percentage = (amount / totalExpenses) * 100;
              const colors = [
                'bg-blue-500', 'bg-green-500', 'bg-purple-500',
                'bg-red-500', 'bg-yellow-500', 'bg-indigo-500'
              ];

              return (
                <div key={category} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${colors[index % colors.length]}`} />
                    <span className="font-medium text-neutral-900">{category}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-900">${amount.toFixed(2)}</p>
                    <p className="text-sm text-neutral-500">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-soft">
        <h3 className="text-lg font-semibold text-neutral-900 mb-2 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-neutral-700" />
          Trial balance (ledger)
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          Double-entry register balances for the active books. Category rows use your income/expense categories as P&amp;L accounts.
        </p>
        {journalEntries.length === 0 ? (
          <p className="text-neutral-500 text-sm">No journal activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-600">
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4 text-right">Debit</th>
                  <th className="py-2 pr-4 text-right">Credit</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {buildTrialBalance(accounts, categories, journalEntries).map(row => (
                  <tr key={row.accountId} className="border-b border-neutral-100">
                    <td className="py-2 pr-4 text-neutral-900">{row.label}</td>
                    <td className="py-2 pr-4 text-neutral-500 capitalize">{row.ledgerType}</td>
                    <td className="py-2 pr-4 text-right font-mono">${row.debitTotal.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right font-mono">${row.creditTotal.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono font-medium">${row.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-soft">
        <h3 className="text-lg font-semibold text-neutral-900 mb-2 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-neutral-700" />
          Balance sheet (simplified)
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          Assets and liabilities from bank/card registers; equity includes opening balance equity and open P&amp;L (uncategorized to retained earnings).
        </p>
        {(() => {
          const bs = buildBalanceSheet(accounts, categories, journalEntries);
          const Line = ({ label, amount }: { label: string; amount: number }) => (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-neutral-700">{label}</span>
              <span className="font-mono font-medium">${amount.toFixed(2)}</span>
            </div>
          );
          return (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-lg border border-neutral-200 p-4">
                <h4 className="font-semibold text-neutral-900 mb-2">Assets</h4>
                {bs.assetLines.map(l => (
                  <Line key={l.id} label={l.label} amount={l.amount} />
                ))}
                <div className="flex justify-between pt-2 mt-2 border-t border-neutral-200 font-semibold">
                  <span>Total assets</span>
                  <span className="font-mono">${bs.totalAssets.toFixed(2)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4">
                <h4 className="font-semibold text-neutral-900 mb-2">Liabilities</h4>
                {bs.liabilityLines.length === 0 ? (
                  <p className="text-neutral-500 text-sm">None</p>
                ) : (
                  bs.liabilityLines.map(l => <Line key={l.id} label={l.label} amount={l.amount} />)
                )}
                <div className="flex justify-between pt-2 mt-2 border-t border-neutral-200 font-semibold">
                  <span>Total liabilities</span>
                  <span className="font-mono">${bs.totalLiabilities.toFixed(2)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4">
                <h4 className="font-semibold text-neutral-900 mb-2">Equity</h4>
                {bs.equityLines.map(l => (
                  <Line key={l.id} label={l.label} amount={l.amount} />
                ))}
                <div className="flex justify-between pt-2 mt-2 border-t border-neutral-200 font-semibold">
                  <span>Total equity</span>
                  <span className="font-mono">${bs.totalEquity.toFixed(2)}</span>
                </div>
                <p className={`text-xs mt-3 ${Math.abs(bs.check) < 0.02 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  Accounting check (A − L − E): ${bs.check.toFixed(2)}
                  {Math.abs(bs.check) < 0.02 ? ' — balanced' : ' — review transfers and openings'}
                </p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function ImportBackupModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (mode: 'replace' | 'merge', text: string) => void;
}) {
  const [jsonText, setJsonText] = useState('');
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setJsonText(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(f);
  };

  const submit = () => {
    if (!jsonText.trim()) {
      alert('Choose a Moneta .json backup file first.');
      return;
    }
    if (
      mode === 'replace' &&
      !window.confirm(
        'Replace ALL local Moneta data in this browser? IndexedDB receipts will be cleared. This cannot be undone.',
      )
    ) {
      return;
    }
    onImport(mode, jsonText);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-large">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import backup
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100" aria-label="Close">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <p className="text-sm text-neutral-600 mb-4">
          Use a JSON file from <strong>Backup Data</strong>. Receipt images are not in the file—they live in this browser only. Replace wipes local books and clears attachments; Merge adds records whose IDs are not already present.
        </p>
        <input type="file" accept=".json,application/json" onChange={onFile} className="block w-full text-sm text-neutral-600 mb-4" />
        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="impmode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            Merge into current data (additive)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="impmode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            Replace everything (from backup)
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={submit}>
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({
  accounts,
  activeBusinessId,
  onClose,
  onSave,
}: {
  accounts: Account[];
  activeBusinessId: string | null;
  onClose: () => void;
  onSave: (draft: Omit<Transaction, 'id' | 'createdAt' | 'kind'>) => void;
}) {
  const eligible = accounts.filter(a => a.isActive);
  const [fromId, setFromId] = useState(eligible[0]?.id ?? '');
  const [toId, setToId] = useState(eligible.find(a => a.id !== eligible[0]?.id)?.id ?? eligible[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('Transfer');

  const submit = () => {
    const amt = parseFloat(amount);
    if (!fromId || !toId || fromId === toId || !amt || amt <= 0) {
      alert('Choose two different accounts and a positive amount.');
      return;
    }
    const fromAcc = accounts.find(a => a.id === fromId);
    const toAcc = accounts.find(a => a.id === toId);
    const businessSide =
      fromAcc?.category === 'business' || toAcc?.category === 'business';
    const businessId = businessSide ? activeBusinessId ?? undefined : undefined;
    onSave({
      accountId: fromId,
      transferToAccountId: toId,
      amount: amt,
      date: new Date(date).toISOString(),
      description: description.trim() || 'Transfer',
      categoryId: '',
      type: (fromAcc?.category as 'personal' | 'business') || 'personal',
      businessId,
      notes: undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-large">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Transfer between accounts
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100" aria-label="Close">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <p className="text-sm text-neutral-600 mb-4">
          Posts Dr to the destination register and Cr from the source (double-entry). Use for card payments, checking → savings, or business ↔ personal when appropriate.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">From</label>
            <select
              value={fromId}
              onChange={e => setFromId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            >
              {eligible.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.category})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">To</label>
            <select
              value={toId}
              onChange={e => setToId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            >
              {eligible.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.category})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Memo</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={submit}>
            Record transfer
          </Button>
        </div>
      </div>
    </div>
  );
}

function OpeningBalanceModal({
  account,
  onClose,
  onApply,
}: {
  account: Account;
  onClose: () => void;
  onApply: (amount: number, asOfDate: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const lt = account.ledgerType ?? (account.type === 'credit_card' ? 'liability' : 'asset');

  const submit = () => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n < 0) {
      alert('Enter a non-negative opening amount.');
      return;
    }
    onApply(n, asOf);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-large">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Opening balance</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100" aria-label="Close">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <p className="text-sm text-neutral-600 mb-2">
          <strong>{account.name}</strong> — {lt === 'asset' ? 'Asset register (e.g. cash in bank).' : 'Liability register (e.g. amount owed on card).'}
        </p>
        <p className="text-xs text-neutral-500 mb-4">
          Creates a balanced journal entry against Opening balance equity. Adjusting this replaces any prior opening entry for this register.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Opening amount</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">As of date</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg" />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={submit}>
            Save opening entry
          </Button>
        </div>
      </div>
    </div>
  );
}

function TransactionModal({
  accounts,
  categories,
  categoryRules,
  onClose,
  onSave,
  transaction,
}: TransactionModalProps) {
  const isEditing = !!transaction;
  const draftTxId = useRef(transaction?.id ?? `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`).current;
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

  const selectedAccount = accounts.find((a: Account) => a.id === accountId);
  const filteredCategories = categories.filter((c: Category) =>
    isExpense ? c.type === 'expense' : c.type === 'income'
  );

  const activeBusiness = (() => {
    try {
      const raw = window.localStorage.getItem('moneta:businesses');
      if (!raw) return null;
      const list = JSON.parse(raw) as any[];
      return list.find(b => b.id === activeBusinessId) || null;
    } catch {
      return null;
    }
  })();

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
    };

    onSave(transactionData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-950 rounded-2xl max-w-md w-full p-6 max-h-[90dvh] overflow-y-auto shadow-large border border-neutral-200 dark:border-neutral-800">
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
          <div className="flex gap-3 pt-4">
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

export default App;