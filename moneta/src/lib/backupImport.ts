import type { Account, Category, CategoryRule, JournalEntry, MonthlyStatement, Transaction } from '../types';
import { normalizeAccountsLedgerTypes } from './migrateLedger';
import { rebuildJournalFromTransactions } from './journal';

export type MonetaBackupPayload = {
  metadata?: {
    exportDate?: string;
    version?: string;
    appName?: string;
    schemaVersion?: number;
    [key: string]: unknown;
  };
  accounts?: unknown[];
  categories?: unknown[];
  transactions?: unknown[];
  journalEntries?: unknown[];
  monthlyStatements?: unknown[];
  categoryRules?: unknown[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function asAccount(x: unknown): Account | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== 'string' || typeof x.name !== 'string') return null;
  const ledgerType = x.ledgerType === 'liability' || x.ledgerType === 'asset' ? x.ledgerType : undefined;
  return {
    id: x.id,
    name: x.name,
    type: typeof x.type === 'string' ? x.type : 'checking',
    category: typeof x.category === 'string' ? x.category : 'personal',
    isActive: Boolean(x.isActive ?? true),
    ledgerType,
  };
}

function asCategory(x: unknown): Category | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== 'string' || typeof x.name !== 'string' || typeof x.type !== 'string') return null;
  return x as unknown as Category;
}

function asTransaction(x: unknown): Transaction | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== 'string' || typeof x.accountId !== 'string') return null;
  if (typeof x.amount !== 'number') return null;
  const t = x as unknown as Transaction;
  return {
    ...t,
    categoryId: typeof t.categoryId === 'string' ? t.categoryId : '',
    attachmentIds: Array.isArray(t.attachmentIds) ? (t.attachmentIds as string[]).filter((id): id is string => typeof id === 'string') : undefined,
  };
}

function asJournalEntry(x: unknown): JournalEntry | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== 'string' || !Array.isArray(x.lines)) return null;
  return x as unknown as JournalEntry;
}

function asMonthlyStatement(x: unknown): MonthlyStatement | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== 'string') return null;
  return x as unknown as MonthlyStatement;
}

function asCategoryRule(x: unknown): CategoryRule | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== 'string' || typeof x.pattern !== 'string' || typeof x.categoryId !== 'string') return null;
  return {
    id: x.id,
    pattern: x.pattern,
    categoryId: x.categoryId,
    priority: typeof x.priority === 'number' ? x.priority : 100,
    matchField: x.matchField === 'notes' || x.matchField === 'both' ? x.matchField : 'description',
  };
}

export function parseBackupJson(text: string): MonetaBackupPayload | null {
  try {
    const data = JSON.parse(text) as unknown;
    if (!isRecord(data)) return null;
    const p = data as MonetaBackupPayload;
    const meta = isRecord(p.metadata) ? p.metadata : null;
    if (
      meta?.appName === 'Moneta' ||
      Array.isArray(p.transactions) ||
      Array.isArray(p.accounts) ||
      Array.isArray(p.categories) ||
      Array.isArray(p.categoryRules)
    ) {
      return p;
    }
    return null;
  } catch {
    return null;
  }
}

export type NormalizedBackup = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  journalEntries: JournalEntry[];
  monthlyStatements: MonthlyStatement[];
  categoryRules: CategoryRule[];
  schemaVersion: number;
};

export function normalizeBackup(data: MonetaBackupPayload): NormalizedBackup | null {
  const accountsRaw = Array.isArray(data.accounts) ? data.accounts : [];
  const categoriesRaw = Array.isArray(data.categories) ? data.categories : [];
  const transactionsRaw = Array.isArray(data.transactions) ? data.transactions : [];
  const journalRaw = Array.isArray(data.journalEntries) ? data.journalEntries : [];
  const monthlyRaw = Array.isArray(data.monthlyStatements) ? data.monthlyStatements : [];
  const rulesRaw = Array.isArray(data.categoryRules) ? data.categoryRules : [];

  const accounts = accountsRaw.map(asAccount).filter(Boolean) as Account[];
  const categories = categoriesRaw.map(asCategory).filter(Boolean) as Category[];
  const transactions = transactionsRaw.map(asTransaction).filter(Boolean) as Transaction[];
  let journalEntries = journalRaw.map(asJournalEntry).filter(Boolean) as JournalEntry[];
  const monthlyStatements = monthlyRaw.map(asMonthlyStatement).filter(Boolean) as MonthlyStatement[];
  const categoryRules = rulesRaw.map(asCategoryRule).filter(Boolean) as CategoryRule[];

  if (
    accounts.length === 0 &&
    categories.length === 0 &&
    transactions.length === 0 &&
    journalEntries.length === 0 &&
    monthlyStatements.length === 0 &&
    categoryRules.length === 0
  ) {
    return null;
  }

  const normalizedAccounts = normalizeAccountsLedgerTypes(accounts);
  const schemaVersion =
    typeof data.metadata?.schemaVersion === 'number' ? data.metadata.schemaVersion : 2;

  if (journalEntries.length === 0 && transactions.length > 0) {
    journalEntries = rebuildJournalFromTransactions(transactions, normalizedAccounts, categories, ['opening'], []);
  }

  return {
    accounts: normalizedAccounts,
    categories,
    transactions,
    journalEntries,
    monthlyStatements,
    categoryRules,
    schemaVersion: Math.max(schemaVersion, 2),
  };
}

export type MergeResult = NormalizedBackup;

function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of list) m.set(x.id, x);
  return m;
}

/** Additive: keep local rows; add backup rows whose ids are missing. */
export function mergeIntoLocal(
  local: {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
    journalEntries: JournalEntry[];
    monthlyStatements: MonthlyStatement[];
    categoryRules: CategoryRule[];
  },
  incoming: NormalizedBackup,
): NormalizedBackup {
  const acc = new Map(byId(normalizeAccountsLedgerTypes(local.accounts)));
  for (const a of incoming.accounts) {
    if (!acc.has(a.id)) acc.set(a.id, a);
  }
  const cat = new Map(byId(local.categories));
  for (const c of incoming.categories) {
    if (!cat.has(c.id)) cat.set(c.id, c);
  }
  const tx = new Map(byId(local.transactions));
  for (const t of incoming.transactions) {
    if (!tx.has(t.id)) tx.set(t.id, t);
  }
  const je = new Map(byId(local.journalEntries));
  for (const j of incoming.journalEntries) {
    if (!je.has(j.id)) je.set(j.id, j);
  }
  const ms = new Map(byId(local.monthlyStatements));
  for (const s of incoming.monthlyStatements) {
    if (!ms.has(s.id)) ms.set(s.id, s);
  }
  const rules = new Map(byId(local.categoryRules));
  for (const r of incoming.categoryRules) {
    if (!rules.has(r.id)) rules.set(r.id, r);
  }

  return {
    accounts: [...acc.values()],
    categories: [...cat.values()],
    transactions: [...tx.values()],
    journalEntries: [...je.values()],
    monthlyStatements: [...ms.values()],
    categoryRules: [...rules.values()],
    schemaVersion: incoming.schemaVersion,
  };
}

export function finalizeImportedLedger(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  journalEntries: JournalEntry[],
): JournalEntry[] {
  return rebuildJournalFromTransactions(transactions, accounts, categories, ['opening'], journalEntries);
}
