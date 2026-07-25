import { useMemo } from 'react';
import { CATEGORY_LABELS, SYSTEMS } from '@shared/systems';
import type { SystemCategory, VaultSystem } from '@shared/systems';
import type { SourceId } from '@shared/types';

export interface SidebarProps {
  selectedSystemCode: string | null;
  onSelectSystem: (code: string) => void;
  onOpenSettings: () => void;
  /** Systems whose sources are ALL disabled are hidden from the list entirely. */
  enabledSources: Record<SourceId, boolean>;
}

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as SystemCategory[];

const SOURCE_BADGE: Record<SourceId, string> = { vimm: 'V', romsfun: 'RF' };

/** Badge shown next to a system that's only available from a single source, or null otherwise. */
function singleSourceBadge(sys: VaultSystem): string | null {
  if (sys.sources.length !== 1) return null;
  return SOURCE_BADGE[sys.sources[0]];
}

function SystemGroup({
  title,
  systems,
  selectedSystemCode,
  onSelectSystem,
}: {
  title: string;
  systems: VaultSystem[];
  selectedSystemCode: string | null;
  onSelectSystem: (code: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-vault-muted">
        {title}
      </div>
      <ul>
        {systems.map((sys) => {
          const active = sys.code === selectedSystemCode;
          const badge = singleSourceBadge(sys);
          return (
            <li key={sys.code}>
              <button
                type="button"
                onClick={() => onSelectSystem(sys.code)}
                className={`flex w-full items-center justify-between gap-1.5 truncate rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                  active
                    ? 'bg-vault-accent/15 text-vault-text font-medium ring-1 ring-vault-accent/40'
                    : 'text-vault-muted hover:bg-vault-panel2 hover:text-vault-text'
                }`}
                title={sys.label}
              >
                <span className="truncate">{sys.label}</span>
                {badge && (
                  <span
                    className="shrink-0 rounded bg-vault-panel2 px-1 py-0.5 text-[9px] font-semibold leading-none text-vault-muted"
                    title={`${sys.label} is only available from ${sys.sources[0] === 'romsfun' ? 'RomsFun' : "Vimm's Lair"}`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Left navigation: systems grouped by category, plus a settings gear button. */
export default function Sidebar({
  selectedSystemCode,
  onSelectSystem,
  onOpenSettings,
  enabledSources,
}: SidebarProps) {
  const visibleSystems = useMemo(
    () => SYSTEMS.filter((s) => s.sources.some((src) => enabledSources[src])),
    [enabledSources],
  );

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-e border-vault-border bg-vault-panel">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗄️</span>
          <span className="text-sm font-semibold text-vault-text">Vimm's Vault</span>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="rounded-md p-1.5 text-vault-muted transition-colors hover:bg-vault-panel2 hover:text-vault-text"
        >
          ⚙️
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-3">
        {CATEGORY_ORDER.map((category) => {
          const systems = visibleSystems.filter((s) => s.category === category);
          if (systems.length === 0) return null;
          return (
            <SystemGroup
              key={category}
              title={CATEGORY_LABELS[category]}
              systems={systems}
              selectedSystemCode={selectedSystemCode}
              onSelectSystem={onSelectSystem}
            />
          );
        })}
      </div>
    </aside>
  );
}
