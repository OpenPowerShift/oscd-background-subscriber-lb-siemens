import { expect } from '@open-wc/testing';

import { loadFixture } from '../testing/fixtures.js';
import { mustQuery, parseScl } from '../testing/scl.js';
import {
  fixtureName,
  positionFcda,
  positionGoose,
  positionInput
} from '../testing/siemens.js';
import {
  parseSiprotecInput,
  qualityFcdaOf,
  qualityInputOf,
  valueQualityBindings
} from './value-quality.js';

describe('value and quality', () => {
  describe('parseSiprotecInput', () => {
    it('reads an address without a logical node class', () => {
      expect(parseSiprotecInput('RxPos1;/Pos/stVal')).to.deep.equal({
        name: 'RxPos1',
        lnClass: '',
        dataObject: 'Pos',
        dataAttribute: 'stVal'
      });
    });

    it('reads an address with a logical node class', () => {
      expect(parseSiprotecInput('RxTapChg1;ATCC/TapChg/valWTr.posVal')).to.deep.equal({
        name: 'RxTapChg1',
        lnClass: 'ATCC',
        dataObject: 'TapChg',
        dataAttribute: 'valWTr.posVal'
      });
    });

    it('reads an address of only a data object and attribute', () => {
      expect(parseSiprotecInput('RxPos1;Pos/q')).to.deep.equal({
        name: 'RxPos1',
        lnClass: '',
        dataObject: 'Pos',
        dataAttribute: 'q'
      });
    });

    it('is undefined for other addresses', () => {
      ['RxPos1', 'a;b;c', 'RxPos1;Pos', 'RxPos1;a/b/c/d', ''].forEach(intAddr =>
        expect(parseSiprotecInput(intAddr), intAddr).to.equal(undefined)
      );
    });
  });

  describe('in the fixture', () => {
    let doc: XMLDocument;

    beforeEach(async () => {
      doc = await loadFixture(fixtureName);
    });

    it('finds the quality FCDA of a value', () => {
      expect(qualityFcdaOf(positionFcda(doc))).to.equal(positionFcda(doc, 'q'));
    });

    it('finds the quality input of a value in the same logical node', () => {
      expect(qualityInputOf(positionInput(doc))).to.equal(positionInput(doc, 'q'));
    });

    it('binds the quality input to the quality of the data', () => {
      const [binding, ...others] = valueQualityBindings({
        sink: positionInput(doc),
        fcda: positionFcda(doc),
        controlBlock: positionGoose(doc)
      });
      expect(others).to.deep.equal([]);
      expect(binding).to.deep.equal({
        sink: positionInput(doc, 'q'),
        fcda: positionFcda(doc, 'q'),
        controlBlock: positionGoose(doc)
      });
    });

    it('binds nothing when the quality itself is chosen', () => {
      expect(
        valueQualityBindings({
          sink: positionInput(doc, 'q'),
          fcda: positionFcda(doc, 'q'),
          controlBlock: positionGoose(doc)
        })
      ).to.deep.equal([]);
    });
  });

  describe('in other SCL', () => {
    const doc = parseScl(`
      <IED name="P"><AccessPoint name="AP"><Server><LDevice inst="LD">
        <LN0 lnClass="LLN0" inst="" lnType="T">
          <DataSet name="DS">
            <FCDA ldInst="LD" lnClass="XCBR" lnInst="1" doName="Pos" daName="stVal" fc="ST"/>
            <FCDA ldInst="LD" lnClass="XCBR" lnInst="2" doName="Pos" daName="q" fc="ST"/>
            <FCDA ldInst="LD" lnClass="XCBR" lnInst="3" doName="Pos" daName="stVal" fc="ST"/>
          </DataSet>
          <GSEControl name="CB" datSet="DS"/>
        </LN0>
      </LDevice></Server></AccessPoint></IED>
      <IED name="S"><AccessPoint name="AP"><Server><LDevice inst="LD">
        <LN0 lnClass="LLN0" inst="" lnType="T">
          <Inputs>
            <ExtRef intAddr="RxPos1;/Pos/stVal"/>
            <ExtRef intAddr="RxPos2;/Pos/q"/>
            <ExtRef intAddr="Other"/>
          </Inputs>
        </LN0>
        <LN lnClass="XCBR" inst="1" lnType="T">
          <Inputs><ExtRef intAddr="RxPos1;/Pos/q"/></Inputs>
        </LN>
      </LDevice></Server></AccessPoint></IED>`);

    const fcda = (inst: string) => mustQuery(doc, `FCDA[lnInst="${inst}"]`);
    const input = (intAddr: string) => mustQuery(doc, `LN0 ExtRef[intAddr="${intAddr}"]`);

    it('finds no quality FCDA of other data', () => {
      expect(qualityFcdaOf(fcda('1'))).to.equal(undefined);
    });

    it('finds no quality FCDA outside a data set', () => {
      const loose = doc.createElementNS(doc.documentElement.namespaceURI, 'FCDA');
      expect(qualityFcdaOf(loose)).to.equal(undefined);
    });

    it('finds no quality input of another name or logical node', () => {
      expect(qualityInputOf(input('RxPos1;/Pos/stVal'))).to.equal(undefined);
    });

    it('finds no quality input for an address of another form', () => {
      expect(qualityInputOf(input('Other'))).to.equal(undefined);
    });

    it('binds nothing without a quality FCDA', () => {
      expect(
        valueQualityBindings({
          sink: input('RxPos1;/Pos/stVal'),
          fcda: fcda('3'),
          controlBlock: mustQuery(doc, 'GSEControl')
        })
      ).to.deep.equal([]);
    });
  });
});
