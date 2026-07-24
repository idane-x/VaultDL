import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

export interface UseSettingsResult {
  settings: Settings;
  loading: boolean;
  save: (patch: Partial<Settings>) => Promise<Settings>;
  /** Resolve the effective output folder for a system code via the main process. */
  resolveFolder: (systemCode: string) => Promise<string>;
  pickFolder: () => Promise<string | null>;
}

/** Loads and persists app Settings through window.vimm, with a resolveFolder helper. */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    window.vimm
      .getSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (patch: Partial<Settings>) => {
    const next = await window.vimm.saveSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const resolveFolder = useCallback((systemCode: string) => {
    return window.vimm.resolveFolder(systemCode);
  }, []);

  const pickFolder = useCallback(async () => {
    const result = await window.vimm.pickFolder();
    if (result.canceled || !result.path) return null;
    return result.path;
  }, []);

  return { settings, loading, save, resolveFolder, pickFolder };
}
