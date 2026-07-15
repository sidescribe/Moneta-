'use client';
import { useState, useEffect, useRef } from 'react';
import { Plus, Download, X, Sun, Moon, ArrowLeftRight, Upload, Wand2, Menu, FileSpreadsheet, History, BarChart3, Receipt, PieChart, Calendar, TrendingUp } from 'lucide-react';
import RecurringList from './components/recurring/RecurringList';
import RulesList from './components/rules/RulesList';
import PWAInstall from './PWAInstall';
import { Button } from './components/ui/Button';
import BusinessSwitcher from './components/business/BusinessSwitcher';
import SearchBar from './components/SearchBar';
import DateRangePicker from './components/DateRangePicker';
import CsvImportModal from './components/modals/CsvImportModal';
import ImportBackupModal from './components/modals/ImportBackupModal';
import TransferModal from './components/modals/TransferModal';
import OpeningBalanceModal from './components/modals/OpeningBalanceModal';
import TransactionModal from './components/modals/TransactionModal';
import ProfitLossReport from './components/reports/ProfitLossReport';
import TaxSummaryReport from './components/reports/TaxSummaryReport';
import ReconciliationView from './components/reports/ReconciliationView';
import { ReportsView } from './components/reports/ReportsView';
import MonthlyBarChart from './components/charts/MonthlyBarChart';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import { createPersistence } from './lib/persistence';
import { pushAuditEntry, getAuditLog, type AuditEntry } from './lib/auditLog';
import { migrateLocalStorageToIdb } from './lib/idbStorage';
import { pickBackupFile, writeToFileHandle, supportsFileSystemAccess, type FsFileHandle } from './lib/fileBackup';
import { useLocalStorage } from './lib/useLocalStorage';
import { filterByDateRange } from './lib/dateRange';
import { presetToRange } from './lib/profitLoss';
import { useToast } from './lib/toast';
import { formatMoney } from './lib/formatMoney';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { Transaction, Account, Category, CategoryRule, SaaSMetrics, BusinessMetrics, JournalEntry, MonthlyStatement, AnnualStatement } from './types';
import {
  filterJournalByBusiness,
  journalFromTransaction,
  ledgerBalanceForRegister,
  replaceJournalForTransaction,
  removeJournalForTransaction,
  upsertOpeningJournal,
} from './lib/journal';
import { migrateLedgerIfNeeded } from './lib/migrateLedger';
import {
  parseBackupJson,
  normalizeBackup,
  mergeIntoLocal,
  finalizeImportedLedger,
} from './lib/backupImport';
import { applyRulesToTransaction } from './lib/categoryRules';
import {
  clearAllAttachments,
  deleteAttachmentsForTransaction,
} from './lib/attachmentsDb';

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
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [openingBalanceAccount, setOpeningBalanceAccount] = useState<Account | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [txModalNonce, setTxModalNonce] = useState(0);
  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);
  const [view, setView] = useState('dashboard');
  const [filterType, setFilterType] = useState('all');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogEntries, setAuditLogEntries] = useState<AuditEntry[]>([]);
  const { toast } = useToast();

  // New state for monthly/annual statements
  const [monthlyStatements, setMonthlyStatements] = useLocalStorage('monthlyStatements', []) as [MonthlyStatement[], (value: MonthlyStatement[] | ((prev: MonthlyStatement[]) => MonthlyStatement[])) => void];
  const [currentMonthView, setCurrentMonthView] = useState('current'); // 'current' | 'archived'
  const defaultRange = presetToRange('this-month');
  const [rangeStart, setRangeStart] = useState(defaultRange.start);
  const [rangeEnd, setRangeEnd] = useState(defaultRange.end);
  const [reportSubView, setReportSubView] = useState<'overview' | 'pnl' | 'tax' | 'reconcile'>('overview');

  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem('moneta:activeBusinessId');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<{ businessId?: string | null }>).detail;
      const id = d?.businessId ?? window.localStorage.getItem('moneta:activeBusinessId');
      setActiveBusinessId(id);
    };
    window.addEventListener('moneta:businessSwitched', handler);
    const openRecurring = (e: Event) => {
      const id = (e as CustomEvent<{ recurringId?: string }>).detail?.recurringId;
      if (id) setView('recurring');
    };
    window.addEventListener('moneta:openRecurring', openRecurring);
    return () => {
      window.removeEventListener('moneta:businessSwitched', handler);
      window.removeEventListener('moneta:openRecurring', openRecurring);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time migration from initial snapshot
  }, []);

  // Migrate localStorage data to IndexedDB on first load
  const idbMigrated = useRef(false);
  useEffect(() => {
    if (idbMigrated.current) return;
    idbMigrated.current = true;
    const keys = ['accounts', 'transactions', 'categories', 'moneta:categoryRules', 'journalEntries', 'monthlyStatements', 'moneta:schemaVersion'];
    void migrateLocalStorageToIdb(keys);
  }, []);

  // File System Access API backup handle
  const backupHandleRef = useRef<FsFileHandle | null>(null);

  const handleSaveToFile = async () => {
    let handle = backupHandleRef.current;
    if (!handle) {
      handle = await pickBackupFile();
      if (!handle) return;
      backupHandleRef.current = handle;
    }
    const data = {
      metadata: { exportDate: new Date().toISOString(), version: '1.2', appName: 'Moneta' },
      accounts, categories, categoryRules, journalEntries, transactions, monthlyStatements,
    };
    const ok = await writeToFileHandle(handle, data);
    if (ok) {
      pushAuditEntry({ action: 'import_data', description: 'Auto-saved backup to file' });
      toast('Saved to file', 'success');
    }
  };

  // Persistence instance (local by default)
  const persistence = createPersistence();

  // Scheduler: generate due recurring transactions for a business
  const runDueRecurringsForBusiness = async (businessId: string | null) => {
    if (!businessId) return;
    try {
      const recurrings = await persistence.getRecurrings(businessId);
      const now = Date.now();
      const generated: Transaction[] = [];

      const addInterval = (ts: number, r: Recurring) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runDueRecurringsForBusiness intentionally omitted from deps
  }, [activeBusinessId]);

  const matchesActiveBusiness = (t: Transaction) => {
    const active = activeBusinessId;
    if (!active) return !t.businessId;
    return t.businessId === active;
  };

  const filteredTransactions = transactions.filter(matchesActiveBusiness);
  const rangedTxs = filterByDateRange(filteredTransactions, rangeStart, rangeEnd);

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

    toast(`Exported ${rows.length} transactions`, 'success');
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

    toast('Backup exported', 'success');
  };

  const runImport = (mode: 'replace' | 'merge', jsonText: string) => {
    const raw = parseBackupJson(jsonText);
    if (!raw) {
      toast('Could not parse JSON.', 'error');
      return;
    }
    const normalized = normalizeBackup(raw);
    if (!normalized) {
      toast('This file does not look like a Moneta backup.', 'error');
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
    toast('Import complete', 'success');
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

  const addTransaction = (transaction: Omit<Transaction, 'id'> & { id?: string }) => {
    const id = transaction.id ?? Date.now().toString();
    const tx: Transaction = {
      ...transaction,
      id,
      businessId: transaction.businessId,
      kind: transaction.kind ?? 'income_expense',
    };
    recordNewTransaction(tx);
    pushAuditEntry({ action: 'add_transaction', description: `Added "${tx.description}" ($${Math.abs(tx.amount).toFixed(2)})`, undoPayload: tx });
    toast('Transaction added', 'success');
    setShowAddTransaction(false);
  };

  const updateTransaction = (updatedTransaction: Omit<Transaction, 'id'> & { id?: string }) => {
    const id = updatedTransaction.id;
    if (!id) return;
    const oldTx = transactions.find(t => t.id === id);
    const tx: Transaction = {
      ...updatedTransaction,
      id,
      kind: updatedTransaction.kind ?? 'income_expense',
    };
    setTransactions(prev => prev.map(t => (t.id === tx.id ? tx : t)));
    setJournalEntries(prev => replaceJournalForTransaction(prev, tx, accounts, categories));
    pushAuditEntry({ action: 'update_transaction', description: `Updated "${tx.description}"`, undoPayload: oldTx });
    setEditingTransaction(null);
    setShowAddTransaction(false);
  };

  const deleteTransaction = (transactionId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    void deleteAttachmentsForTransaction(transactionId);
    setTransactions(prev => prev.filter(t => t.id !== transactionId));
    setJournalEntries(prev => removeJournalForTransaction(prev, transactionId));
    pushAuditEntry({
      action: 'delete_transaction',
      description: `Deleted "${transaction.description}" (${formatMoney(Math.abs(transaction.amount))})`,
      undoPayload: transaction,
    });
    toast(`Deleted "${transaction.description}"`, 'undo', {
      duration: 8000,
      onUndo: () => {
        recordNewTransaction(transaction);
        toast('Transaction restored', 'success');
      },
    });
  };

  const handleCsvImport = (importedTxs: Transaction[]) => {
    for (const tx of importedTxs) {
      recordNewTransaction(tx);
    }
    pushAuditEntry({ action: 'csv_import', description: `Imported ${importedTxs.length} transactions from CSV` });
    toast(`Imported ${importedTxs.length} transactions`, 'success');
    setShowCsvImportModal(false);
  };

  const handleMarkReconciled = (txIds: string[]) => {
    setTransactions(prev => prev.map(t => txIds.includes(t.id) ? { ...t, reconciled: true } : t));
    pushAuditEntry({ action: 'reconcile', description: `Reconciled ${txIds.length} transactions` });
    setView('dashboard');
  };

  const openNewTransaction = () => {
    setEditingTransaction(null);
    setTxModalNonce(n => n + 1);
    setShowAddTransaction(true);
  };

  useKeyboardShortcuts({
    onNewTransaction: openNewTransaction,
    onFocusSearch: () => {
      setView('transactions');
      queueMicrotask(() => {
        document.querySelector<HTMLInputElement>('input[placeholder="Search transactions..."]')?.focus();
      });
    },
    onEscape: () => {
      setShowAddTransaction(false);
      setShowTransferModal(false);
      setShowImportModal(false);
      setShowCsvImportModal(false);
      setShowAuditLog(false);
      setOpeningBalanceAccount(null);
      setMobileHeaderMenuOpen(false);
    },
    onSaveFile: () => { void handleSaveToFile(); },
  });

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  const metrics = getBusinessMetrics();
  const saasMetrics = getSaaSMetrics();
  const personalAccounts = accounts.filter(a => a.category === 'personal' && a.isActive);
  const businessAccounts = accounts.filter(a => a.category === 'business' && a.isActive);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return window.localStorage.getItem('moneta:darkMode') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('moneta:darkMode', darkMode ? 'true' : 'false');
    } catch {
      /* localStorage may be disabled */
    }
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
        icon={FileSpreadsheet}
        onClick={() => { setShowCsvImportModal(true); setMobileHeaderMenuOpen(false); }}
        title="Import bank CSV statement"
        className="max-lg:w-full max-lg:justify-start"
      >
        Import CSV
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
      {supportsFileSystemAccess() && (
        <Button
          variant="outline"
          size="sm"
          effect="magnetic"
          icon={Download}
          onClick={() => { void handleSaveToFile(); setMobileHeaderMenuOpen(false); }}
          title="Save backup to a local file (auto-remembers location)"
          className="max-lg:w-full max-lg:justify-start"
        >
          <span className="lg:hidden">Save to File</span>
          <span className="hidden lg:inline">Save File</span>
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        effect="magnetic"
        icon={History}
        onClick={() => { setAuditLogEntries(getAuditLog()); setShowAuditLog(true); setMobileHeaderMenuOpen(false); }}
        title="Activity log"
        className="max-lg:w-full max-lg:justify-start"
      >
        <span className="hidden lg:inline">Activity</span>
        <span className="lg:hidden">Activity Log</span>
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
              { id: 'recurring', label: 'Recurring', short: 'Repeat', icon: Calendar, count: null },
              { id: 'rules', label: 'Rules', short: 'Rules', icon: Wand2, count: categoryRules.length },
              { id: 'reports', label: 'Reports', short: 'Reports', icon: PieChart, count: null },
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

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 md:pb-8 safe-bottom">
        {view === 'dashboard' && (
          <div className="space-y-8">
            <Dashboard
              personalAccounts={personalAccounts}
              businessAccounts={businessAccounts}
              getAccountBalance={getAccountBalance}
              metrics={metrics}
              saasMetrics={saasMetrics}
              onAddTransaction={openNewTransaction}
              onEditOpeningBalance={setOpeningBalanceAccount}
            />
            <MonthlyBarChart transactions={filteredTransactions} monthsBack={6} />
          </div>
        )}

        {view === 'transactions' && (
          <div className="space-y-6">
            <SearchBar
              transactions={filteredTransactions}
              accounts={accounts}
              categories={categories}
              onSelectTransaction={handleEditTransaction}
            />
            <DateRangePicker
              start={rangeStart}
              end={rangeEnd}
              onChange={(s, e) => { setRangeStart(s); setRangeEnd(e); }}
            />
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
                  <span className="sm:hidden">Selected</span>
                  <span className="hidden sm:inline">Selected range ({rangedTxs.length})</span>
                  <span className="sm:hidden"> ({rangedTxs.length})</span>
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

            {/* Selected range view */}
            {currentMonthView === 'current' && (
              <div className="space-y-4">
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-primary-900 mb-2">
                    Selected range
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 text-sm">
                    <div>
                      <p className="text-primary-600">Income</p>
                      <p className="font-bold text-green-600">
                        +${rangedTxs.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-primary-600">Expenses</p>
                      <p className="font-bold text-red-600">
                        -${rangedTxs.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-primary-600">Net</p>
                      <p className={`font-bold ${rangedTxs.reduce((sum, tx) => sum + tx.amount, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${rangedTxs.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

          <Transactions
                  transactions={rangedTxs}
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
                    <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 sm:p-6">
                      <h3 className="text-xl font-bold text-neutral-900 mb-4">{annual.year} Annual Summary</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4 lg:gap-6">
                        <div className="bg-white rounded-lg p-4 shadow-soft">
                          <p className="text-neutral-600 text-sm">Total Income</p>
                          <p className="text-xl sm:text-2xl font-bold text-green-600 break-words">
                            ${annual.annualSummary.totalIncome.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-soft">
                          <p className="text-neutral-600 text-sm">Total Expenses</p>
                          <p className="text-xl sm:text-2xl font-bold text-red-600 break-words">
                            -${annual.annualSummary.totalExpenses.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-soft">
                          <p className="text-neutral-600 text-sm">Net Amount</p>
                          <p className={`text-xl sm:text-2xl font-bold break-words ${annual.annualSummary.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${annual.annualSummary.netAmount.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-soft">
                          <p className="text-neutral-600 text-sm">Transactions</p>
                          <p className="text-xl sm:text-2xl font-bold text-neutral-900">
                            {annual.annualSummary.totalTransactions}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {annual.monthlyStatements.map(statement => (
                        <div key={statement.id} className="bg-white border border-neutral-200 rounded-xl shadow-soft overflow-hidden">
                          <div className="p-4 sm:p-6 border-b border-neutral-200">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <h4 className="text-lg font-semibold text-neutral-900">
                                {statement.monthName} {statement.year}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
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
                                <button onClick={() => unarchiveMonth(statement.id)} className="text-sm text-primary-600 hover:text-primary-700 sm:ml-2">
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
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <div className={`w-2 h-2 rounded-full ${tx.amount >= 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                                      <div className="min-w-0">
                                        <p className="font-medium text-neutral-900 break-words">{tx.description}</p>
                                        <p className="text-sm text-neutral-500 break-words">
                                          {category?.name} • {account?.name} • {new Date(tx.date).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                    <p className={`font-bold self-start sm:self-auto ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          <>
            <div className="flex gap-2 overflow-x-auto mb-6 -mx-1 px-1">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'pnl', label: 'P&L' },
                { id: 'tax', label: 'Tax' },
                { id: 'reconcile', label: 'Reconcile' },
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setReportSubView(s.id as typeof reportSubView)}
                  className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium ${reportSubView === s.id ? 'bg-blue-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {reportSubView === 'overview' && (
              <div className="space-y-8">
                <ReportsView
                  transactions={filteredTransactions}
                  categories={categories}
                  metrics={metrics}
                  accounts={accounts}
                  journalEntries={journalForBusiness}
                />
                <MonthlyBarChart transactions={filteredTransactions} />
              </div>
            )}
            {reportSubView === 'pnl' && (
              <ProfitLossReport
                transactions={filteredTransactions}
                categories={categories}
              />
            )}
            {reportSubView === 'tax' && (
              <TaxSummaryReport
                transactions={filteredTransactions}
                categories={categories}
              />
            )}
            {reportSubView === 'reconcile' && (
              <ReconciliationView
                accounts={accounts}
                transactions={filteredTransactions}
                getAccountBalance={getAccountBalance}
                onMarkReconciled={handleMarkReconciled}
              />
            )}
          </>
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

      {showCsvImportModal && (
        <CsvImportModal
          accounts={accounts}
          categories={categories}
          categoryRules={categoryRules}
          existingTransactions={transactions}
          activeBusinessId={activeBusinessId}
          onClose={() => setShowCsvImportModal(false)}
          onImport={handleCsvImport}
        />
      )}

      {showAuditLog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowAuditLog(false)}>
          <div className="bg-white dark:bg-neutral-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[94dvh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <History className="w-5 h-5" /> Activity Log
              </h2>
              <button type="button" onClick={() => setShowAuditLog(false)} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {auditLogEntries.length === 0 ? (
                <p className="text-center text-neutral-500 py-8">No activity recorded yet</p>
              ) : auditLogEntries.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 break-words">{entry.description}</p>
                    <p className="text-xs text-neutral-500 mt-1">{new Date(entry.timestamp).toLocaleString()}</p>
                  </div>
                  {entry.undoPayload && (entry.action === 'delete_transaction' || entry.action === 'update_transaction') && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0"
                      onClick={() => {
                        const tx = entry.undoPayload as Transaction;
                        if (entry.action === 'delete_transaction') {
                          setTransactions(prev => prev.some(t => t.id === tx.id) ? prev : [...prev, tx]);
                          setJournalEntries(prev => {
                            const je = journalFromTransaction(tx, accounts, categories);
                            if (!je) return prev;
                            return [...prev.filter(e => e.sourceTransactionId !== tx.id), je];
                          });
                          toast('Restored transaction', 'success');
                        } else if (entry.action === 'update_transaction') {
                          setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t));
                          setJournalEntries(prev => replaceJournalForTransaction(prev, tx, accounts, categories));
                          toast('Reverted update', 'success');
                        }
                        setShowAuditLog(false);
                      }}
                    >
                      Undo
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
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

export default App;
