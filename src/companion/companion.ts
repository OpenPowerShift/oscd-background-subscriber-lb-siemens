import { subscribe, unsubscribe } from '@openscd/scl-lib';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { hasSubscription, isBoundTo } from './extref.js';
import {
  companionProtocolVersion,
  companionRequestEventName,
  newCompanionAnnounceEvent,
  newCompanionWithdrawEvent,
  subscriptionChangeEventName
} from './protocol.js';
import type {
  SubscriptionChangeDetail,
  SubscriptionChangeEvent
} from './protocol.js';

export type ChangeAction = SubscriptionChangeDetail['action'];

/** A change whose FCDA and control block are known. */
export interface ResolvedChange extends SubscriptionChangeDetail {
  fcda: Element;
  controlBlock: Element;
}

/** An ExtRef and the FCDA of a control block it belongs with. */
export interface Binding {
  sink: Element;
  fcda: Element;
  controlBlock: Element;
}

/**
 * What a companion would do for a change: the ExtRefs to subscribe, or those
 * to unsubscribe and what they are expected to be subscribed to.
 */
export interface PlannedBindings {
  subscribe: Binding[];
  unsubscribe: Binding[];
}

export interface CompanionConfig {
  /** Identifies the companion to the Subscriber Later Binding plugin. */
  identity: string;
  /** A short name shown to the user, e.g. "SEL". */
  name: string;
  /** What the companion does, shown in the settings of Subscriber Later Binding. */
  description: () => string;
  /** The things it subscribes, shown with the description. */
  features: () => string[];
  /** Whether an IED is one the companion is for. */
  isVendorIed: (ied: Element) => boolean;
  /** The manufacturer's rules: what else to subscribe or unsubscribe. */
  plan: (change: ResolvedChange) => PlannedBindings;
  /** A title for the undoable edit. */
  title: (action: ChangeAction) => string;
}

function isResolved(change: SubscriptionChangeDetail): change is ResolvedChange {
  return change.fcda !== undefined && change.controlBlock !== undefined;
}

function uniqueSinks(bindings: Binding[]): Binding[] {
  const seen = new Set<Element>();
  return bindings.filter((binding) => {
    if (seen.has(binding.sink)) {
      return false;
    }
    seen.add(binding.sink);
    return true;
  });
}

/**
 * Subscribes or unsubscribes further ExtRefs for a change made by the
 * Subscriber Later Binding plugin, through the plugin's `apply`, so that the
 * edits are part of the same undoable edit.
 *
 * A companion never overwrites: it subscribes only ExtRefs without any
 * subscription, and unsubscribes only those subscribed to what it expects.
 * @param change - what the Subscriber Later Binding plugin did.
 * @param config - the companion.
 */
export function respondToChange(
  change: SubscriptionChangeDetail,
  config: CompanionConfig
): void {
  if (
    change.version !== companionProtocolVersion ||
    !change.enabledCompanions.includes(config.identity) ||
    !isResolved(change)
  ) {
    return;
  }
  const ied = change.extRef.closest('IED');
  if (ied === null || !config.isVendorIed(ied)) {
    return;
  }

  const planned = config.plan(change);
  const title = config.title(change.action);
  const { ignoreSupervision, checkOnlyPreferredBasicType } = change.settings;
  const others = (binding: Binding): boolean => binding.sink !== change.extRef;

  const toUnsubscribe = uniqueSinks(planned.unsubscribe)
    .filter(others)
    .filter(({ sink, fcda, controlBlock }) => isBoundTo(sink, fcda, controlBlock))
    .map(({ sink }) => sink);
  if (toUnsubscribe.length > 0) {
    change.apply(unsubscribe(toUnsubscribe, { ignoreSupervision }), { title });
  }

  // worked out after any unsubscription is applied, as scl-lib compares
  // against the document as it is
  const toSubscribe = uniqueSinks(planned.subscribe)
    .filter(others)
    .filter(({ sink }) => !hasSubscription(sink))
    .map(({ sink, fcda, controlBlock }) => ({
      sink,
      source: { fcda, controlBlock }
    }));
  if (toSubscribe.length > 0) {
    change.apply(
      subscribe(toSubscribe, {
        force: false,
        ignoreSupervision,
        checkOnlyBType: checkOnlyPreferredBasicType
      }),
      { title }
    );
  }
}

/**
 * Connects a companion plugin to the Subscriber Later Binding plugin while the
 * host element is connected: it responds to changes and announces itself, with
 * what it does, so that it can be turned on and off in the settings of
 * Subscriber Later Binding.
 */
export class CompanionController implements ReactiveController {
  private readonly config: CompanionConfig;

  constructor(host: ReactiveControllerHost, config: CompanionConfig) {
    this.config = config;
    host.addController(this);
  }

  hostConnected(): void {
    window.addEventListener(subscriptionChangeEventName, this.handleChange);
    window.addEventListener(companionRequestEventName, this.handleRequest);
    this.announce();
  }

  hostDisconnected(): void {
    window.removeEventListener(subscriptionChangeEventName, this.handleChange);
    window.removeEventListener(companionRequestEventName, this.handleRequest);
    window.dispatchEvent(
      newCompanionWithdrawEvent({ identity: this.config.identity })
    );
  }

  /** Tells the Subscriber Later Binding plugin about the companion. */
  announce(): void {
    const { identity, name, description, features } = this.config;
    window.dispatchEvent(
      newCompanionAnnounceEvent({
        identity,
        name,
        description: description(),
        features: features()
      })
    );
  }

  private handleChange = (event: SubscriptionChangeEvent): void => {
    respondToChange(event.detail, this.config);
  };

  private handleRequest = (): void => {
    this.announce();
  };
}
