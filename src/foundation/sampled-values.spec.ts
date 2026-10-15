import { expect } from '@open-wc/testing';

import { loadFixture } from '../testing/fixtures.js';
import { mustQuery, parseScl } from '../testing/scl.js';
import { ctInput, fixtureName, phaseFcda, stream } from '../testing/siemens.js';
import {
  sampledValueBindings,
  sampledValueRun,
  siprotecAddress,
  withoutBoundPhases
} from './sampled-values.js';

/** A value and quality FCDA of one phase of a merging unit. */
function phase(
  prefix: string,
  inst: string,
  { lnClass = 'TCTR', doName = 'AmpSv', fc = 'MX', quality = 'q' } = {}
): string {
  const data = `ldInst="MU" prefix="${prefix}" lnClass="${lnClass}" lnInst="${inst}" doName="${doName}" fc="${fc}"`;
  return `<FCDA ${data} daName="instMag.i"/><FCDA ${data} daName="${quality}"/>`;
}

function dataSet(fcdas: string): XMLDocument {
  return parseScl(`<IED name="MU"><AccessPoint name="AP"><Server>
    <LDevice inst="MU"><LN0 lnClass="LLN0" inst="" lnType="T">
      <DataSet name="DS">${fcdas}</DataSet>
    </LN0></LDevice></Server></AccessPoint></IED>`);
}

const fcdaOf = (doc: XMLDocument, prefix: string, daName = 'instMag.i'): Element =>
  mustQuery(doc, `FCDA[prefix="${prefix}"][daName="${daName}"]`);

const describeFcdas = (fcdas: Element[]): string[] =>
  fcdas.map(fcda => `${fcda.getAttribute('prefix')} ${fcda.getAttribute('daName')}`);

const fourPhases = phase('A', '1') + phase('B', '2') + phase('C', '3') + phase('N', '4');

