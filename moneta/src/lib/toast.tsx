import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info' | 'undo';

export interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
  duration?: number;
  onUndo?: () => void;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind, opts?: { duration?: number; onUndo?: () => void }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with ToastProvider
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = 'info', opts?: { duration?: number; onUndo?: () => void }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = { id, message, kind, duration: opts?.duration ?? (opts?.onUndo ? 8000 : 4000), onUndo: opts?.onUndo };
    setItems(prev => [...prev.slice(-4), item]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[min(100%-2rem,24rem)] pointer-events-none">
        {items.map(item => (
          <ToastBubble key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastBubble({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (!item.duration) return;
    const t = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item.id, item.duration, onDismiss]);

  const icon =
    item.kind === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> :
    item.kind === 'error' ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" /> :
    <Info className="w-4 h-4 text-blue-500 shrink-0" />;

  return (
    <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 text-white shadow-xl border border-neutral-700 animate-slide-up">
      {icon}
      <p className="flex-1 text-sm font-medium break-words">{item.message}</p>
      {item.onUndo && (
        <button
          type="button"
          onClick={() => { item.onUndo?.(); onDismiss(item.id); }}
          className="text-sm font-semibold text-amber-300 hover:text-amber-200 shrink-0"
        >
          Undo
        </button>
      )}
      <button type="button" onClick={() => onDismiss(item.id)} className="text-neutral-400 hover:text-white shrink-0 p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
