import { expect } from '@open-wc/testing';

import { loadFixture } from '../testing/fixtures.js';
import {
  ctInput,
  fixtureName,
  phaseFcda,
  positionFcda,
  positionGoose,
  positionInput,
  stream
} from '../testing/siemens.js';
import { isSiemensIed, planSiemens } from './siemens.js';

describe('Siemens', () => {
  let doc: XMLDocument;

  beforeEach(async () => {
    doc = await loadFixture(fixtureName);
  });

  const change = (
    action: 'subscribe' | 'unsubscribe',
    extRef: Element,
    fcda: Element,
    controlBlock: Element
  ) => ({
    version: 1,
    action,
    extRef,
    fcda,
    controlBlock,
    settings: { ignoreSupervision: false, checkOnlyPreferredBasicType: false },
    enabledCompanions: [],
    apply: () => undefined
  });

  describe('isSiemensIed', () => {
    it('is true only for the manufacturer "SIEMENS"', () => {
      const ied = doc.createElementNS(doc.documentElement.namespaceURI, 'IED');
      ['Siemens', 'SIEMENS AG', 'SEL'].forEach((manufacturer) => {
        ied.setAttribute('manufacturer', manufacturer);
        expect(isSiemensIed(ied), manufacturer).to.equal(false);
      });
      ied.setAttribute('manufacturer', 'SIEMENS');
      expect(isSiemensIed(ied)).to.equal(true);
    });
  });

  describe('planSiemens', () => {
    it('subscribes the quality of a value', () => {
      const planned = planSiemens(
        change('subscribe', positionInput(doc), positionFcda(doc), positionGoose(doc))
      );
      expect(planned.subscribe.map(({ sink }) => sink)).to.deep.equal([
        positionInput(doc, 'q')
      ]);
      expect(planned.unsubscribe).to.deep.equal([]);
    });

    it('unsubscribes the phases of a sampled value input', () => {
      const planned = planSiemens(
        change('unsubscribe', ctInput(doc, 1), phaseFcda(doc, 'I01A'), stream(doc))
      );
      expect(planned.subscribe).to.deep.equal([]);
      expect(planned.unsubscribe).to.have.length(8);
    });
  });
});
