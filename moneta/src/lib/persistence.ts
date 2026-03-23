import type { Business, Transaction, Account, Category, Recurring } from '../types/index';

type BusinessDataset = {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
};

const BUSINESSES_KEY = 'moneta:businesses';
const ACTIVE_BUSINESS_KEY = 'moneta:activeBusinessId';
const DATA_KEY_PREFIX = 'moneta:data:'; // + businessId
const RECUR_KEY_PREFIX = 'moneta:recurring:'; // + businessId

export interface PersistenceAdapter {
  getBusinesses(): Promise<Business[]>;
  addBusiness(b: Business): Promise<void>;
  updateBusiness(b: Business): Promise<void>;
  deleteBusiness(businessId: string): Promise<void>;
  getActiveBusinessId(): Promise<string | null>;
  setActiveBusinessId(businessId: string | null): Promise<void>;
  saveDataset(businessId: string, data: BusinessDataset): Promise<void>;
  loadDataset(businessId: string): Promise<BusinessDataset | null>;
  // Recurring rules
  getRecurrings(businessId: string): Promise<Recurring[]>;
  addRecurring(businessId: string, r: Recurring): Promise<void>;
  updateRecurring(businessId: string, r: Recurring): Promise<void>;
  deleteRecurring(businessId: string, recurringId: string): Promise<void>;
}

export class LocalStorageAdapter implements PersistenceAdapter {
  async getBusinesses() {
    const raw = localStorage.getItem(BUSINESSES_KEY) || '[]';
    try {
      return JSON.parse(raw) as Business[];
    } catch (e) {
      console.error('Failed to parse businesses from localStorage', e);
      return [];
    }
  }

  async addBusiness(b: Business) {
    const list = await this.getBusinesses();
    list.push(b);
    localStorage.setItem(BUSINESSES_KEY, JSON.stringify(list));
  }

  async updateBusiness(b: Business) {
    const list = await this.getBusinesses();
    const idx = list.findIndex(x => x.id === b.id);
    if (idx >= 0) list[idx] = b;
    else list.push(b);
    localStorage.setItem(BUSINESSES_KEY, JSON.stringify(list));
  }

  async deleteBusiness(businessId: string) {
    const list = (await this.getBusinesses()).filter(b => b.id !== businessId);
    localStorage.setItem(BUSINESSES_KEY, JSON.stringify(list));
    localStorage.removeItem(DATA_KEY_PREFIX + businessId);
    const active = await this.getActiveBusinessId();
    if (active === businessId) await this.setActiveBusinessId(null);
  }

  async getActiveBusinessId() {
    return localStorage.getItem(ACTIVE_BUSINESS_KEY);
  }

  async setActiveBusinessId(businessId: string | null) {
    if (businessId) localStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
    else localStorage.removeItem(ACTIVE_BUSINESS_KEY);
  }

  async saveDataset(businessId: string, data: BusinessDataset) {
    localStorage.setItem(DATA_KEY_PREFIX + businessId, JSON.stringify(data));
  }

  async loadDataset(businessId: string) {
    const raw = localStorage.getItem(DATA_KEY_PREFIX + businessId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BusinessDataset;
    } catch (e) {
      console.error('Failed to parse dataset for', businessId, e);
      return null;
    }
  }

  // Recurring rules methods
  async getRecurrings(businessId: string) {
    const raw = localStorage.getItem(RECUR_KEY_PREFIX + businessId) || '[]';
    try {
      return JSON.parse(raw) as Recurring[];
    } catch (e) {
      console.error('Failed to parse recurrings from localStorage', e);
      return [];
    }
  }

  async addRecurring(businessId: string, r: Recurring) {
    const list = await this.getRecurrings(businessId);
    list.push(r);
    localStorage.setItem(RECUR_KEY_PREFIX + businessId, JSON.stringify(list));
  }

  async updateRecurring(businessId: string, r: Recurring) {
    const list = await this.getRecurrings(businessId);
    const idx = list.findIndex(x => x.id === r.id);
    if (idx >= 0) list[idx] = r;
    else list.push(r);
    localStorage.setItem(RECUR_KEY_PREFIX + businessId, JSON.stringify(list));
  }

  async deleteRecurring(businessId: string, recurringId: string) {
    const list = (await this.getRecurrings(businessId)).filter(r => r.id !== recurringId);
    localStorage.setItem(RECUR_KEY_PREFIX + businessId, JSON.stringify(list));
  }
}

