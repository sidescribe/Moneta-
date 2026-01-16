export interface Transaction {
  id: string;
  accountId: string;
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

export interface TransactionModalProps {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>) => void;
  transaction: Transaction | null;
}