describe('sampled values', () => {
  describe('siprotecAddress', () => {
    it('is the internal address an input has for the data of an FCDA', () => {
      const doc = dataSet(phase('A', '1'));
      expect(siprotecAddress(fcdaOf(doc, 'A'))).to.equal('AmpSv;TCTR/AmpSv/instMag.i');
      expect(siprotecAddress(fcdaOf(doc, 'A', 'q'))).to.equal('AmpSv;TCTR/AmpSv/q');
    });

    it('has empty parts for missing attributes', () => {
      const doc = dataSet('<FCDA ldInst="MU" prefix="X"/>');
      expect(siprotecAddress(mustQuery(doc, 'FCDA'))).to.equal(';//');
    });
  });

  describe('sampledValueRun', () => {
    it('has the value and quality of up to four phases, with the neutral', () => {
      const doc = dataSet(fourPhases + phase('E', '5'));
      expect(describeFcdas(sampledValueRun(fcdaOf(doc, 'A')))).to.deep.equal([
        'A instMag.i',
        'A q',
        'B instMag.i',
        'B q',
        'C instMag.i',
        'C q',
        'N instMag.i',
        'N q'
      ]);
    });

    it('starts at the value it is given', () => {
      const doc = dataSet(fourPhases);
      expect(sampledValueRun(fcdaOf(doc, 'C'))).to.have.length(4);
    });

    it('is empty when it starts at a quality', () => {
      const doc = dataSet(fourPhases);
      expect(sampledValueRun(fcdaOf(doc, 'A', 'q'))).to.deep.equal([]);
    });

    it('stops at other data, a missing quality or a decreasing instance', () => {
      expect(
        sampledValueRun(
          fcdaOf(dataSet(phase('A', '1') + phase('B', '2', { doName: 'VolSv' })), 'A')
        )
      ).to.have.length(2);
      expect(
        sampledValueRun(fcdaOf(dataSet(phase('A', '1') + phase('B', '2', { quality: 't' })), 'A'))
      ).to.have.length(2);
      expect(
        sampledValueRun(fcdaOf(dataSet(phase('A', '2') + phase('B', '1')), 'A'))
      ).to.have.length(2);
      expect(
        sampledValueRun(fcdaOf(dataSet(phase('A', 'x') + phase('B', '1')), 'A'))
      ).to.deep.equal([]);
    });

    it('is empty for data which is not measured', () => {
      expect(
        sampledValueRun(fcdaOf(dataSet(phase('A', '1', { fc: 'ST' })), 'A'))
      ).to.deep.equal([]);
    });
  });

  describe('sampledValueBindings', () => {
    let doc: XMLDocument;

    beforeEach(async () => {
      doc = await loadFixture(fixtureName);
    });

    const bindingsFrom = (ct: number, prefix: string) =>
      sampledValueBindings({
        sink: ctInput(doc, ct),
        fcda: phaseFcda(doc, prefix),
        controlBlock: stream(doc)
      });

    const describeBindings = (bindings: ReturnType<typeof bindingsFrom>) =>
      bindings.map(
        ({ sink, fcda }) =>
          `${sink.closest('LN')!.getAttribute('inst')} ${sink.getAttribute('intAddr')} > ${fcda.getAttribute('prefix')} ${fcda.getAttribute('daName')}`
      );

    it('binds the quality and the other phases, with the neutral, in order', () => {
      expect(describeBindings(bindingsFrom(1, 'I01A'))).to.deep.equal([
        '1 AmpSv;TCTR/AmpSv/q > I01A q',
        '2 AmpSv;TCTR/AmpSv/instMag.i > I01B instMag.i',
        '2 AmpSv;TCTR/AmpSv/q > I01B q',
        '3 AmpSv;TCTR/AmpSv/instMag.i > I01C instMag.i',
        '3 AmpSv;TCTR/AmpSv/q > I01C q',
        '4 AmpSv;TCTR/AmpSv/instMag.i > I01N instMag.i',
        '4 AmpSv;TCTR/AmpSv/q > I01N q'
      ]);
    });

    it('binds the following phases when starting at a later one', () => {
      expect(describeBindings(bindingsFrom(3, 'I01C'))).to.deep.equal([
        '3 AmpSv;TCTR/AmpSv/q > I01C q',
        '4 AmpSv;TCTR/AmpSv/instMag.i > I01N instMag.i',
        '4 AmpSv;TCTR/AmpSv/q > I01N q'
      ]);
    });

    it('stops where an input is missing, rather than shifting the phases', () => {
      ctInput(doc, 2).remove();
      expect(describeBindings(bindingsFrom(1, 'I01A'))).to.deep.equal([
        '1 AmpSv;TCTR/AmpSv/q > I01A q'
      ]);
    });

    it('binds nothing for a single phase', () => {
      const single = mustQuery(
        doc,
        'IED[name="SIEMENS_6MU85_001"] DataSet[name="PhsMeas3"] FCDA[ldInst="PowS_SingleCT1"][daName="instMag.i"]'
      );
      expect(
        sampledValueBindings({ sink: ctInput(doc, 1), fcda: single, controlBlock: stream(doc) })
      ).to.deep.equal([]);
    });

    it('binds nothing for an input outside a logical device', () => {
      const loose = doc.createElementNS(doc.documentElement.namespaceURI, 'ExtRef');
      expect(
        sampledValueBindings({ sink: loose, fcda: phaseFcda(doc, 'I01A'), controlBlock: stream(doc) })
      ).to.deep.equal([]);
    });

    it('does not fail for inputs in LLN0', () => {
      const lln0Doc = parseScl(`
        <IED name="R"><AccessPoint name="AP"><Server><LDevice inst="LD">
          <LN0 lnClass="LLN0" inst="" lnType="T"><Inputs>
            <ExtRef intAddr="AmpSv;TCTR/AmpSv/instMag.i"/>
            <ExtRef intAddr="AmpSv;TCTR/AmpSv/q"/>
          </Inputs></LN0>
        </LDevice></Server></AccessPoint></IED>
        <IED name="MU"><AccessPoint name="AP"><Server><LDevice inst="MU">
          <LN0 lnClass="LLN0" inst="" lnType="T">
            <DataSet name="DS">${fourPhases}</DataSet>
            <SampledValueControl name="SV" datSet="DS"/>
          </LN0></LDevice></Server></AccessPoint></IED>`);
      expect(
        sampledValueBindings({
          sink: mustQuery(lln0Doc, 'ExtRef'),
          fcda: fcdaOf(lln0Doc, 'A'),
          controlBlock: mustQuery(lln0Doc, 'SampledValueControl')
        })
      ).to.deep.equal([]);
    });
  });

  describe('withoutBoundPhases', () => {
    it('leaves out each phase with an input which has a subscription', async () => {
      const doc = await loadFixture(fixtureName);
      const bindings = sampledValueBindings({
        sink: ctInput(doc, 1),
        fcda: phaseFcda(doc, 'I01A'),
        controlBlock: stream(doc)
      });
      ctInput(doc, 3, 'q').setAttribute('iedName', 'Other');
      expect(
        withoutBoundPhases(bindings).map(({ sink }) => sink.closest('LN')!.getAttribute('inst'))
      ).to.deep.equal(['1', '2', '2', '4', '4']);
    });
  });
});
