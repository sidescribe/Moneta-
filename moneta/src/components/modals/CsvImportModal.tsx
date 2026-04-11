import { useState, type ChangeEvent } from 'react';
import { Upload, X, FileSpreadsheet, AlertTriangle, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Account, Category, CategoryRule, Transaction } from '../../types';
import {
  parseCsvText,
  autoDetectMapping,
  csvRowsToTransactions,
  deduplicateTransactions,
  type CsvColumnMapping,
} from '../../lib/csvImport';

interface CsvImportModalProps {
  accounts: Account[];
  categories: Category[];
  categoryRules: CategoryRule[];
  existingTransactions: Transaction[];
  activeBusinessId: string | null;
  onClose: () => void;
  onImport: (transactions: Transaction[]) => void;
}

type Step = 'upload' | 'mapping' | 'preview';

const COLUMN_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'description', label: 'Description' },
  { value: 'amount', label: 'Amount' },
  { value: 'debit', label: 'Debit' },
  { value: 'credit', label: 'Credit' },
  { value: 'notes', label: 'Notes' },
  { value: 'ignore', label: '— Ignore —' },
] as const;

export default function CsvImportModal({
  accounts,
  categories,
  categoryRules,
  existingTransactions,
  activeBusinessId,
  onClose,
  onImport,
}: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [columnRoles, setColumnRoles] = useState<string[]>([]);
  const [accountId, setAccountId] = useState(() => {
    const active = accounts.filter(a => a.isActive);
    return active.length > 0 ? active[0].id : '';
  });
  const [error, setError] = useState('');

  const [uniqueTxs, setUniqueTxs] = useState<Transaction[]>([]);
  const [dupCount, setDupCount] = useState(0);

  const eligibleAccounts = accounts.filter(a => a.isActive);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const result = parseCsvText(text);
      if (result.headers.length === 0 || result.rows.length === 0) {
        setError('Could not parse CSV. Make sure the file has a header row and at least one data row.');
        return;
      }
      setHeaders(result.headers);
      setRows(result.rows);
      setPreview(result.preview);

      const detected = autoDetectMapping(result.headers);
      if (detected) {
        const roles = result.headers.map(() => 'ignore');
        roles[detected.date] = 'date';
        roles[detected.description] = 'description';
        if (detected.amount >= 0) roles[detected.amount] = 'amount';
        if (detected.debit != null) roles[detected.debit] = 'debit';
        if (detected.credit != null) roles[detected.credit] = 'credit';
        if (detected.notes != null) roles[detected.notes] = 'notes';
        setColumnRoles(roles);
      } else {
        setColumnRoles(result.headers.map(() => 'ignore'));
      }
      setStep('mapping');
    };
    reader.readAsText(file);
  }

  function buildMappingFromRoles(): CsvColumnMapping | null {
    const dateIdx = columnRoles.indexOf('date');
    const descIdx = columnRoles.indexOf('description');
    const amtIdx = columnRoles.indexOf('amount');
    const debitIdx = columnRoles.indexOf('debit');
    const creditIdx = columnRoles.indexOf('credit');
    const notesIdx = columnRoles.indexOf('notes');

    if (dateIdx < 0 || descIdx < 0) return null;
    if (amtIdx < 0 && debitIdx < 0 && creditIdx < 0) return null;

    return {
      date: dateIdx,
      description: descIdx,
      amount: amtIdx >= 0 ? amtIdx : -1,
      debit: debitIdx >= 0 ? debitIdx : undefined,
      credit: creditIdx >= 0 ? creditIdx : undefined,
      notes: notesIdx >= 0 ? notesIdx : undefined,
    };
  }

  function handleRoleChange(colIdx: number, role: string) {
    setColumnRoles(prev => {
      const next = [...prev];
      if (role !== 'ignore') {
        const existingIdx = next.indexOf(role);
        if (existingIdx >= 0) next[existingIdx] = 'ignore';
      }
      next[colIdx] = role;
      return next;
    });
  }

  function proceedToPreview() {
    const m = buildMappingFromRoles();
    if (!m) {
      setError('Please assign at least Date, Description, and Amount (or Debit/Credit) columns.');
      return;
    }
    setError('');

    const account = eligibleAccounts.find(a => a.id === accountId);
    const txType: 'personal' | 'business' = account?.category === 'business' ? 'business' : 'personal';
    const bizId = txType === 'business' ? (activeBusinessId ?? undefined) : undefined;

    const allTxs = csvRowsToTransactions(rows, m, accountId, bizId, txType, categories, categoryRules);
    const { unique, duplicates } = deduplicateTransactions(allTxs, existingTransactions);
    setUniqueTxs(unique);
    setDupCount(duplicates.length);
    setStep('preview');
  }

  function handleImport() {
    onImport(uniqueTxs);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60]">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-large max-h-[94dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import CSV
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100" aria-label="Close">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-xs font-medium text-neutral-400">
          <span className={step === 'upload' ? 'text-primary-600' : 'text-neutral-900'}>1. Upload</span>
          <span>→</span>
          <span className={step === 'mapping' ? 'text-primary-600' : step === 'preview' ? 'text-neutral-900' : ''}>2. Map columns</span>
          <span>→</span>
          <span className={step === 'preview' ? 'text-primary-600' : ''}>3. Preview &amp; Import</span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-2xl p-10 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
              <Upload className="w-8 h-8 text-neutral-400 mb-3" />
              <span className="text-sm font-medium text-neutral-700">
                {fileName || 'Choose a CSV file'}
              </span>
              <span className="text-xs text-neutral-400 mt-1">Bank statement exports (.csv)</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </label>

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            {/* Account selector */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Import into account</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {eligibleAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Column role assignment */}
            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">Assign each column a role</p>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="min-w-full text-sm border border-neutral-200 rounded-xl overflow-hidden">
                  <thead className="bg-neutral-50">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-neutral-600 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Role selectors */}
                    <tr className="border-t border-neutral-200 bg-primary-50/40">
                      {headers.map((_, i) => (
                        <td key={i} className="px-2 py-2">
                          <select
                            value={columnRoles[i] ?? 'ignore'}
                            onChange={e => handleRoleChange(i, e.target.value)}
                            className="w-full border border-neutral-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-primary-500"
                          >
                            {COLUMN_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>
                    {/* Preview rows */}
                    {preview.map((row, ri) => (
                      <tr key={ri} className="border-t border-neutral-100">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-neutral-600 whitespace-nowrap max-w-[200px] truncate">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <p className="text-xs text-neutral-400 mt-1">Showing first 5 of {rows.length} rows</p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setStep('upload'); setError(''); }}>
                Back
              </Button>
              <Button type="button" className="flex-1" onClick={proceedToPreview}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & confirm */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{uniqueTxs.length}</div>
                <div className="text-xs text-green-600 flex items-center justify-center gap-1 mt-1">
                  <Check className="w-3 h-3" />
                  New transactions
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">{dupCount}</div>
                <div className="text-xs text-amber-600 flex items-center justify-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  Duplicates skipped
                </div>
              </div>
            </div>

            <div className="text-sm text-neutral-600">
              Importing into <span className="font-medium text-neutral-900">{eligibleAccounts.find(a => a.id === accountId)?.name}</span>
            </div>

            {/* Preview table of unique transactions */}
            {uniqueTxs.length > 0 && (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="min-w-full text-sm border border-neutral-200 rounded-xl overflow-hidden">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-neutral-600">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-neutral-600">Description</th>
                      <th className="px-3 py-2 text-right font-medium text-neutral-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueTxs.slice(0, 5).map((tx, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        <td className="px-3 py-1.5 text-neutral-600 whitespace-nowrap">{tx.date.slice(0, 10)}</td>
                        <td className="px-3 py-1.5 text-neutral-700 max-w-[250px] truncate">{tx.description}</td>
                        <td className={`px-3 py-1.5 text-right whitespace-nowrap font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {uniqueTxs.length > 5 && (
                  <p className="text-xs text-neutral-400 mt-1">Showing first 5 of {uniqueTxs.length} transactions</p>
                )}
              </div>
            )}

            {uniqueTxs.length === 0 && (
              <div className="p-6 text-center text-neutral-500 text-sm">
                All transactions in this file already exist. Nothing to import.
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setStep('mapping'); setError(''); }}>
                Back
              </Button>
              <Button
                type="button"
                className="flex-1"
                icon={Check}
                disabled={uniqueTxs.length === 0}
                onClick={handleImport}
              >
                Import {uniqueTxs.length} transaction{uniqueTxs.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
