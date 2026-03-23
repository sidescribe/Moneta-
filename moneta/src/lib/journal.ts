import type {
  Account,
  Category,
  JournalEntry,
  JournalEntryKind,
  JournalLine,
  LedgerAccountType,
  Transaction,
} from '../types';

export const OPENING_EQUITY_ACCOUNT_ID = 'sys:opening-balance-equity';

export function catAccountId(categoryId: string): string {
  return `cat:${categoryId}`;
}

export function inferLedgerType(account: Pick<Account, 'type' | 'ledgerType'>): 'asset' | 'liability' {
  if (account.ledgerType) return account.ledgerType;
  return account.type === 'credit_card' ? 'liability' : 'asset';
}

export function categoryLedgerType(category: Pick<Category, 'type'>): 'revenue' | 'expense' {
  return category.type === 'income' ? 'revenue' : 'expense';
}

export function isJournalBalanced(lines: JournalLine[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0);
  const c = lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(d - c) < 0.0001;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function journalEntryIdForTransaction(txId: string): string {
  return `je-${txId}`;
}

export function openingJournalIdForAccount(accountId: string): string {
  return `je-open-${accountId}`;
}

/** Dr destination, Cr source — works for asset→asset, asset↔liability (e.g. card payment). */
export function journalFromTransfer(tx: Transaction): JournalEntry | null {
  if (tx.kind !== 'transfer' || !tx.transferToAccountId) return null;
  const amt = roundMoney(Math.abs(tx.amount));
  if (amt <= 0) return null;
  const date = tx.date.includes('T') ? tx.date.slice(0, 10) : tx.date;
  return {
    id: journalEntryIdForTransaction(tx.id),
    date,
    description: tx.description || 'Transfer',
    businessId: tx.businessId,
    sourceTransactionId: tx.id,
    entryKind: 'transfer',
    lines: [
      { accountId: tx.transferToAccountId, debit: amt, credit: 0 },
      { accountId: tx.accountId, debit: 0, credit: amt },
    ],
  };
}

export function journalFromIncomeExpense(
  tx: Transaction,
  accounts: Account[],
  categories: Category[],
): JournalEntry | null {
  if (tx.kind === 'transfer') return null;
  const acct = accounts.find(a => a.id === tx.accountId);
  const cat = categories.find(c => c.id === tx.categoryId);
  if (!acct || !cat) return null;
  const amt = roundMoney(Math.abs(tx.amount));
  if (amt <= 0) return null;
  const date = tx.date.includes('T') ? tx.date.slice(0, 10) : tx.date;
  const catId = catAccountId(tx.categoryId);
  const lines: JournalLine[] =
    tx.amount < 0
      ? [
          { accountId: catId, debit: amt, credit: 0 },
          { accountId: tx.accountId, debit: 0, credit: amt },
        ]
      : [
          { accountId: tx.accountId, debit: amt, credit: 0 },
          { accountId: catId, debit: 0, credit: amt },
        ];
  return {
    id: journalEntryIdForTransaction(tx.id),
    date,
    description: tx.description,
    businessId: tx.businessId,
    sourceTransactionId: tx.id,
    entryKind: 'posting',
    lines,
  };
}

export function journalFromTransaction(
  tx: Transaction,
  accounts: Account[],
  categories: Category[],
): JournalEntry | null {
  const kind = tx.kind ?? 'income_expense';
  if (kind === 'transfer') return journalFromTransfer(tx);
  return journalFromIncomeExpense(tx, accounts, categories);
}

/** Asset/liability register: normal balance from ledger type. Category P&L ids use revenue/expense normals. */
export function lineNetForLedgerType(
  ledgerType: LedgerAccountType,
  debit: number,
  credit: number,
): number {
  switch (ledgerType) {
    case 'asset':
    case 'expense':
      return debit - credit;
    case 'liability':
    case 'equity':
    case 'revenue':
      return credit - debit;
    default:
      return debit - credit;
  }
}

export function resolveLedgerTypeForAccountId(
  accountId: string,
  accounts: Account[],
  categories: Category[],
): LedgerAccountType | null {
  if (accountId === OPENING_EQUITY_ACCOUNT_ID) return 'equity';
  if (accountId.startsWith('cat:')) {
    const cid = accountId.slice(4);
    const cat = categories.find(c => c.id === cid);
    if (!cat) return 'expense';
    return categoryLedgerType(cat);
  }
  const a = accounts.find(x => x.id === accountId);
  if (!a) return null;
  return inferLedgerType(a);
}

export function matchesJournalBusiness(
  entry: JournalEntry,
  activeBusinessId: string | null,
): boolean {
  if (!activeBusinessId) return entry.businessId === undefined;
  return entry.businessId === activeBusinessId;
}

export function filterJournalByBusiness(
  entries: JournalEntry[],
  activeBusinessId: string | null,
): JournalEntry[] {
  return entries.filter(e => matchesJournalBusiness(e, activeBusinessId));
}

export function ledgerBalanceForRegister(
  accountId: string,
  account: Account | undefined,
  entries: JournalEntry[],
): number {
  if (!account) return 0;
  const lt = inferLedgerType(account);
  let deb = 0;
  let cre = 0;
  for (const e of entries) {
    for (const l of e.lines) {
      if (l.accountId !== accountId) continue;
      deb += l.debit;
      cre += l.credit;
    }
  }
  return lineNetForLedgerType(lt, deb, cre);
}

export function replaceJournalForTransaction(
  entries: JournalEntry[],
  tx: Transaction,
  accounts: Account[],
  categories: Category[],
): JournalEntry[] {
  const without = entries.filter(e => e.sourceTransactionId !== tx.id);
  const je = journalFromTransaction(tx, accounts, categories);
  if (!je || !isJournalBalanced(je.lines)) return without;
  return [...without, je];
}

export function removeJournalForTransaction(entries: JournalEntry[], transactionId: string): JournalEntry[] {
  return entries.filter(e => e.sourceTransactionId !== transactionId);
}

export function rebuildJournalFromTransactions(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  preserveKinds: JournalEntryKind[] = ['opening'],
  existing: JournalEntry[] = [],
): JournalEntry[] {
  const kept = existing.filter(e => preserveKinds.includes(e.entryKind));
  const byTx = new Map<string, JournalEntry>();
  for (const tx of transactions) {
    const je = journalFromTransaction(tx, accounts, categories);
    if (je && isJournalBalanced(je.lines)) byTx.set(tx.id, je);
  }
  return [...kept, ...byTx.values()];
}

export function openingJournalForAccount(
  account: Account,
  openingAmount: number,
  businessId: string | undefined,
  asOfDate: string,
): JournalEntry | null {
  const amt = roundMoney(Math.abs(openingAmount));
  if (amt <= 0) return null;
  const lt = inferLedgerType(account);
  const lines: JournalLine[] =
    lt === 'asset'
      ? [
          { accountId: account.id, debit: amt, credit: 0 },
          { accountId: OPENING_EQUITY_ACCOUNT_ID, debit: 0, credit: amt },
        ]
      : [
          { accountId: OPENING_EQUITY_ACCOUNT_ID, debit: amt, credit: 0 },
          { accountId: account.id, debit: 0, credit: amt },
        ];
  return {
    id: openingJournalIdForAccount(account.id),
    date: asOfDate,
    description: `Opening balance — ${account.name}`,
    businessId,
    entryKind: 'opening',
    lines,
  };
}

export function upsertOpeningJournal(
  entries: JournalEntry[],
  account: Account,
  openingAmount: number,
  businessId: string | undefined,
  asOfDate: string,
): JournalEntry[] {
  const without = entries.filter(e => e.id !== openingJournalIdForAccount(account.id));
  const je = openingJournalForAccount(account, openingAmount, businessId, asOfDate);
  if (!je) return without;
  return [...without, je];
}

export interface TrialBalanceRowComputed {
  accountId: string;
  label: string;
  ledgerType: LedgerAccountType;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

export function buildTrialBalance(
  accounts: Account[],
  categories: Category[],
  entries: JournalEntry[],
): TrialBalanceRowComputed[] {
  const ids = new Set<string>();
  for (const e of entries) {
    for (const l of e.lines) ids.add(l.accountId);
  }
  const rows: TrialBalanceRowComputed[] = [];
  for (const id of ids) {
    const lt = resolveLedgerTypeForAccountId(id, accounts, categories);
    if (!lt) continue;
    let deb = 0;
    let cre = 0;
    for (const e of entries) {
      for (const l of e.lines) {
        if (l.accountId !== id) continue;
        deb += l.debit;
        cre += l.credit;
      }
    }
    deb = roundMoney(deb);
    cre = roundMoney(cre);
    const label = (() => {
      if (id === OPENING_EQUITY_ACCOUNT_ID) return 'Opening balance equity';
      if (id.startsWith('cat:')) {
        const cat = categories.find(c => c.id === id.slice(4));
        return cat ? `${cat.name} (${cat.type})` : id;
      }
      const a = accounts.find(x => x.id === id);
      return a ? `${a.name} (${a.category})` : id;
    })();
    rows.push({
      accountId: id,
      label,
      ledgerType: lt,
      debitTotal: deb,
      creditTotal: cre,
      balance: roundMoney(lineNetForLedgerType(lt, deb, cre)),
    });
  }
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

export interface BalanceSheetSnapshot {
  assetLines: { id: string; label: string; amount: number }[];
  liabilityLines: { id: string; label: string; amount: number }[];
  equityLines: { id: string; label: string; amount: number }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  check: number;
}

export function buildBalanceSheet(
  accounts: Account[],
  categories: Category[],
  entries: JournalEntry[],
): BalanceSheetSnapshot {
  const tb = buildTrialBalance(accounts, categories, entries);
  const assetLines: BalanceSheetSnapshot['assetLines'] = [];
  const liabilityLines: BalanceSheetSnapshot['liabilityLines'] = [];
  const equityLines: BalanceSheetSnapshot['equityLines'] = [];
  let revenueNet = 0;
  let expenseNet = 0;

  for (const r of tb) {
    if (r.ledgerType === 'asset') {
      assetLines.push({ id: r.accountId, label: r.label, amount: r.balance });
    } else if (r.ledgerType === 'liability') {
      liabilityLines.push({ id: r.accountId, label: r.label, amount: r.balance });
    } else if (r.ledgerType === 'equity') {
      equityLines.push({ id: r.accountId, label: r.label, amount: r.balance });
    } else if (r.ledgerType === 'revenue') {
      revenueNet += r.balance;
    } else if (r.ledgerType === 'expense') {
      expenseNet += r.balance;
    }
  }

  const netIncome = roundMoney(revenueNet - expenseNet);
  if (Math.abs(netIncome) > 0.0001) {
    equityLines.push({
      id: 'derived:net-income',
      label: 'Net income (open P&L)',
      amount: netIncome,
    });
  }

  const totalAssets = roundMoney(assetLines.reduce((s, x) => s + x.amount, 0));
  const totalLiabilities = roundMoney(liabilityLines.reduce((s, x) => s + x.amount, 0));
  const totalEquity = roundMoney(equityLines.reduce((s, x) => s + x.amount, 0));
  const check = roundMoney(totalAssets - totalLiabilities - totalEquity);

  return {
    assetLines,
    liabilityLines,
    equityLines,
    totalAssets,
    totalLiabilities,
    totalEquity,
    check,
  };
}
