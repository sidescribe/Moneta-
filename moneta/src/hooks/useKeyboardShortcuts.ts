import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  onNewTransaction?: () => void;
  onFocusSearch?: () => void;
  onEscape?: () => void;
  onSaveFile?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);

  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;

      if (e.key === 'Escape') {
        h.onEscape?.();
        return;
      }

      if (inField) return;

      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        h.onFocusSearch?.();
        return;
      }

      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        h.onNewTransaction?.();
        return;
      }

      if ((e.key === 's' || e.key === 'S') && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        h.onSaveFile?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
