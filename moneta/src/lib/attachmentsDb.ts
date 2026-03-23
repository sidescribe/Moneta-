const DB_NAME = 'moneta-attachments';
const DB_VERSION = 1;
const STORE = 'files';

export type AttachmentMeta = {
  id: string;
  transactionId: string;
  filename: string;
  mime: string;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

export type StoredAttachment = AttachmentMeta & { blob: Blob };

export async function saveAttachment(
  transactionId: string,
  file: File,
): Promise<string> {
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const db = await openDb();
  const record: StoredAttachment = {
    id,
    transactionId,
    filename: file.name,
    mime: file.type || 'application/octet-stream',
    createdAt: Date.now(),
    blob: file,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve(id);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getAttachment(id: string): Promise<StoredAttachment | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as StoredAttachment) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export function objectUrlForBlob(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteAttachmentsForTransaction(transactionId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const rec = cursor.value as StoredAttachment;
        if (rec.transactionId === transactionId) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function clearAllAttachments(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
