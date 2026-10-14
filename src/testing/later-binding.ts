import { subscribe, unsubscribe, sourceControlBlock } from '@openscd/scl-lib';
import { XMLEditor } from '@openscd/oscd-editor';
import type { EditV2 } from '@openscd/oscd-api';

import {
  companionAnnounceEventName,
  companionWithdrawEventName,
  newCompanionRequestEvent,
  newSubscriptionChangeEvent
} from '../companion/protocol.js';
import type {
  ApplyOptions,
  CompanionAnnounceDetail,
  CompanionAnnounceEvent,
  CompanionSettings,
  CompanionWithdrawEvent,
  SubscriptionChangeDetail
} from '../companion/protocol.js';

/**
 * Stands in for the Subscriber Later Binding plugin as companions see it: it
 * makes a subscription or unsubscription as one undoable edit, then tells
 * companions on `window` and commits what they apply into the same edit, as
 * the host does for an edit dispatched with `squash`. Like the plugin, it
 * keeps the companions which announce themselves and turns them on unless they
 * are in `disabledCompanions`. Call `disconnect` when done with it.
 */
export class LaterBindingStandIn {
  /** The undo and redo history, as the host keeps it. */
  readonly editor = new XMLEditor();

  settings: CompanionSettings = {
    ignoreSupervision: false,
    checkOnlyPreferredBasicType: false
  };

  allowExternalPlugins = true;

  /** Identities of the companions turned off, as in the plugin's settings. */
  disabledCompanions: string[] = [];

  /** What the companions announced, by identity. */
  readonly companions = new Map<string, CompanionAnnounceDetail>();

  private readonly handleAnnounce = (event: CompanionAnnounceEvent): void => {
    this.companions.set(event.detail.identity, event.detail);
  };

  private readonly handleWithdraw = (event: CompanionWithdrawEvent): void => {
    this.companions.delete(event.detail.identity);
  };

  constructor() {
    window.addEventListener(companionAnnounceEventName, this.handleAnnounce);
    window.addEventListener(companionWithdrawEventName, this.handleWithdraw);
    this.request();
  }

  /** Stops following the companions. */
  disconnect(): void {
    window.removeEventListener(companionAnnounceEventName, this.handleAnnounce);
    window.removeEventListener(companionWithdrawEventName, this.handleWithdraw);
  }

  /** Titles of the edits companions applied, in order. */
  readonly appliedTitles: (string | undefined)[] = [];

  subscribe(extRef: Element, fcda: Element, controlBlock: Element): void {
    this.commit(
      subscribe(
        { sink: extRef, source: { fcda, controlBlock } },
        {
          force: false,
          ignoreSupervision: this.settings.ignoreSupervision,
          checkOnlyBType: this.settings.checkOnlyPreferredBasicType
        }
      )
    );
    this.notify({ action: 'subscribe', extRef, fcda, controlBlock });
  }

  /**
   * Unsubscribes an ExtRef. What it was subscribed to is passed to companions,
   * as it can only be found before the edit.
   */
  unsubscribe(extRef: Element, fcda?: Element): void {
    const controlBlock = sourceControlBlock(extRef) ?? undefined;
    this.commit(
      unsubscribe([extRef], { ignoreSupervision: this.settings.ignoreSupervision })
    );
    this.notify({ action: 'unsubscribe', extRef, fcda, controlBlock });
  }

  /** Asks companions to announce themselves. */
  request(): void {
    window.dispatchEvent(newCompanionRequestEvent());
  }

  private commit(edits: EditV2[]): void {
    this.editor.commit(edits, { title: 'Later binding' });
  }

  private notify(
    change: Pick<
      SubscriptionChangeDetail,
      'action' | 'extRef' | 'fcda' | 'controlBlock'
    >
  ): void {
    if (!this.allowExternalPlugins) {
      return;
    }
    window.dispatchEvent(
      newSubscriptionChangeEvent({
        ...change,
        settings: { ...this.settings },
        enabledCompanions: Array.from(this.companions.keys()).filter(
          identity => !this.disabledCompanions.includes(identity)
        ),
        apply: (edits: EditV2[], options?: ApplyOptions): void => {
          this.appliedTitles.push(options?.title);
          this.editor.commit(edits, { title: options?.title, squash: true });
        }
      })
    );
  }
}
