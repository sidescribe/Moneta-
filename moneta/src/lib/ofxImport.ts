export interface OfxTransaction {
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  fitid?: string;
  type?: string;
}

export function parseOfxText(text: string): OfxTransaction[] {
  // Strip SGML headers; find <STMTTRN> blocks
  const results: OfxTransaction[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const end = block.search(/<\/STMTTRN>/i);
    const body = end >= 0 ? block.slice(0, end) : block;
    const get = (tag: string) => {
      const m = body.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const amountRaw = get('TRNAMT');
    const amount = parseFloat(amountRaw.replace(/,/g, ''));
    if (isNaN(amount)) continue;
    const dateRaw = get('DTPOSTED') || get('DTUSER');
    // OFX dates: YYYYMMDD or YYYYMMDDHHMMSS
    const y = dateRaw.slice(0, 4);
    const mo = dateRaw.slice(4, 6);
    const d = dateRaw.slice(6, 8);
    const date = y && mo && d ? `${y}-${mo}-${d}` : new Date().toISOString().slice(0, 10);
    const description = get('NAME') || get('MEMO') || get('PAYEE') || 'OFX Import';
    results.push({
      date,
      amount,
      description,
      fitid: get('FITID') || undefined,
      type: get('TRNTYPE') || undefined,
    });
  }
  return results;
}

export function isOfxFile(filename: string, text: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.ofx') || lower.endsWith('.qfx')) return true;
  return /OFXHEADER|<OFX|<STMTTRN/i.test(text.slice(0, 500));
}
