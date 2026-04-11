interface FilePickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

interface WritableStreamLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

export interface FsFileHandle {
  createWritable(): Promise<WritableStreamLike>;
  getFile(): Promise<File>;
}

interface FsWindow {
  showSaveFilePicker(opts?: FilePickerOptions): Promise<FsFileHandle>;
  showOpenFilePicker(opts?: FilePickerOptions): Promise<FsFileHandle[]>;
}

function fsWindow(): FsWindow {
  return window as unknown as FsWindow;
}

export async function pickBackupFile(): Promise<FsFileHandle | null> {
  try {
    return await fsWindow().showSaveFilePicker({
      suggestedName: `moneta-backup-${new Date().toISOString().slice(0, 10)}.json`,
      types: [{ description: 'JSON backup', accept: { 'application/json': ['.json'] } }],
    });
  } catch {
    return null;
  }
}

export async function writeToFileHandle(
  handle: FsFileHandle,
  data: object,
): Promise<boolean> {
  try {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function pickAndReadBackupFile(): Promise<string | null> {
  try {
    const [handle] = await fsWindow().showOpenFilePicker({
      types: [{ description: 'JSON backup', accept: { 'application/json': ['.json'] } }],
    });
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

export function supportsFileSystemAccess(): boolean {
  return 'showSaveFilePicker' in window;
}
