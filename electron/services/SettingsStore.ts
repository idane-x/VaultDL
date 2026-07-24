/**
 * SettingsStore — thin wrapper around `electron-store`, seeded from DEFAULT_SETTINGS.
 *
 * The underlying `Store` is constructed lazily on first use rather than at module load
 * time: this module is imported (transitively) by main.ts before `app.whenReady()`
 * resolves, and electron-store's constructor calls `app.getPath('userData')` eagerly.
 */
import Store from 'electron-store';
import { DEFAULT_SETTINGS, type Settings } from '@shared/types.js';

let store: Store<Settings> | null = null;

function getStore(): Store<Settings> {
  if (!store) {
    store = new Store<Settings>({
      name: 'settings',
      defaults: DEFAULT_SETTINGS,
    });
  }
  return store;
}

/** Read the full settings object, merged over defaults so new fields are never missing. */
export function getSettings(): Settings {
  const raw = getStore().store;
  return { ...DEFAULT_SETTINGS, ...raw };
}

/** Shallow-merge `patch` into the persisted settings and return the resulting full object. */
export function saveSettings(patch: Partial<Settings>): Settings {
  const next: Settings = { ...getSettings(), ...patch };
  getStore().store = next;
  return next;
}
