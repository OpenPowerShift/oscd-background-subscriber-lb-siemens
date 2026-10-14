import { expect } from '@open-wc/testing';

import { mustQuery, parseScl } from '../testing/scl.js';
import { hasSubscription, isBoundTo } from './extref.js';

const doc = parseScl(`
  <IED name="MU"><AccessPoint name="AP"><Server>
    <LDevice inst="LD"><LN0 lnClass="LLN0" inst="" lnType="T">
      <DataSet name="DS">
        <FCDA ldInst="LD" prefix="P" lnClass="XCBR" lnInst="1" doName="Pos" daName="stVal" fc="ST"/>
      </DataSet>
      <GSEControl name="CB" datSet="DS"/>
      <GSEControl name="Other" datSet="DS"/>
    </LN0></LDevice>
  </Server></AccessPoint></IED>`);

const fcda = mustQuery(doc, 'FCDA');
const control = mustQuery(doc, 'GSEControl[name="CB"]');
const other = mustQuery(doc, 'GSEControl[name="Other"]');

function extRef(attributes: Record<string, string>): Element {
  const element = doc.createElementNS(doc.documentElement.namespaceURI, 'ExtRef');
  Object.entries(attributes).forEach(([name, value]) =>
    element.setAttribute(name, value)
  );
  return element;
}

const data = {
  iedName: 'MU',
  ldInst: 'LD',
  prefix: 'P',
  lnClass: 'XCBR',
  lnInst: '1',
  doName: 'Pos',
  daName: 'stVal'
};

const source = {
  serviceType: 'GOOSE',
  srcLDInst: 'LD',
  srcLNClass: 'LLN0',
  srcCBName: 'CB'
};

describe('ExtRef', () => {
  describe('hasSubscription', () => {
    it('is false for an input with only an internal address', () => {
      expect(hasSubscription(extRef({ intAddr: 'A', serviceType: 'GOOSE' }))).to.equal(false);
    });

    it('is true for a subscription or any part of one', () => {
      expect(hasSubscription(extRef(data))).to.equal(true);
      expect(hasSubscription(extRef({ srcCBName: 'CB' }))).to.equal(true);
      expect(hasSubscription(extRef({ daName: 'stVal' }))).to.equal(true);
    });
  });

  describe('isBoundTo', () => {
    it('is true for the FCDA and control block it is subscribed to', () => {
      expect(isBoundTo(extRef({ ...data, ...source }), fcda, control)).to.equal(true);
    });

    it('is false for another control block', () => {
      expect(isBoundTo(extRef({ ...data, ...source }), fcda, other)).to.equal(false);
    });

    it('is false for other data', () => {
      expect(
        isBoundTo(extRef({ ...data, ...source, daName: 'q' }), fcda, control)
      ).to.equal(false);
      expect(
        isBoundTo(extRef({ ...data, ...source, iedName: 'X' }), fcda, control)
      ).to.equal(false);
    });

    it('does not check the control block without srcCBName', () => {
      expect(isBoundTo(extRef(data), fcda, other)).to.equal(true);
    });

    it('is false for an input which is not subscribed', () => {
      expect(isBoundTo(extRef({ intAddr: 'A' }), fcda, control)).to.equal(false);
    });
  });
});
