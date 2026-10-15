import type { Binding } from '../companion/companion.js';
import { hasSubscription } from '../companion/extref.js';

/** SIPROTEC 5 relays take four phases of a stream: A, B, C and the neutral. */
const maxPhases = 4;

function sameData(a: Element, b: Element): boolean {
  return ['ldInst', 'prefix', 'lnClass', 'lnInst', 'doName', 'fc'].every(
    name => (a.getAttribute(name) ?? '') === (b.getAttribute(name) ?? '')
  );
}

/**
 * The FCDAs of the phases of a sampled value stream which starts at an FCDA,
 * each phase a measured value followed by its quality `q`, e.g.
 * `TCTR1.AmpSv.instMag.i`, `TCTR1.AmpSv.q`, `TCTR2.AmpSv.instMag.i`, and so on.
 * The phases are in the same logical device, of the same logical node class
 * and data object, with the instance not decreasing.
 * @param firstFcda - the value FCDA of the first phase.
 * @returns the value and quality FCDAs in order, of at most four phases.
 */
export function sampledValueRun(firstFcda: Element): Element[] {
  const fcdas: Element[] = [];
  let previousInst = -Infinity;
  let value: Element | null = firstFcda;

  while (value !== null && fcdas.length < maxPhases * 2) {
    const quality: Element | null = value.nextElementSibling;
    const inst = parseInt(value.getAttribute('lnInst') ?? '', 10);
    const isPhase =
      value.tagName === 'FCDA' &&
      value.getAttribute('fc') === 'MX' &&
      value.getAttribute('daName') !== 'q' &&
      ['ldInst', 'lnClass', 'doName'].every(
        name => value!.getAttribute(name) === firstFcda.getAttribute(name)
      ) &&
      !Number.isNaN(inst) &&
      inst >= previousInst &&
      quality !== null &&
      quality.tagName === 'FCDA' &&
      quality.getAttribute('daName') === 'q' &&
      sameData(quality, value);
    if (!isPhase) {
      break;
    }
    fcdas.push(value, quality);
    previousInst = inst;
    value = quality.nextElementSibling;
  }
  return fcdas;
}

/**
 * The internal address a SIPROTEC 5 input has for the data of an FCDA, e.g.
 * `AmpSv;TCTR/AmpSv/instMag.i`.
 * @param fcda - an FCDA.
 */
export function siprotecAddress(fcda: Element): string {
  const [doName, lnClass, daName] = ['doName', 'lnClass', 'daName'].map(
    name => fcda.getAttribute(name) ?? ''
  );
  return `${doName};${lnClass}/${doName}/${daName}`;
}

/**
 * The inputs for the other phases of a sampled value input. In SIPROTEC 5
 * relays each phase is a logical node of the same logical device with an input
 * for the value and one for its quality, in the order of the stream. Starting
 * at the chosen input, the inputs of the logical device are bound in order to
 * the FCDAs of the stream while each has the internal address and logical node
 * class of its FCDA. The first which does not stops it, so that a missing input
 * cannot shift the phases.
 * @param binding - the input which was subscribed, or unsubscribed, and the
 * value FCDA of the first phase and its control block.
 * @returns the following inputs and their FCDAs, without the chosen input.
 */
export function sampledValueBindings({
  sink: extRef,
  fcda,
  controlBlock
}: Binding): Binding[] {
  const run = sampledValueRun(fcda);
  const lDevice = extRef.closest('LDevice');
  if (run.length < 4 || lDevice === null) {
    return [];
  }

  const extRefs = Array.from(lDevice.querySelectorAll('ExtRef'));
  const start = extRefs.indexOf(extRef);
  const bindings: Binding[] = [];
  for (let index = 0; index < run.length; index += 1) {
    const candidate = extRefs[start + index];
    const phaseFcda = run[index];
    if (
      candidate === undefined ||
      candidate.getAttribute('intAddr') !== siprotecAddress(phaseFcda) ||
      candidate.closest('LN0, LN')?.getAttribute('lnClass') !==
        phaseFcda.getAttribute('lnClass')
    ) {
      break;
    }
    bindings.push({ sink: candidate, fcda: phaseFcda, controlBlock });
  }
  return bindings.slice(1);
}

/**
 * The bindings without the phases of which an input already has a
 * subscription, so that the value and quality of a phase stay together.
 * @param bindings - inputs and their FCDAs, the inputs of a phase being those
 * of one logical node.
 */
export function withoutBoundPhases(bindings: Binding[]): Binding[] {
  const boundPhases = new Set(
    bindings
      .filter(({ sink }) => hasSubscription(sink))
      .map(({ sink }) => sink.closest('LN0, LN'))
  );
  return bindings.filter(({ sink }) => !boundPhases.has(sink.closest('LN0, LN')));
}
