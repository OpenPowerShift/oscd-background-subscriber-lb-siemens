import type { PlannedBindings, ResolvedChange } from '../companion/companion.js';
import { sampledValueBindings, withoutBoundPhases } from './sampled-values.js';
import { valueQualityBindings } from './value-quality.js';

export const siemensIdentity = 'openpowershift.oscd-background-subscriber-lb-siemens';


/** Whether an IED is from Siemens. */
export function isSiemensIed(ied: Element): boolean {
  return ied.getAttribute('manufacturer') === 'SIEMENS';
}

/**
 * What else to subscribe or unsubscribe for SIPROTEC 5 relays: the other
 * phases of a sampled value stream and the quality of a value. A phase with an
 * input which is already subscribed is left as it is.
 * @param change - what the Subscriber Later Binding plugin did.
 */
export function planSiemens(change: ResolvedChange): PlannedBindings {
  const binding = {
    sink: change.extRef,
    fcda: change.fcda,
    controlBlock: change.controlBlock
  };
  const phases = sampledValueBindings(binding);
  const quality = valueQualityBindings(binding);
  return change.action === 'subscribe'
    ? { subscribe: [...withoutBoundPhases(phases), ...quality], unsubscribe: [] }
    : { subscribe: [], unsubscribe: [...phases, ...quality] };
}
