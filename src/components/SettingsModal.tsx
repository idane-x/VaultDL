import { useEffect, useState } from 'react';
import type { Settings } from '@shared/types';
import { SYSTEMS } from '@shared/systems';

export interface SettingsModalProps {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (patch: Partial<Settings>) => void | Promise<unknown>;
  onPickFolder: () => Promise<string | null>;
}

/** Edits app Settings: EmuDeck root, concurrency, extraction toggles, per-system overrides. */
export default function SettingsModal({
  open,
  settings,
  onClose,
  onSave,
  onPickFolder,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  const [overrideFilter, setOverrideFilter] = useState('');
  const [showTgdbKey, setShowTgdbKey] = useState(false);
  const [showRawgKey, setShowRawgKey] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  const handleBrowseRoot = async () => {
    const path = await onPickFolder();
    if (path) setDraft((d) => ({ ...d, emudeckRoot: path }));
  };

  const handleBrowseOverride = async (code: string) => {
    const path = await onPickFolder();
    if (path) {
      setDraft((d) => ({
        ...d,
        perSystemFolders: { ...d.perSystemFolders, [code]: path },
      }));
    }
  };

  const clearOverride = (code: string) => {
    setDraft((d) => {
      const next = { ...d.perSystemFolders };
      delete next[code];
      return { ...d, perSystemFolders: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const visibleSystems = SYSTEMS.filter((s) =>
    s.label.toLowerCase().includes(overrideFilter.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-vault-border bg-vault-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-vault-border px-4 py-3">
          <h2 className="text-sm font-semibold text-vault-text">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md p-1 text-vault-muted hover:bg-vault-panel2 hover:text-vault-text"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <section>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-vault-muted">
              EmuDeck root
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={draft.emudeckRoot ?? ''}
                readOnly
                placeholder="Not set"
                className="flex-1 rounded-md border border-vault-border bg-vault-panel2 px-2 py-1.5 text-sm text-vault-text placeholder:text-vault-muted"
              />
              <button
                type="button"
                onClick={handleBrowseRoot}
                className="shrink-0 rounded-md bg-vault-panel2 px-3 py-1.5 text-sm text-vault-text hover:bg-vault-border"
              >
                Browse…
              </button>
            </div>
            <p className="mt-1 text-xs text-vault-muted">
              Targets compose as {'{root}'}/roms/{'{emudeck folder}'} per system.
            </p>
          </section>

          <section className="flex items-center justify-between">
            <div>
              <div className="text-sm text-vault-text">Concurrent downloads</div>
              <p className="text-xs text-vault-muted">Keep this low to stay polite to the site.</p>
            </div>
            <select
              value={draft.concurrency}
              onChange={(e) => setDraft((d) => ({ ...d, concurrency: Number(e.target.value) }))}
              className="rounded-md border border-vault-border bg-vault-panel2 px-2 py-1.5 text-sm text-vault-text focus:border-vault-accent focus:outline-none"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </section>

          <section className="space-y-2">
            <label className="flex items-center justify-between text-sm text-vault-text">
              <span>Auto-extract archives</span>
              <input
                type="checkbox"
                checked={draft.autoExtract}
                onChange={(e) => setDraft((d) => ({ ...d, autoExtract: e.target.checked }))}
                className="h-4 w-4 rounded border-vault-border bg-vault-panel2 accent-vault-accent"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-vault-text">
              <span>Keep archive after extracting</span>
              <input
                type="checkbox"
                checked={draft.keepArchive}
                onChange={(e) => setDraft((d) => ({ ...d, keepArchive: e.target.checked }))}
                className="h-4 w-4 rounded border-vault-border bg-vault-panel2 accent-vault-accent"
              />
            </label>
          </section>

          <section className="space-y-3 border-t border-vault-border pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-vault-muted">
              Metadata
            </div>

            <label className="flex items-center justify-between gap-3 text-sm text-vault-text">
              <span>
                <span className="block">Box art &amp; scores</span>
                <span className="block text-xs font-normal text-vault-muted">
                  Fetch cover art from TheGamesDB and Metacritic scores from RAWG.
                </span>
              </span>
              <input
                type="checkbox"
                checked={draft.metadataEnabled}
                onChange={(e) => setDraft((d) => ({ ...d, metadataEnabled: e.target.checked }))}
                className="h-4 w-4 shrink-0 rounded border-vault-border bg-vault-panel2 accent-vault-accent"
              />
            </label>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-vault-muted">
                TheGamesDB API key
              </label>
              <div className="flex gap-2">
                <input
                  type={showTgdbKey ? 'text' : 'password'}
                  value={draft.tgdbApiKey ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, tgdbApiKey: e.target.value || null }))
                  }
                  placeholder="Not set"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 rounded-md border border-vault-border bg-vault-panel2 px-2 py-1.5 text-sm text-vault-text placeholder:text-vault-muted focus:border-vault-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowTgdbKey((s) => !s)}
                  className="shrink-0 rounded-md bg-vault-panel2 px-3 py-1.5 text-sm text-vault-text hover:bg-vault-border"
                >
                  {showTgdbKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-xs text-vault-muted">
                Free — get one at forums.thegamesdb.net (API Key Request board). Used for box
                art.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-vault-muted">
                RAWG API key
              </label>
              <div className="flex gap-2">
                <input
                  type={showRawgKey ? 'text' : 'password'}
                  value={draft.rawgApiKey ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, rawgApiKey: e.target.value || null }))
                  }
                  placeholder="Not set"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 rounded-md border border-vault-border bg-vault-panel2 px-2 py-1.5 text-sm text-vault-text placeholder:text-vault-muted focus:border-vault-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowRawgKey((s) => !s)}
                  className="shrink-0 rounded-md bg-vault-panel2 px-3 py-1.5 text-sm text-vault-text hover:bg-vault-border"
                >
                  {showRawgKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-xs text-vault-muted">
                Free — get one at rawg.io/apidocs. Used for Metacritic scores.
              </p>
            </div>

            {draft.metadataEnabled && !draft.tgdbApiKey?.trim() && !draft.rawgApiKey?.trim() && (
              <p className="rounded-md bg-vault-panel2 px-2.5 py-1.5 text-xs text-vault-muted">
                No keys set — box art and scores will show placeholders until you add at least
                one.
              </p>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-vault-muted">
                Per-system folder overrides
              </label>
            </div>
            <input
              type="text"
              value={overrideFilter}
              onChange={(e) => setOverrideFilter(e.target.value)}
              placeholder="Filter systems…"
              className="mb-2 w-full rounded-md border border-vault-border bg-vault-panel2 px-2 py-1.5 text-sm text-vault-text placeholder:text-vault-muted focus:border-vault-accent focus:outline-none"
            />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-vault-border p-1.5">
              {visibleSystems.map((sys) => {
                const override = draft.perSystemFolders[sys.code];
                return (
                  <div
                    key={sys.code}
                    className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-vault-panel2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-vault-text">{sys.label}</div>
                      <div className="truncate text-vault-muted">{override ?? 'Default'}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => handleBrowseOverride(sys.code)}
                        className="rounded px-2 py-1 text-vault-accent hover:bg-vault-panel"
                      >
                        Browse…
                      </button>
                      {override && (
                        <button
                          type="button"
                          onClick={() => clearOverride(sys.code)}
                          className="rounded px-2 py-1 text-vault-muted hover:bg-vault-panel hover:text-vault-text"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-vault-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-vault-muted hover:bg-vault-panel2 hover:text-vault-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-vault-accent px-3 py-1.5 text-sm font-medium text-vault-bg hover:brightness-110 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
