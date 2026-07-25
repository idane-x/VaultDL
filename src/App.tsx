import { useEffect, useMemo, useState } from 'react';
import type { MergedRow, MetaLookup, SortOrder, SourceId } from '@shared/types';
import { SOURCE_LABELS } from '@shared/types';
import { DEFAULT_REGION_ID, DEFAULT_SORT, DEFAULT_SORT_ORDER } from '@shared/vault-filters';
import Sidebar from './components/Sidebar';
import SearchBox from './components/SearchBox';
import FilterBar from './components/FilterBar';
import ListQueryControls from './components/ListQueryControls';
import ListFooter from './components/ListFooter';
import GameTable from './components/GameTable';
import GameGrid from './components/GameGrid';
import MetaOverrideModal from './components/MetaOverrideModal';
import MetaKeyBanner from './components/MetaKeyBanner';
import QueuePanel from './components/QueuePanel';
import SettingsModal from './components/SettingsModal';
import FirstRunNotice from './components/FirstRunNotice';
import ToastStack from './components/Toast';
import { useVaultList } from './hooks/useVaultList';
import { useQueue } from './hooks/useQueue';
import { useSettings } from './hooks/useSettings';
import { useToasts } from './hooks/useToasts';
import { applyFilters, collectRegions, EMPTY_FILTERS } from './lib/filtering';
import type { ListingFilters } from './lib/filtering';
import { SYSTEM_BY_CODE } from '@shared/systems';

type ViewMode = 'table' | 'grid';

/** Search must be at least this long to trigger a global (cross-console) search request. */
const MIN_SEARCH_LENGTH = 3;
/** Debounce delay before a search-box keystroke turns into a request. */
const SEARCH_DEBOUNCE_MS = 350;

const SOURCE_ORDER: SourceId[] = ['vimm', 'romsfun'];

