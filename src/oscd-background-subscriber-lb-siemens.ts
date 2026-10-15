import { LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { msg } from '@lit/localize';

import { CompanionController } from './companion/companion.js';
import { isSiemensIed, planSiemens, siemensIdentity } from './foundation/siemens.js';

/**
 * A background plugin which works with the Subscriber Later Binding plugin.
 * When an input of a Siemens SIPROTEC 5 relay is subscribed or unsubscribed
 * there, it subscribes or unsubscribes the inputs which belong with it: the
 * other phases of a sampled value stream and the quality of a value.
 *
 * It has no user interface of its own. It tells Subscriber Later Binding what
 * it does, which lists it in its settings, where it is turned on and off.
 */
export default class OscdBackgroundSubscriberLbSiemens extends LitElement {
  @property({ attribute: false })
  doc?: XMLDocument;

  @property()
  docName?: string;

  @property({ attribute: false })
  docVersion?: unknown;

  /** Identifies this plugin to other plugins. */
  @property({ type: String, reflect: true })
  identity = siemensIdentity;

  /** Kept so that the companion is connected while the element is. */
  protected companion = new CompanionController(this, {
    identity: siemensIdentity,
    name: 'Siemens',
    description: () =>
      msg('Subscribes and unsubscribes further inputs of Siemens SIPROTEC 5 relays'),
    features: () => [
      msg('Values: the input for their quality'),
      msg('Sampled values: the other phases and the neutral')
    ],
    isVendorIed: isSiemensIed,
    plan: planSiemens,
    title: action =>
      action === 'subscribe'
        ? msg('Siemens subscribe')
        : msg('Siemens unsubscribe')
  });

  render(): typeof nothing {
    return nothing;
  }
}
