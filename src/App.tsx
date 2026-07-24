import { useMemo, useState } from 'react';
import type { GameListItem } from '@shared/types';
import Sidebar from './components/Sidebar';
import SectionTabs from './components/SectionTabs';
import SearchBox from './components/SearchBox';
import FilterBar from './components/FilterBar';
import GameTable from './components/GameTable';
import QueuePanel from './components/QueuePanel';
import SettingsModal from './components/SettingsModal';
import FirstRunNotice from './components/FirstRunNotice';
import { useGameListing } from './hooks/useGameListing';
import { useQueue } from './hooks/useQueue';
import { useSettings } from './hooks/useSettings';
import { applyFilters, applySearch, collectRegions, EMPTY_FILTERS } from './lib/filtering';
import type { ListingFilters } from './lib/filtering';
import { SYSTEM_BY_CODE } from '@shared/systems';

export default function App() {
  const [selectedSystemCode, setSelectedSystemCode] = useState<string>('SNES');
  const [selectedLetter, setSelectedLetter] = useState<string>('A');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingVaultId, setAddingVaultId] = useState<number | null>(null);

  const { settings, save, pickFolder } = useSettings();
  const { items, isLoading } = useGameListing(selectedSystemCode, selectedLetter);
  const { queue, enqueue, pause, resume, cancel, remove, clearFinished } = useQueue();

  const selectedSystem = SYSTEM_BY_CODE[selectedSystemCode];

  const availableRegions = useMemo(() => collectRegions(items), [items]);

  const visibleItems = useMemo(() => {
    const searched = applySearch(items, search);
    return applyFilters(searched, filters);
  }, [items, search, filters]);

  const queuedVaultIds = useMemo(() => new Set(queue.map((q) => q.vaultId)), [queue]);

  const handleSelectSystem = (code: string) => {
    setSelectedSystemCode(code);
    setSelectedLetter('A');
    setSearch('');
    setFilters(EMPTY_FILTERS);
  };

  const handleAdd = async (item: GameListItem) => {
    if (addingVaultId !== null) return;
    setAddingVaultId(item.vaultId);
    try {
      const detail = await window.vimm.getDetail(item.vaultId, selectedSystemCode);
      const media = detail.media[0];
      if (!media) return;
      await enqueue({
        vaultId: item.vaultId,
        systemCode: selectedSystemCode,
        mediaId: media.mediaId,
        altIndex: 0,
        title: item.title,
        filename: media.filename,
      });
    } catch (err) {
      // Surfaced via console for now; the queue panel reflects failures once enqueued.
      console.error('Failed to add download', err);
    } finally {
      setAddingVaultId(null);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-vault-bg text-vault-text">
      <Sidebar
        selectedSystemCode={selectedSystemCode}
        onSelectSystem={handleSelectSystem}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-vault-border bg-vault-panel px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold text-vault-text">
              {selectedSystem?.label ?? selectedSystemCode}
            </h1>
            <p className="text-xs text-vault-muted">
              {visibleItems.length} of {items.length} titles
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SearchBox value={search} onChange={setSearch} />
            <FilterBar availableRegions={availableRegions} filters={filters} onChange={setFilters} />
          </div>
        </div>

        <SectionTabs selectedLetter={selectedLetter} onSelectLetter={setSelectedLetter} />

        <GameTable
          items={visibleItems}
          isLoading={isLoading}
          onAdd={handleAdd}
          queuedVaultIds={queuedVaultIds}
        />
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
    </div>
  );
}
