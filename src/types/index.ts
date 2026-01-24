export interface Transaction {
  id: string;
  accountId: string;
  businessId?: string;
  recurringId?: string;
  date: string;
  amount: number;
  categoryId: string;
  description: string;
  notes?: string;
  type: 'personal' | 'business';
  subscriptionType?: 'one-time' | 'recurring';
  businessCategory?: string;
  createdAt?: number;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  category: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  businessRelevant: boolean;
}

export interface Business {
  id: string;
  name: string;
  currency: string; // ISO 4217 code, e.g. "USD"
  timezone?: string; // IANA timezone, e.g. "America/Los_Angeles"
  createdAt: number;
  settings?: {
    defaultAccountId?: string;
    startingBalance?: number;
  };
}

export interface Recurring {
  id: string;
  businessId?: string;
  accountId: string;
  amount: number;
  categoryId: string;
  description?: string;
  isExpense?: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  // For monthly frequency, dayOfMonth (1-31). For weekly, weekday (0-6). For custom, intervalDays.
  dayOfMonth?: number;
  weekday?: number;
  intervalDays?: number;
  startDate: string; // ISO date
  endDate?: string; // optional ISO date
  active: boolean;
  lastRunAt?: number; // timestamp
  nextRunAt?: number; // timestamp
}

export interface SaaSMetrics {
  mrr: number;
  totalIncome: number;
  fixedCosts: number;
  taxReserve: number;
  monthlyBurnRate: number;
  burnRateVsRevenue: number;
}

export interface BusinessMetrics {
  income: number;
  expenses: number;
  net: number;
}

export interface DashboardProps {
  personalAccounts: Account[];
  businessAccounts: Account[];
  getAccountBalance: (accountId: string) => number;
  metrics: BusinessMetrics;
  saasMetrics: SaaSMetrics;
  onAddTransaction: () => void;
}

export interface TransactionsProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  filterType: string;
  setFilterType: (type: string) => void;
  onAddTransaction: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
}

export interface ReportsProps {
  transactions: Transaction[];
  categories: Category[];
  metrics: BusinessMetrics;
}

export interface MonthlyStatement {
  id: string;
  year: number;
  month: number; // 0-11 (JavaScript month index)
  monthName: string;
  businessId?: string;
  transactions: Transaction[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netAmount: number;
    transactionCount: number;
  };
  archivedAt: number; // timestamp when archived
}

export interface AnnualStatement {
  year: number;
  monthlyStatements: MonthlyStatement[];
  annualSummary: {
    totalIncome: number;
    totalExpenses: number;
    netAmount: number;
    totalTransactions: number;
  };
}

export interface TransactionModalProps {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>) => void;
  transaction: Transaction | null;
}