import { expect, fixture, html } from '@open-wc/testing';

import OscdBackgroundSubscriberLbSiemens from './oscd-background-subscriber-lb-siemens.js';
import { companionWithdrawEventName } from './companion/protocol.js';
import type { CompanionWithdrawEvent } from './companion/protocol.js';
import { siemensIdentity } from './foundation/siemens.js';
import { loadFixture } from './testing/fixtures.js';
import { LaterBindingStandIn } from './testing/later-binding.js';
import {
  ctInput,
  fixtureName,
  phaseFcda,
  positionFcda,
  positionGoose,
  positionInput,
  stream,
  subscription
} from './testing/siemens.js';

const tagName = 'oscd-background-subscriber-lb-siemens-spec';
if (customElements.get(tagName) === undefined) {
  customElements.define(tagName, OscdBackgroundSubscriberLbSiemens);
}

describe('Subscriber Later Binding - Siemens', () => {
  let doc: XMLDocument;
  let plugin: OscdBackgroundSubscriberLbSiemens;
  let laterBinding: LaterBindingStandIn;

  const serialize = (): string => new XMLSerializer().serializeToString(doc);

  /** The prefix of the FCDA each phase CT input is subscribed to, by CT. */
  const ctPrefixes = (daName = 'instMag.i'): (string | undefined)[] =>
    [1, 2, 3, 4].map(ct => subscription(ctInput(doc, ct, daName)).prefix);

  async function mount(): Promise<void> {
    plugin = await fixture<OscdBackgroundSubscriberLbSiemens>(
      html`<oscd-background-subscriber-lb-siemens-spec
        .doc=${doc}
        docName="siemens.scd"
      ></oscd-background-subscriber-lb-siemens-spec>`
    );
  }

  beforeEach(async () => {
    doc = await loadFixture(fixtureName);
    laterBinding = new LaterBindingStandIn();
    await mount();
  });

  afterEach(() => {
    laterBinding.disconnect();
  });

  describe('sampled values', () => {
    const subscribeFirst = (): void =>
      laterBinding.subscribe(ctInput(doc, 1), phaseFcda(doc, 'I01A'), stream(doc));

    it('subscribes the quality and the other phases, with the neutral', () => {
      subscribeFirst();
      expect(ctPrefixes()).to.deep.equal(['I01A', 'I01B', 'I01C', 'I01N']);
      expect(ctPrefixes('q')).to.deep.equal(['I01A', 'I01B', 'I01C', 'I01N']);
    });

    it('is one undoable edit with the subscription', () => {
      const before = serialize();
      subscribeFirst();
      expect(laterBinding.editor.past).to.have.length(1);
      expect(laterBinding.editor.past[0].title).to.equal('Siemens subscribe');

      laterBinding.editor.undo();
      expect(serialize()).to.equal(before);

      laterBinding.editor.redo();
      expect(ctPrefixes()).to.deep.equal(['I01A', 'I01B', 'I01C', 'I01N']);
    });

    it('unsubscribes the other phases with the first in one undoable edit', () => {
      subscribeFirst();
      const subscribed = serialize();
      laterBinding.unsubscribe(ctInput(doc, 1), phaseFcda(doc, 'I01A'));
      expect(ctPrefixes()).to.deep.equal([undefined, undefined, undefined, undefined]);
      expect(ctPrefixes('q')).to.deep.equal([undefined, undefined, undefined, undefined]);
      expect(laterBinding.editor.past[1].title).to.equal('Siemens unsubscribe');

      laterBinding.editor.undo();
      expect(serialize()).to.equal(subscribed);
    });

    it('maps the following phases from where it starts', () => {
      laterBinding.subscribe(ctInput(doc, 3), phaseFcda(doc, 'I01A'), stream(doc));
      expect(ctPrefixes()).to.deep.equal([undefined, undefined, 'I01A', 'I01B']);
    });

    it('leaves a phase with an input subscribed to something else, value and quality', () => {
      laterBinding.disabledCompanions = [siemensIdentity];
      laterBinding.subscribe(ctInput(doc, 3), phaseFcda(doc, 'I01A'), stream(doc));
      laterBinding.disabledCompanions = [];
      subscribeFirst();
      expect(ctPrefixes()).to.deep.equal(['I01A', 'I01B', 'I01A', 'I01N']);
      expect(ctPrefixes('q')).to.deep.equal(['I01A', 'I01B', undefined, 'I01N']);

      laterBinding.unsubscribe(ctInput(doc, 1), phaseFcda(doc, 'I01A'));
      expect(ctPrefixes()).to.deep.equal([undefined, undefined, 'I01A', undefined]);
    });
  });

  describe('values and their quality', () => {
    it('subscribes the quality with the value in one undoable edit', () => {
      laterBinding.subscribe(positionInput(doc), positionFcda(doc), positionGoose(doc));
      expect(subscription(positionInput(doc, 'q')).daName).to.equal('q');
      expect(laterBinding.editor.past).to.have.length(1);
    });

    it('unsubscribes the quality with the value', () => {
      laterBinding.subscribe(positionInput(doc), positionFcda(doc), positionGoose(doc));
      laterBinding.unsubscribe(positionInput(doc), positionFcda(doc));
      expect(subscription(positionInput(doc, 'q'))).to.deep.equal({});
    });

    it('follows the type check setting of Subscriber Later Binding', () => {
      laterBinding.settings = { ignoreSupervision: false, checkOnlyPreferredBasicType: true };
      laterBinding.subscribe(positionInput(doc), positionFcda(doc), positionGoose(doc));
      expect(subscription(positionInput(doc, 'q')).daName).to.equal('q');
    });
  });

  describe('when it does nothing', () => {
    it('does nothing when turned off in Subscriber Later Binding', () => {
      laterBinding.disabledCompanions = [siemensIdentity];
      laterBinding.subscribe(positionInput(doc), positionFcda(doc), positionGoose(doc));
      expect(subscription(positionInput(doc, 'q'))).to.deep.equal({});
    });

    it('does nothing for other manufacturers', () => {
      positionInput(doc).closest('IED')!.setAttribute('manufacturer', 'SEL');
      laterBinding.subscribe(positionInput(doc), positionFcda(doc), positionGoose(doc));
      expect(subscription(positionInput(doc, 'q'))).to.deep.equal({});
    });
  });

  describe('as a background plugin', () => {
    it('reflects its identity and shows nothing', () => {
      expect(plugin.getAttribute('identity')).to.equal(siemensIdentity);
      expect(plugin.shadowRoot!.childElementCount).to.equal(0);
    });

    it('tells Subscriber Later Binding what it does', () => {
      expect(laterBinding.companions.get(siemensIdentity)).to.deep.equal({
        version: 1,
        identity: siemensIdentity,
        name: 'Siemens',
        description: 'Subscribes and unsubscribes further inputs of Siemens SIPROTEC 5 relays',
        features: [
          'Values: the input for their quality',
          'Sampled values: the other phases and the neutral'
        ]
      });
    });

    it('withdraws when removed from the page', () => {
      const withdrawn: CompanionWithdrawEvent['detail'][] = [];
      const listener = (event: CompanionWithdrawEvent): void => {
        withdrawn.push(event.detail);
      };
      window.addEventListener(companionWithdrawEventName, listener);
      plugin.remove();
      window.removeEventListener(companionWithdrawEventName, listener);
      expect(withdrawn).to.deep.equal([{ version: 1, identity: siemensIdentity }]);
      expect(laterBinding.companions.has(siemensIdentity)).to.equal(false);
    });
  });
});