/**
 * Minimal GitHub Gist adapter. Usage: construct with a user PAT.
 * Each business can store its dataset in a gist; the gist id is saved in business.settings?.gistId
 * This implementation intentionally stays small and optimistic; a production implementation
 * would handle pagination, rate-limits, conflict resolution, and encryption of tokens.
 */
export class GitHubGistAdapter implements PersistenceAdapter {
  token: string;

  constructor(token: string) {
    this.token = token;
  }

  private authHeaders() {
    return {
      Authorization: `token ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async getBusinesses() {
    // No central index stored on GitHub; rely on local index if present.
    // Fall back to empty list — UI should sync per-business gist when configured.
    return [];
  }

  async addBusiness(b: Business) {
    const local = new LocalStorageAdapter();
    await local.addBusiness(b);
  }

  async updateBusiness(b: Business) {
    const local = new LocalStorageAdapter();
    await local.updateBusiness(b);
  }

  async getRecurrings(businessId: string) {
    const local = new LocalStorageAdapter();
    return local.getRecurrings(businessId);
  }

  async addRecurring(businessId: string, r: Recurring) {
    const local = new LocalStorageAdapter();
    return local.addRecurring(businessId, r);
  }

  async updateRecurring(businessId: string, r: Recurring) {
    const local = new LocalStorageAdapter();
    return local.updateRecurring(businessId, r);
  }

  async deleteRecurring(businessId: string, recurringId: string) {
    const local = new LocalStorageAdapter();
    return local.deleteRecurring(businessId, recurringId);
  }

  async deleteBusiness(businessId: string) {
    const local = new LocalStorageAdapter();
    await local.deleteBusiness(businessId);
  }

  async getActiveBusinessId() {
    const local = new LocalStorageAdapter();
    return local.getActiveBusinessId();
  }

  async setActiveBusinessId(businessId: string | null) {
    const local = new LocalStorageAdapter();
    return local.setActiveBusinessId(businessId);
  }

  async saveDataset(businessId: string, data: BusinessDataset) {
    const local = new LocalStorageAdapter();
    // try to update gist if gistId present in local business settings
    const businesses = await local.getBusinesses();
    const b = businesses.find(x => x.id === businessId);
    if (!b) throw new Error('Business not found locally');

    const gistPayload = {
      files: {
        ['moneta-dataset.json']: {
          content: JSON.stringify(data, null, 2),
        },
      },
      description: `Moneta dataset for ${b.name}`,
      public: false,
    } as any;

    try {
      if (b.settings && (b.settings as any).gistId) {
        // update existing gist
        const gistId = (b.settings as any).gistId as string;
        await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: this.authHeaders(),
          body: JSON.stringify({ files: gistPayload.files }),
        });
      } else {
        // create new gist
        const res = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: this.authHeaders(),
          body: JSON.stringify(gistPayload),
        });
        if (!res.ok) throw new Error('Failed to create gist');
        const json = await res.json();
        (b.settings as any) = (b.settings || {});
        (b.settings as any).gistId = json.id;
        await local.updateBusiness(b);
      }
      // also save locally as fallback
      await local.saveDataset(businessId, data);
    } catch (e) {
      console.error('GitHub gist save failed, falling back to localStorage', e);
      await local.saveDataset(businessId, data);
    }
  }

  async loadDataset(businessId: string) {
    const local = new LocalStorageAdapter();
    const businesses = await local.getBusinesses();
    const b = businesses.find(x => x.id === businessId);
    if (!b) return null;
    const gistId = (b.settings && (b.settings as any).gistId) as string | undefined;
    if (!gistId) return local.loadDataset(businessId);

    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: this.authHeaders(),
      });
      if (!res.ok) return local.loadDataset(businessId);
      const json = await res.json();
      const file = json.files && json.files['moneta-dataset.json'];
      if (!file) return local.loadDataset(businessId);
      const parsed = JSON.parse(file.content) as BusinessDataset;
      // keep a local copy
      await local.saveDataset(businessId, parsed);
      return parsed;
    } catch (e) {
      console.error('Failed to load gist, using local dataset', e);
      return local.loadDataset(businessId);
    }
  }
}

/**
 * Default persistence instance. By default uses LocalStorageAdapter.
 * Call `createPersistence({ adapter: 'gist', token })` to get a gist-enabled adapter.
 */
export function createPersistence(opts?: { adapter?: 'local' | 'gist'; token?: string }): PersistenceAdapter {
  if (opts && opts.adapter === 'gist' && opts.token) return new GitHubGistAdapter(opts.token);
  return new LocalStorageAdapter();
}

export default LocalStorageAdapter;
