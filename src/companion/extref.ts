import { matchDataAttributes, matchSrcAttributes } from '@openscd/scl-lib';

/** Attributes of an ExtRef which make up a subscription, or part of one. */
const subscriptionAttributes = [
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

/**
 * Whether an ExtRef has a subscription, or part of one, which a companion
 * must not overwrite.
 * @param extRef - an SCL ExtRef element.
 */
export function hasSubscription(extRef: Element): boolean {
  return subscriptionAttributes.some(name => extRef.hasAttribute(name));
}

/**
 * Whether an ExtRef is subscribed to an FCDA of a control block. Without
 * `srcCBName`, as in Edition 1 files, the control block is not checked.
 * @param extRef - an SCL ExtRef element.
 * @param fcda - the FCDA it may be subscribed to.
 * @param controlBlock - the control block of the FCDA.
 */
export function isBoundTo(
  extRef: Element,
  fcda: Element,
  controlBlock: Element
): boolean {
  return (
    extRef.getAttribute('iedName') === fcda.closest('IED')?.getAttribute('name') &&
    matchDataAttributes(extRef, fcda) &&
    (!extRef.hasAttribute('srcCBName') || matchSrcAttributes(extRef, controlBlock))
  );
}
