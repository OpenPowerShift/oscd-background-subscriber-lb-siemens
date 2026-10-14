import { mustQuery } from './scl.js';

export const fixtureName = 'SEL_SV_and_GOOSE.scd';

const relay = 'IED[name="SEL_SEL_487E_5S_001"]';
const mergingUnit = 'IED[name="NRR_PCS221S_001"]';

/** An input of the SEL relay by its internal address. */
export function selInput(doc: XMLDocument, intAddr: string): Element {
  return mustQuery(doc, `${relay} ExtRef[intAddr="${intAddr}"]`);
}

/** The sampled value control block of the merging unit for its phases. */
export function phaseStream(doc: XMLDocument): Element {
  return mustQuery(doc, `${mergingUnit} SampledValueControl[name="PhsMeas1"]`);
}

/** A value FCDA of the merging unit's phase data set, e.g. `I1` or `U3`. */
export function phaseFcda(doc: XMLDocument, prefix: string): Element {
  return mustQuery(
    doc,
    `${mergingUnit} DataSet[name="PhsMeas1"] FCDA[prefix="${prefix}"]:not([daName="q"])`
  );
}

/** The GOOSE control block of the merging unit with circuit breaker positions. */
export function positionGoose(doc: XMLDocument): Element {
  return mustQuery(doc, `${mergingUnit} GSEControl[name="Ind"]`);
}

/** The position of circuit breaker `inst` in the merging unit's GOOSE. */
export function positionFcda(doc: XMLDocument, inst: number): Element {
  return mustQuery(
    doc,
    `${mergingUnit} DataSet[name="Ind"] FCDA[lnClass="XCBR"][lnInst="${inst}"][daName="stVal"]`
  );
}

/** The subscription attributes of an ExtRef, for comparisons. */
export function subscription(extRef: Element): Record<string, string> {
  const names = [
    'iedName',
    'ldInst',
    'prefix',
    'lnClass',
    'lnInst',
    'doName',
    'daName',
    'srcLDInst',
    'srcPrefix',
    'srcLNClass',
    'srcLNInst',
    'srcCBName'
  ];
  return Object.fromEntries(
    names
      .filter(name => extRef.hasAttribute(name))
      .map(name => [name, extRef.getAttribute(name)!])
  );
}
