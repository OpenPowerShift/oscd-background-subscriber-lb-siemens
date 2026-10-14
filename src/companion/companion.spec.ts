import { expect } from '@open-wc/testing';
import { handleEdit } from '@openscd/oscd-editor';
import { subscribe } from '@openscd/scl-lib';
import type { EditV2 } from '@openscd/oscd-api';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { loadFixture } from '../testing/fixtures.js';
import {
  fixtureName,
  phaseFcda,
  phaseStream,
  selInput,
  subscription
} from '../testing/sel.js';
import { CompanionController, respondToChange } from './companion.js';
import type { CompanionConfig, ResolvedChange } from './companion.js';
import {
  companionAnnounceEventName,
  companionWithdrawEventName,
  newCompanionRequestEvent,
  newSubscriptionChangeEvent
} from './protocol.js';
import type {
  CompanionAnnounceEvent,
  CompanionWithdrawEvent,
  SubscriptionChangeDetail
} from './protocol.js';

describe('companion', () => {
  let doc: XMLDocument;
  let applied: { edits: EditV2[]; title?: string }[];

  /**
   * A companion which binds phase B and C inputs to the second and third
   * phases of the merging unit, like the SEL rules do.
   */
  const config: CompanionConfig = {
    identity: 'test.companion',
    name: 'Test',
    description: () => 'Tests',
    features: () => ['Phases B and C'],
    isVendorIed: ied => ied.getAttribute('manufacturer') === 'SEL',
    plan: (change) => {
      const bindings = [
        { sink: selInput(doc, 'IBS'), fcda: phaseFcda(doc, 'I2') },
        { sink: selInput(doc, 'ICS'), fcda: phaseFcda(doc, 'I3') },
        // the input which was changed and a repeated one are left out
        { sink: change.extRef, fcda: change.fcda },
        { sink: selInput(doc, 'IBS'), fcda: phaseFcda(doc, 'I2') }
      ].map(binding => ({ ...binding, controlBlock: change.controlBlock }));
      return change.action === 'subscribe'
        ? { subscribe: bindings, unsubscribe: [] }
        : { subscribe: [], unsubscribe: bindings };
    },
    title: action => `Test ${action}`
  };

  beforeEach(async () => {
    doc = await loadFixture(fixtureName);
    applied = [];
  });

  /** Applies edits to the document as the Subscriber Later Binding plugin does. */
  const apply = (edits: EditV2[], options?: { title?: string }): void => {
    applied.push({ edits, title: options?.title });
    handleEdit(edits);
  };

  function change(
    overrides: Partial<SubscriptionChangeDetail> = {}
  ): SubscriptionChangeDetail {
    return {
      version: 1,
      action: 'subscribe',
      extRef: selInput(doc, 'IAS'),
      fcda: phaseFcda(doc, 'I1'),
      controlBlock: phaseStream(doc),
      settings: { ignoreSupervision: false, checkOnlyPreferredBasicType: false },
      enabledCompanions: ['other.companion', 'test.companion'],
      apply,
      ...overrides
    };
  }

  /** Subscribes inputs to phases of the merging unit, as already in the file. */
  function bind(...pairs: [string, string][]): void {
    handleEdit(
      subscribe(
        pairs.map(([intAddr, prefix]) => ({
          sink: selInput(doc, intAddr),
          source: { fcda: phaseFcda(doc, prefix), controlBlock: phaseStream(doc) }
        }))
      )
    );
  }

  const phasesOf = (): (string | undefined)[] =>
    ['IBS', 'ICS'].map(intAddr => subscription(selInput(doc, intAddr)).prefix);

  /** Supervisions of the merging unit's phase stream in the SEL relay. */
  const supervisions = (): number =>
    Array.from(
      selInput(doc, 'IAS').closest('IED')!.querySelectorAll('LN[lnClass="LSVS"] Val')
    ).filter(val => val.textContent?.endsWith('/LLN0.PhsMeas1')).length;

  describe('respondToChange', () => {
    it('subscribes what the companion plans, in one edit', () => {
      respondToChange(change(), config);
      expect(applied).to.have.length(1);
      expect(applied[0].title).to.equal('Test subscribe');
      expect(phasesOf()).to.deep.equal(['I2', 'I3']);
    });

    it('adds a supervision once for all the inputs', () => {
      respondToChange(change(), config);
      expect(supervisions()).to.equal(1);
    });

    it('leaves supervisions alone when asked to', () => {
      respondToChange(
        change({
          settings: { ignoreSupervision: true, checkOnlyPreferredBasicType: false }
        }),
        config
      );
      expect(supervisions()).to.equal(0);
    });

    it('does not change the input which was changed', () => {
      respondToChange(change(), config);
      expect(subscription(selInput(doc, 'IAS'))).to.deep.equal({});
    });

    it('does not overwrite an input which is subscribed', () => {
      bind(['ICS', 'I1']);
      respondToChange(change(), config);
      expect(phasesOf()).to.deep.equal(['I2', 'I1']);
    });

    it('unsubscribes inputs subscribed to what it expects', () => {
      bind(['IBS', 'I2'], ['ICS', 'I3']);
      respondToChange(change({ action: 'unsubscribe' }), config);
      expect(applied).to.have.length(1);
      expect(applied[0].title).to.equal('Test unsubscribe');
      expect(phasesOf()).to.deep.equal([undefined, undefined]);
    });

    it('does not unsubscribe inputs subscribed to something else', () => {
      bind(['IBS', 'I2'], ['ICS', 'I1']);
      respondToChange(change({ action: 'unsubscribe' }), config);
      expect(phasesOf()).to.deep.equal([undefined, 'I1']);
    });

    it('applies nothing when there is nothing to do', () => {
      respondToChange(change({ action: 'unsubscribe' }), config);
      bind(['IBS', 'I1'], ['ICS', 'I1']);
      respondToChange(change(), config);
      expect(applied).to.deep.equal([]);
    });

    it('does nothing when not turned on in Subscriber Later Binding', () => {
      respondToChange(change({ enabledCompanions: ['other.companion'] }), config);
      expect(applied).to.deep.equal([]);
    });

    it('does nothing for another version of the protocol', () => {
      respondToChange(change({ version: 2 }), config);
      expect(applied).to.deep.equal([]);
    });

    it('does nothing without the FCDA or control block', () => {
      respondToChange(change({ fcda: undefined }), config);
      respondToChange(change({ controlBlock: undefined }), config);
      expect(applied).to.deep.equal([]);
    });

    it('does nothing for an IED of another manufacturer', () => {
      selInput(doc, 'IAS').closest('IED')!.setAttribute('manufacturer', 'NRR');
      respondToChange(change(), config);
      expect(applied).to.deep.equal([]);
    });

    it('does nothing for an input outside an IED', () => {
      const loose = doc.createElementNS(doc.documentElement.namespaceURI, 'ExtRef');
      respondToChange(change({ extRef: loose }), config);
      expect(applied).to.deep.equal([]);
    });

    it('passes the resolved change to the plan', () => {
      let planned: ResolvedChange | undefined;
      respondToChange(change(), {
        ...config,
        plan: (resolved) => {
          planned = resolved;
          return { subscribe: [], unsubscribe: [] };
        }
      });
      expect(planned?.fcda).to.equal(phaseFcda(doc, 'I1'));
    });
  });

  describe('CompanionController', () => {
    let controllers: ReactiveController[];
    let announced: CompanionAnnounceEvent['detail'][];
    let withdrawn: CompanionWithdrawEvent['detail'][];

    const host: ReactiveControllerHost = {
      addController: (controller) => {
        controllers.push(controller);
      },
      removeController: () => undefined,
      requestUpdate: () => undefined,
      updateComplete: Promise.resolve(true)
    };

    const onAnnounce = (event: CompanionAnnounceEvent): void => {
      announced.push(event.detail);
    };
    const onWithdraw = (event: CompanionWithdrawEvent): void => {
      withdrawn.push(event.detail);
    };

    let controller: CompanionController;

    beforeEach(() => {
      controllers = [];
      announced = [];
      withdrawn = [];
      window.addEventListener(companionAnnounceEventName, onAnnounce);
      window.addEventListener(companionWithdrawEventName, onWithdraw);
      controller = new CompanionController(host, config);
    });

    afterEach(() => {
      controller.hostDisconnected();
      window.removeEventListener(companionAnnounceEventName, onAnnounce);
      window.removeEventListener(companionWithdrawEventName, onWithdraw);
    });

    it('adds itself to the host', () => {
      expect(controllers).to.deep.equal([controller]);
    });

    it('announces itself and what it does when connected and when asked', () => {
      controller.hostConnected();
      window.dispatchEvent(newCompanionRequestEvent());
      const detail = {
        version: 1,
        identity: 'test.companion',
        name: 'Test',
        description: 'Tests',
        features: ['Phases B and C']
      };
      expect(announced).to.deep.equal([detail, detail]);
    });

    it('responds to changes while connected', () => {
      controller.hostConnected();
      window.dispatchEvent(newSubscriptionChangeEvent(change()));
      expect(applied).to.have.length(1);
    });

    it('withdraws and stops listening when disconnected', () => {
      controller.hostConnected();
      controller.hostDisconnected();
      window.dispatchEvent(newSubscriptionChangeEvent(change()));
      window.dispatchEvent(newCompanionRequestEvent());
      expect(applied).to.deep.equal([]);
      expect(announced).to.have.length(1);
      expect(withdrawn).to.deep.equal([
        { version: 1, identity: 'test.companion' }
      ]);
    });
  });
});
