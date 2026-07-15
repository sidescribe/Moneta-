'use client';
import { useState, type ChangeEvent } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '../ui/Button';

export default function ImportBackupModal({
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60]">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-large max-h-[92dvh] overflow-y-auto">
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
        <div className="flex flex-col-reverse sm:flex-row gap-2">
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
