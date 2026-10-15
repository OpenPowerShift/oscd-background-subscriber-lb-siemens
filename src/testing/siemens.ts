import { mustQuery } from './scl.js';

export const fixtureName = 'SV_and_GOOSE.scd';

const relay = 'IED[name="SIEMENS_7UT85_001"]';
const mergingUnit = 'IED[name="SIEMENS_6MU85_001"]';

/** An input of a phase CT of the relay, `ct` 1 to 4, for the value or `q`. */
export function ctInput(doc: XMLDocument, ct: number, daName = 'instMag.i'): Element {
  return mustQuery(
    doc,
    `${relay} LDevice[inst="PowS_HV_PhaseCT"] LN[lnClass="TCTR"][inst="${ct}"] ExtRef[intAddr="AmpSv;TCTR/AmpSv/${daName}"]`
  );
}

/** The sampled value control block of the merging unit. */
export function stream(doc: XMLDocument): Element {
  return mustQuery(doc, `${mergingUnit} SampledValueControl[name="MSVCB01"]`);
}

/** An FCDA of the phase CTs in the stream, e.g. prefix `I01B`, for the value or `q`. */
export function phaseFcda(doc: XMLDocument, prefix: string, daName = 'instMag.i'): Element {
  return mustQuery(
    doc,
    `${mergingUnit} DataSet[name="PhsMeas3"] FCDA[ldInst="PowS_PhaseCT"][prefix="${prefix}"][daName="${daName}"]`
  );
}

/** The first input of the relay for the position `RxPos1`, for `stVal` or `q`. */
export function positionInput(doc: XMLDocument, daName = 'stVal'): Element {
  return mustQuery(doc, `${relay} ExtRef[intAddr="RxPos1;/Pos/${daName}"]`);
}

/** The GOOSE control block of the merging unit with a circuit breaker position. */
export function positionGoose(doc: XMLDocument): Element {
  return mustQuery(doc, `${mergingUnit} GSEControl[name="Ind_1"]`);
}

/** The circuit breaker position in the GOOSE, for `stVal` or `q`. */
export function positionFcda(doc: XMLDocument, daName = 'stVal'): Element {
  return mustQuery(
    doc,
    `${mergingUnit} DataSet[name="Ind_1"] FCDA[lnClass="XCBR"][daName="${daName}"]`
  );
}

export { subscription } from './sel.js';
