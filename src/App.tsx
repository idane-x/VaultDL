import { useEffect, useMemo, useState } from 'react';
import type { GameListItem, MetaLookup, SortOrder } from '@shared/types';
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

export default function App() {
  const [selectedSystemCode, setSelectedSystemCode] = useState<string>('SNES');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [regionId, setRegionId] = useState<string>(DEFAULT_REGION_ID);
  const [sort, setSort] = useState<string>(DEFAULT_SORT);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingVaultId, setAddingVaultId] = useState<number | null>(null);
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

  const {
    items,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isSearch,
  } = useVaultList({
    systemCode: searchMode ? null : selectedSystemCode,
    q: searchMode ? trimmedSearch : null,
    regionId,
    sort,
    sortOrder,
  });

  const selectedSystem = SYSTEM_BY_CODE[selectedSystemCode];

  const availableRegions = useMemo(() => collectRegions(items), [items]);

  const visibleItems = useMemo(() => applyFilters(items, filters), [items, filters]);

  const queuedVaultIds = useMemo(() => new Set(queue.map((q) => q.vaultId)), [queue]);

  const showMetaKeyBanner =
    settings.metadataEnabled && !settings.tgdbApiKey?.trim() && !settings.rawgApiKey?.trim();

  const handleSelectSystem = (code: string) => {
    setSelectedSystemCode(code);
    setSearchInput('');
    setDebouncedSearch('');
    setFilters(EMPTY_FILTERS);
  };

  const handleAdd = async (item: GameListItem) => {
    if (addingVaultId !== null) return;
    const systemCode = item.systemCode;
    if (!systemCode) {
      pushToast({
        variant: 'error',
        message: `Can't download "${item.title}" — its system couldn't be determined.`,
      });
      return;
    }

    setAddingVaultId(item.vaultId);
    try {
      const detail = await window.vimm.getDetail(item.vaultId, systemCode);
      const media = detail.media[0];
      if (!media) {
        pushToast({
          variant: 'error',
          message: `No downloadable file found for "${item.title}".`,
        });
        return;
      }
      await enqueue({
        vaultId: item.vaultId,
        systemCode,
        mediaId: media.mediaId,
        altIndex: 0,
        title: item.title,
        filename: media.filename,
      });
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
          message: `Failed to add "${item.title}": ${message}`,
        });
      }
    } finally {
      setAddingVaultId(null);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-vault-bg text-vault-text">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <Sidebar
        selectedSystemCode={selectedSystemCode}
        onSelectSystem={handleSelectSystem}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vault-border bg-vault-panel px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold text-vault-text">
              {searchMode ? `Search: "${trimmedSearch}"` : (selectedSystem?.label ?? selectedSystemCode)}
            </h1>
            <p className="text-xs text-vault-muted">
              {visibleItems.length} of {items.length} loaded
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

        {view === 'table' ? (
          <GameTable
            items={visibleItems}
            isLoading={isLoading}
            showSystem={isSearch}
            metadataEnabled={settings.metadataEnabled}
            onAdd={handleAdd}
            onOpenOverride={setOverrideLookup}
            queuedVaultIds={queuedVaultIds}
          />
        ) : (
          <GameGrid
            items={visibleItems}
            isLoading={isLoading}
            showSystem={isSearch}
            metadataEnabled={settings.metadataEnabled}
            onAdd={handleAdd}
            onOpenOverride={setOverrideLookup}
            queuedVaultIds={queuedVaultIds}
          />
        )}

        {!isLoading && (
          <ListFooter
            totalLoaded={items.length}
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
