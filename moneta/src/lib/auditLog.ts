export type AuditAction =
  | 'add_transaction'
  | 'update_transaction'
  | 'delete_transaction'
  | 'import_data'
  | 'archive_month'
  | 'unarchive_month'
  | 'add_recurring'
  | 'delete_recurring'
  | 'reconcile'
  | 'csv_import';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  description: string;
  timestamp: number;
  undoPayload?: unknown;
}

const AUDIT_KEY = 'moneta:auditLog';
const MAX_ENTRIES = 200;

export function getAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function pushAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
  const log = getAuditLog();
  const full: AuditEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  log.unshift(full);
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
  localStorage.setItem(AUDIT_KEY, JSON.stringify(log));
  return full;
}

export function clearAuditLog(): void {
  localStorage.removeItem(AUDIT_KEY);
}