export default function App() {
  const [selectedSystemCode, setSelectedSystemCode] = useState<string>('SNES');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [regionId, setRegionId] = useState<string>(DEFAULT_REGION_ID);
  const [sort, setSort] = useState<string>(DEFAULT_SORT);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('table');
  const [overrideLookup, setOverrideLookup] = useState<MetaLookup | null>(null);

  const { settings, save, pickFolder } = useSettings();
  const { queue, enqueue, pause, resume, cancel, remove, clearFinished } = useQueue();
  const { toasts, pushToast, dismissToast } = useToasts();

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const trimmedSearch = debouncedSearch.trim();
  const searchMode = trimmedSearch.length >= MIN_SEARCH_LENGTH;

  const enabledSourceIds = useMemo(
    () => SOURCE_ORDER.filter((s) => settings.enabledSources[s]),
    [settings.enabledSources],
  );

  const {
    rows,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isSearch,
    errors: listErrors,
  } = useVaultList({
    systemCode: searchMode ? null : selectedSystemCode,
    q: searchMode ? trimmedSearch : null,
    regionId,
    sort,
    sortOrder,
    sources: enabledSourceIds,
  });

  const selectedSystem = SYSTEM_BY_CODE[selectedSystemCode];

  const availableRegions = useMemo(() => collectRegions(rows), [rows]);

  const visibleRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  const queuedKeys = useMemo(
    () => new Set(queue.map((q) => `${q.source}:${q.sourceRef.id}`)),
    [queue],
  );

  const showMetaKeyBanner =
    settings.metadataEnabled && !settings.tgdbApiKey?.trim() && !settings.rawgApiKey?.trim();

  const sourceErrorEntries = useMemo(
    () => Object.entries(listErrors) as [SourceId, string][],
    [listErrors],
  );

  const handleSelectSystem = (code: string) => {
    setSelectedSystemCode(code);
    setSearchInput('');
    setDebouncedSearch('');
    setFilters(EMPTY_FILTERS);
  };

  const handleAdd = async (row: MergedRow, source: SourceId) => {
    if (addingKey !== null) return;
    const item = row.sources[source];
    if (!item) return;

    const systemCode = item.systemCode;
    if (!systemCode) {
      pushToast({
        variant: 'error',
        message: `Can't download "${row.title}" — its system couldn't be determined.`,
      });
      return;
    }

    const key = `${source}:${item.sourceRef.id}`;
    setAddingKey(key);
    try {
      if (source === 'vimm') {
        const detail = await window.vimm.getDetail(item.vaultId, systemCode);
        const media = detail.media[0];
        if (!media) {
          pushToast({
            variant: 'error',
            message: `No downloadable file found for "${row.title}".`,
          });
          return;
        }
        await enqueue({
          source,
          sourceRef: item.sourceRef,
          vaultId: item.vaultId,
          systemCode,
          mediaId: media.mediaId,
          altIndex: 0,
          title: row.title,
          filename: media.filename,
        });
      } else {
        // romsfun has no detail endpoint — the backend resolves the concrete URL at
        // download time from sourceRef, so there's no getDetail step here.
        await enqueue({
          source,
          sourceRef: item.sourceRef,
          vaultId: item.vaultId,
          systemCode,
          title: row.title,
          filename: item.title,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const noFolderConfigured =
        !settings.emudeckRoot?.trim() && !settings.perSystemFolders[systemCode]?.trim();
      const isFolderError = message.includes('No download folder') || noFolderConfigured;

      if (isFolderError) {
        pushToast({
          variant: 'error',
          message: 'Set a download folder in Settings first',
          actionLabel: 'Open Settings',
          onAction: () => setSettingsOpen(true),
        });
      } else {
        pushToast({
          variant: 'error',
          message: `Failed to add "${row.title}": ${message}`,
        });
      }
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-vault-bg text-vault-text">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <Sidebar
        selectedSystemCode={selectedSystemCode}
        onSelectSystem={handleSelectSystem}
        onOpenSettings={() => setSettingsOpen(true)}
        enabledSources={settings.enabledSources}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vault-border bg-vault-panel px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold text-vault-text">
              {searchMode ? `Search: "${trimmedSearch}"` : (selectedSystem?.label ?? selectedSystemCode)}
            </h1>
            <p className="text-xs text-vault-muted">
              {visibleRows.length} of {rows.length} loaded
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={searchInput} onChange={setSearchInput} placeholder="Search all consoles…" />
            <ListQueryControls
              regionId={regionId}
              onRegionChange={setRegionId}
              sort={sort}
              onSortChange={setSort}
              sortOrder={sortOrder}
              onToggleSortOrder={() => setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'))}
            />
            <FilterBar availableRegions={availableRegions} filters={filters} onChange={setFilters} />
            <div className="flex items-center rounded-md border border-vault-border bg-vault-panel2 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setView('table')}
                aria-pressed={view === 'table'}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  view === 'table'
                    ? 'bg-vault-accent text-vault-bg'
                    : 'text-vault-muted hover:text-vault-text'
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  view === 'grid'
                    ? 'bg-vault-accent text-vault-bg'
                    : 'text-vault-muted hover:text-vault-text'
                }`}
              >
                Grid
              </button>
            </div>
          </div>
        </div>

        {showMetaKeyBanner && (
          <MetaKeyBanner onOpenSettings={() => setSettingsOpen(true)} />
        )}

        {sourceErrorEntries.length > 0 && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-500">
            {sourceErrorEntries.map(([source, message]) => (
              <div key={source}>
                {SOURCE_LABELS[source]} is unavailable right now ({message}).
              </div>
            ))}
          </div>
        )}

        {view === 'table' ? (
          <GameTable
            rows={visibleRows}
            isLoading={isLoading}
            showSystem={isSearch}
            metadataEnabled={settings.metadataEnabled}
            enabledSources={settings.enabledSources}
            onAdd={handleAdd}
            onOpenOverride={setOverrideLookup}
            queuedKeys={queuedKeys}
          />
        ) : (
          <GameGrid
            rows={visibleRows}
            isLoading={isLoading}
            showSystem={isSearch}
            metadataEnabled={settings.metadataEnabled}
            enabledSources={settings.enabledSources}
            onAdd={handleAdd}
            onOpenOverride={setOverrideLookup}
            queuedKeys={queuedKeys}
          />
        )}

        {!isLoading && (
          <ListFooter
            totalLoaded={rows.length}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={fetchNextPage}
          />
        )}
      </main>

      <QueuePanel
        queue={queue}
        onPause={pause}
        onResume={resume}
        onCancel={cancel}
        onRemove={remove}
        onClearFinished={clearFinished}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={save}
        onPickFolder={pickFolder}
      />

      <FirstRunNotice
        open={!settings.firstRunAcknowledged}
        onAcknowledge={() => save({ firstRunAcknowledged: true })}
      />

      <MetaOverrideModal lookup={overrideLookup} onClose={() => setOverrideLookup(null)} />
    </div>
  );
}
