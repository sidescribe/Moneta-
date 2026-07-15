import { describe, expect, it } from 'vitest';
import { parseOfxText } from './ofxImport';

describe('parseOfxText', () => {
  it('parses a minimal OFX snippet with one STMTTRN', () => {
    const ofx = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260315
            <TRNAMT>-42.50
            <FITID>abc123
            <NAME>Coffee Shop
            <MEMO>Morning latte
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

    const txs = parseOfxText(ofx);

    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({
      date: '2026-03-15',
      amount: -42.5,
      description: 'Coffee Shop',
      fitid: 'abc123',
      type: 'DEBIT',
    });
  });
});
