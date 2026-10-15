# Upgrade plan: oscd-background-subscriber-lb-siemens

Status: **Complete** · Branch: `upgrade` · 2026-10-14

This upgrade follows the plan of the SEL companion plugin,
[`oscd-background-subscriber-lb-sel/docs/plan.md`](https://github.com/OpenPowerShift/oscd-background-subscriber-lb-sel/blob/upgrade/docs/plan.md).
That plan holds:

- the target architecture,
- the companion protocol with Subscriber Later Binding (§2.2),
- the UI and test approach,
- the decisions taken (§10).

This document records only what is specific to Siemens.

The package is `@openpowershift/oscd-background-subscriber-lb-siemens`.

## 1. Shared with SEL and NR (copied verbatim)

- **Configs:** `package.json` scripts and devDependencies, `tsconfig.json`, `eslint.config.js`, `web-test-runner.config.js`, `lit-localize.json`, workflows, release-please, `.gitattributes`, `.gitignore`.
- **Companion core:** `src/companion/**`, including `protocol.ts`, a copy of Subscriber Later Binding's.
- **Test helpers:** `src/testing/{fixtures,scl,later-binding,sel}.ts`.
- **Fixture:** `test/fixtures/SEL_SV_and_GOOSE.scd`. The specs of the core use it, so that the core and its specs are identical in each plugin.
- **Demo:** `demo/index.html`, and `demo/plugins.js` apart from the plugin's name. The plugin is a `background` entry.

## 2. Siemens rules (`src/foundation/`)

Original behaviour was ported, with the gaps below closed.

| Rule | Behaviour |
|---|---|
| Value and quality (`value-quality.ts`) | For an FCDA that is not itself `q`, bind the input with the same name, logical node class and data object and the data attribute `q` (among the inputs of the same `Inputs`) to the `q` FCDA of the same data in the same data set. |
| Sampled values (`sampled-values.ts`) | From the chosen FCDA, take up to four phases (A, B, C, neutral), each a value then its `q`. Bind the inputs of the logical device, from the chosen one onwards, to these FCDAs in order. Each input must have the address `doName;lnClass/doName/daName` and the logical node class of its FCDA. The first mismatch stops the mapping. |
| Phase coherence (`withoutBoundPhases`) | When subscribing, a phase (logical node) with any input already subscribed is left out entirely. |

## 3. Gaps found and closed

| # | Finding | Fix |
|---|---|---|
| S1 | `subscriptionStatus` was compared with itself, so inputs were unsubscribed or overwritten whatever they were bound to | The core skips bound inputs and unsubscribes only inputs bound to the expected data |
| S2 | `extRef.closest('LN')!` threw for an input in `LLN0` | `closest('LN0, LN')`, with a spec |
| S3 | Quality subscribe hard-coded `ignoreSupervision: false`, quality unsubscribe ignored the setting, and sampled-value subscribe ignored `checkOnlyBType` | The core passes both settings on every call |
| S4 | The sampled-value threshold was `> 2` FCDAs | At least two phases (four FCDAs), the same in effect |
| S5 | One `subscribe` call per input, and one undo step per input | One batched call, applied through the protocol into one undo step |
| S6 (new) | Pairing by position kept matching after a gap, so a missing input shifted the phases | Stop at the first mismatch |
| S7 (new) | Per-input skipping could leave a phase's value bound elsewhere while its quality was mapped to a new phase | Phase coherence rule above |
| S8 (new) | `lnInst` was compared with the first FCDA, not the previous one, and `NaN` passed | Compare with the previous FCDA, and stop on `NaN` |

## 4. Worklog

- **2026-10-14:**
  - Scaffolded from SEL on branch `upgrade`, and ported and fixed the rules.
  - Translations: `de` and `pt` in `src/localization/`.
  - Verified with `npm run lint` (0 errors) and `npm test` (73 specs, 99.4% coverage, about 7 s). The bundle builds.
  - Screenshot baselines are CI-owned: add the `update-visual-baselines` label to the PR.
  - The git remote is still `danyill/oscd-subscriber-lb-siemens` and needs moving to OpenPowerShift.
- **2026-10-14, background plugin (user decision, as for SEL):**
  - The plugin has no UI and is registered as a `background` plugin.
  - It announces its name, description and features. Subscriber Later Binding lists it in its settings and turns it on or off.
  - The shared core now responds only when the plugin is in `enabledCompanions`.
  - Removed the dialog, the enabled setting, `theme.ts`, and the screenshot tests and their CI jobs.
  - Renamed from `oscd-menu-subscriber-lb-siemens` to `oscd-background-subscriber-lb-siemens` (package, file, class, tag, identity). The origin remote points at the renamed repository.

