import type { Binding } from '../companion/companion.js';

/** The parts of a SIPROTEC 5 internal address, e.g. `RxPos1;/Pos/stVal`. */
export interface SiprotecInput {
  /** The name of the input, e.g. `RxPos1`. */
  name: string;
  /** The logical node class, which may be empty. */
  lnClass: string;
  /** The data object, e.g. `Pos`. */
  dataObject: string;
  /** The data attribute, e.g. `stVal` or `q`. */
  dataAttribute: string;
}

/**
 * Reads the parts of a SIPROTEC 5 internal address.
 * @param intAddr - e.g. `RxPos1;/Pos/stVal` or `RxTapChg1;ATCC/TapChg/valWTr.posVal`.
 * @returns the parts, or undefined if it is not of this form.
 */
export function parseSiprotecInput(intAddr: string): SiprotecInput | undefined {
  const parts = intAddr.split(';');
  if (parts.length !== 2) {
    return undefined;
  }
  const [name, path] = parts;
  const steps = path.split('/');
  if (steps.length === 2) {
    const [dataObject, dataAttribute] = steps;
    return { name, lnClass: '', dataObject, dataAttribute };
  }
  if (steps.length === 3) {
    const [lnClass, dataObject, dataAttribute] = steps;
    return { name, lnClass, dataObject, dataAttribute };
  }
  return undefined;
}

/**
 * The FCDA for the quality of the data of an FCDA, in the same data set.
 * @param fcda - an FCDA of a value.
 */
export function qualityFcdaOf(fcda: Element): Element | undefined {
  const dataSet = fcda.parentElement;
  if (dataSet === null) {
    return undefined;
  }
  return Array.from(dataSet.children).find(
    candidate =>
      candidate.tagName === 'FCDA' &&
      candidate.getAttribute('daName') === 'q' &&
      ['ldInst', 'prefix', 'lnClass', 'lnInst', 'doName'].every(
        name =>
          (candidate.getAttribute(name) ?? '') === (fcda.getAttribute(name) ?? '')
      )
  );
}

/**
 * The input for the quality of an input, among the inputs of the same logical
 * node: the one with the same name, logical node class and data object, and
 * the data attribute `q`.
 * @param extRef - an input of a value.
 */
export function qualityInputOf(extRef: Element): Element | undefined {
  const input = parseSiprotecInput(extRef.getAttribute('intAddr') ?? '');
  const inputs = extRef.parentElement;
  if (input === undefined || inputs === null) {
    return undefined;
  }
  return Array.from(inputs.children).find((candidate) => {
    const other = parseSiprotecInput(candidate.getAttribute('intAddr') ?? '');
    return (
      candidate.tagName === 'ExtRef' &&
      other !== undefined &&
      other.name === input.name &&
      other.lnClass === input.lnClass &&
      other.dataObject === input.dataObject &&
      other.dataAttribute === 'q'
    );
  });
}

/**
 * The quality input of a value input, bound to the quality of the same data.
 * @param binding - the input which was subscribed, or unsubscribed, and its
 * FCDA and control block.
 * @returns the quality input and FCDA, if both are found.
 */
export function valueQualityBindings({
  sink: extRef,
  fcda,
  controlBlock
}: Binding): Binding[] {
  if (fcda.getAttribute('daName') === 'q') {
    return [];
  }
  const qualityFcda = qualityFcdaOf(fcda);
  const qualityInput = qualityInputOf(extRef);
  if (
    qualityFcda === undefined ||
    qualityInput === undefined ||
    qualityInput === extRef
  ) {
    return [];
  }
  return [{ sink: qualityInput, fcda: qualityFcda, controlBlock }];
}
