import type { Account, Category, JournalEntry, Transaction } from '../types';
import { inferLedgerType, rebuildJournalFromTransactions } from './journal';

export function normalizeAccountsLedgerTypes(accounts: Account[]): Account[] {
  return accounts.map(a => ({
    ...a,
    ledgerType: a.ledgerType ?? inferLedgerType(a),
  }));
}

/** One-time upgrade: infer ledger types on registers and build posting journals from legacy transactions. */
export function migrateLedgerIfNeeded(args: {
  schemaVersion: number;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  journalEntries: JournalEntry[];
}): { accounts: Account[]; journalEntries: JournalEntry[]; nextSchemaVersion: number } {
  const normalizedAccounts = normalizeAccountsLedgerTypes(args.accounts);
  if (args.schemaVersion >= 2) {
    return {
      accounts: normalizedAccounts,
      journalEntries: args.journalEntries,
      nextSchemaVersion: args.schemaVersion,
    };
  }
  const nextJournal = rebuildJournalFromTransactions(
    args.transactions,
    normalizedAccounts,
    args.categories,
    ['opening'],
    args.journalEntries,
  );
  return {
    accounts: normalizedAccounts,
    journalEntries: nextJournal,
    nextSchemaVersion: 2,
  };
}
