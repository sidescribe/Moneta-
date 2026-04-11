import type { Transaction, Category } from '../types';

export interface TaxLineItem {
  scheduleC: string;
  categoryNames: string[];
  total: number;
}

export interface TaxSummary {
  year: number;
  grossIncome: number;
  lineItems: TaxLineItem[];
  totalDeductions: number;
  netProfit: number;
}

const SCHEDULE_C_MAPPING: Record<string, { line: string; keywords: string[] }> = {
  'Advertising': { line: 'Line 8 - Advertising', keywords: ['marketing', 'advertising', 'ads'] },
  'Car and truck': { line: 'Line 9 - Car and truck expenses', keywords: ['transportation', 'gas', 'fuel', 'car', 'uber', 'lyft'] },
  'Contract labor': { line: 'Line 11 - Contract labor', keywords: ['contractor', 'freelance', 'contract'] },
  'Insurance': { line: 'Line 15 - Insurance', keywords: ['insurance'] },
  'Legal and professional': { line: 'Line 17 - Legal and professional', keywords: ['legal', 'professional', 'attorney', 'accountant', 'cpa'] },
  'Office expense': { line: 'Line 18 - Office expense', keywords: ['office', 'supplies', 'stationery'] },
  'Rent or lease': { line: 'Line 20b - Rent or lease (other)', keywords: ['rent', 'lease', 'coworking'] },
  'Taxes and licenses': { line: 'Line 23 - Taxes and licenses', keywords: ['tax', 'license', 'permit', 'registration'] },
  'Travel': { line: 'Line 24a - Travel', keywords: ['travel', 'flight', 'hotel', 'airbnb'] },
  'Meals': { line: 'Line 24b - Deductible meals', keywords: ['meal', 'food', 'restaurant', 'dining', 'coffee'] },
  'Utilities': { line: 'Line 25 - Utilities', keywords: ['utility', 'utilities', 'electric', 'water', 'internet', 'phone'] },
  'Software/SaaS': { line: 'Line 27a - Other (software/SaaS)', keywords: ['software', 'saas', 'hosting', 'cloud', 'subscription', 'api'] },
  'Other expenses': { line: 'Line 27a - Other expenses', keywords: [] },
};

function classifyCategory(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  for (const [key, { keywords }] of Object.entries(SCHEDULE_C_MAPPING)) {
    if (keywords.some(k => lower.includes(k))) return key;
  }
  return 'Other expenses';
}

export function buildTaxSummary(
  transactions: Transaction[],
  categories: Category[],
  year: number,
): TaxSummary {
  const yearTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && t.type === 'business' && (t.kind ?? 'income_expense') !== 'transfer';
  });

  const grossIncome = yearTxs
    .filter(t => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  const expenses = yearTxs.filter(t => t.amount < 0);

  const lineMap: Record<string, { categories: Set<string>; total: number }> = {};

  for (const tx of expenses) {
    const cat = categories.find(c => c.id === tx.categoryId);
    const catName = cat?.name ?? 'Uncategorized';
    const classification = classifyCategory(catName);
    if (!lineMap[classification]) {
      lineMap[classification] = { categories: new Set(), total: 0 };
    }
    lineMap[classification].categories.add(catName);
    lineMap[classification].total += Math.abs(tx.amount);
  }

  const lineItems: TaxLineItem[] = Object.entries(lineMap)
    .map(([key, val]) => ({
      scheduleC: SCHEDULE_C_MAPPING[key]?.line ?? `Line 27a - Other (${key})`,
      categoryNames: [...val.categories],
      total: val.total,
    }))
    .sort((a, b) => b.total - a.total);

  const totalDeductions = lineItems.reduce((s, l) => s + l.total, 0);

  return {
    year,
    grossIncome,
    lineItems,
    totalDeductions,
    netProfit: grossIncome - totalDeductions,
  };
}
