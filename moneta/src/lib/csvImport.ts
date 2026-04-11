import type { Transaction, Category, CategoryRule } from '../types';
import { applyRulesToTransaction } from './categoryRules';

export interface CsvColumnMapping {
  date: number;
  description: number;
  amount: number;
  debit?: number;
  credit?: number;
  notes?: number;
}

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  preview: string[][];
}

export function parseCsvText(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], preview: [] };

  const parse = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parse(lines[0]);
  const rows = lines.slice(1).map(parse).filter(r => r.length >= 2);
  return { headers, rows, preview: rows.slice(0, 5) };
}

export function autoDetectMapping(headers: string[]): CsvColumnMapping | null {
  const lower = headers.map(h => h.toLowerCase().trim());
  const dateIdx = lower.findIndex(h => /date|posted|trans.*date/i.test(h));
  const descIdx = lower.findIndex(h => /desc|memo|narration|payee|detail/i.test(h));
  const amtIdx = lower.findIndex(h => /^amount$|^value$/i.test(h));
  const debitIdx = lower.findIndex(h => /debit|withdrawal|charge/i.test(h));
  const creditIdx = lower.findIndex(h => /credit|deposit|payment/i.test(h));

  if (dateIdx < 0 || descIdx < 0) return null;
  if (amtIdx < 0 && debitIdx < 0 && creditIdx < 0) return null;

  return {
    date: dateIdx,
    description: descIdx,
    amount: amtIdx >= 0 ? amtIdx : -1,
    debit: debitIdx >= 0 ? debitIdx : undefined,
    credit: creditIdx >= 0 ? creditIdx : undefined,
  };
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDate(raw: string): string {
  // Try ISO first
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // MM/DD/YYYY or M/D/YYYY
  const mdy = raw.match(/^(\d{1,2})[/\u002d](\d{1,2})[/\u002d](\d{2,4})$/);
  if (mdy) {
    const y = mdy[3].length === 2 ? '20' + mdy[3] : mdy[3];
    return `${y}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  // Fallback: try Date constructor
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function csvRowsToTransactions(
  rows: string[][],
  mapping: CsvColumnMapping,
  accountId: string,
  businessId: string | undefined,
  type: 'personal' | 'business',
  categories: Category[],
  categoryRules: CategoryRule[],
): Transaction[] {
  return rows.map((row, i) => {
    const desc = row[mapping.description] ?? '';
    const notes = mapping.notes != null ? (row[mapping.notes] ?? '') : '';
    let amount: number;
    if (mapping.amount >= 0) {
      amount = parseAmount(row[mapping.amount] ?? '0');
    } else {
      const debit = mapping.debit != null ? parseAmount(row[mapping.debit] ?? '0') : 0;
      const credit = mapping.credit != null ? parseAmount(row[mapping.credit] ?? '0') : 0;
      amount = credit - debit;
    }
    const dateStr = parseDate(row[mapping.date] ?? '');

    const tx: Transaction = {
      id: `csv-${Date.now()}-${i}`,
      accountId,
      date: new Date(dateStr).toISOString(),
      amount,
      categoryId: '',
      description: desc,
      notes: notes || undefined,
      type,
      kind: 'income_expense',
      createdAt: Date.now(),
      businessId,
    };

    return applyRulesToTransaction(tx, categoryRules, categories);
  });
}

export function deduplicateTransactions(
  incoming: Transaction[],
  existing: Transaction[],
): { unique: Transaction[]; duplicates: Transaction[] } {
  const existingKeys = new Set(
    existing.map(t => `${t.date.slice(0, 10)}|${t.amount}|${t.description.toLowerCase().trim()}`),
  );
  const unique: Transaction[] = [];
  const duplicates: Transaction[] = [];
  for (const tx of incoming) {
    const key = `${tx.date.slice(0, 10)}|${tx.amount}|${tx.description.toLowerCase().trim()}`;
    if (existingKeys.has(key)) duplicates.push(tx);
    else { unique.push(tx); existingKeys.add(key); }
  }
  return { unique, duplicates };
}
