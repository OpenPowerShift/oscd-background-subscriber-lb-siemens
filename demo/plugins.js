import OscdMenuOpen from '@omicronenergy/oscd-menu-open';
import OscdMenuSave from '@omicronenergy/oscd-menu-save';

// built from src/ by `tsc --watch` when serving from source and by `npm run
// bundle` before the demo is bundled
import OscdBackgroundSubscriberLbSiemens from '../dist/oscd-background-subscriber-lb-siemens.js';

const deployedLaterBinding =
  'https://openpowershift.github.io/oscd-editor-subscriber-later-binding/oscd-editor-subscriber-later-binding.js';

// a build of a local checkout, after `npm link ../oscd-editor-subscriber-later-binding`
const linkedLaterBinding =
  '/node_modules/@openpowershift/oscd-editor-subscriber-later-binding/dist/oscd-editor-subscriber-later-binding.js';

async function isLinked() {
  if (!['localhost', '127.0.0.1'].includes(document.location.hostname)) {
    return false;
  }
  try {
    return (await fetch(linkedLaterBinding, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

/**
 * The Subscriber Later Binding plugin this plugin works with: the one given with
 * `?laterBinding=<url>`, else a linked local build when serving locally, else
 * the deployed one. See the README.
 */
const laterBindingSrc =
  new URL(document.location.href).searchParams.get('laterBinding') ??
  ((await isLinked()) ? linkedLaterBinding : deployedLaterBinding);

/**
 * The shell shows plugins in its own scoped registry, so they are defined there.
 * @param registry - the registry of the `oscd-shell`.
 */
export function definePlugins(registry) {
  registry.define('oscd-menu-open', OscdMenuOpen);
  registry.define('oscd-menu-save', OscdMenuSave);
  registry.define('oscd-background-subscriber-lb-siemens', OscdBackgroundSubscriberLbSiemens);
}

export const plugins = {
  menu: [
    {
      name: 'Open File',
      translations: { de: 'Datei öffnen' },
      icon: 'folder_open',
      tagName: 'oscd-menu-open'
    },
    {
      name: 'Save File',
      translations: { de: 'Datei speichern' },
      icon: 'save',
      requireDoc: true,
      tagName: 'oscd-menu-save'
    }
  ],
  editor: [
    {
      name: 'Subscriber Later Binding',
      translations: {
        de: 'Späte Bindung des Abonnenten',
        pt: 'Associação Tardia de Assinante'
      },
      icon: 'link',
      requireDoc: true,
      src: laterBindingSrc
    },
    {
      name: 'Source Editor',
      translations: { de: 'Quelltext-Editor' },
      icon: 'data_object',
      requireDoc: true,
      src: 'https://omicronenergyoss.github.io/oscd-editor-source/oscd-editor-source.js'
    }
  ],
  background: [
    {
      name: 'Subscriber Later Binding - Siemens',
      translations: {
        de: 'Späte Bindung des Abonnenten - Siemens',
        pt: 'Associação Tardia de Assinante - Siemens'
      },
      icon: 'none',
      requireDoc: true,
      tagName: 'oscd-background-subscriber-lb-siemens'
    }
  ]
};
