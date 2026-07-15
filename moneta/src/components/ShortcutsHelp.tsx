'use client';
import { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

const SHORTCUTS = [
  { keys: 'N', label: 'New transaction' },
  { keys: '/', label: 'Search' },
  { keys: 'Esc', label: 'Close dialogs' },
  { keys: 'Ctrl+Shift+S', label: 'Save file backup' },
] as const;

export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-40 hidden sm:flex items-center justify-center min-h-10 min-w-10 h-10 w-10 bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] left-[max(1.25rem,env(safe-area-inset-left,0px))] rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-md hover:bg-neutral-50 hover:text-neutral-900 transition-colors touch-manipulation"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts"
      >
        <HelpCircle className="w-5 h-5" aria-hidden />
        <span className="sr-only">?</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-large max-h-[92dvh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-help-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="shortcuts-help-title" className="text-lg font-semibold text-neutral-900">
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-full hover:bg-neutral-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <ul className="space-y-3">
              {SHORTCUTS.map(s => (
                <li
                  key={s.keys}
                  className="flex items-center justify-between gap-4 py-2 border-b border-neutral-100 last:border-0"
                >
                  <span className="text-sm text-neutral-700">{s.label}</span>
                  <kbd className="shrink-0 px-2.5 py-1 rounded-md border border-neutral-200 bg-neutral-50 text-xs font-mono font-semibold text-neutral-800 shadow-sm">
                    {s.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
