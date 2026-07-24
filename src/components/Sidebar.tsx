import { SYSTEMS } from '@shared/systems';
import type { VaultSystem } from '@shared/systems';

export interface SidebarProps {
  selectedSystemCode: string | null;
  onSelectSystem: (code: string) => void;
  onOpenSettings: () => void;
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
          return (
            <li key={sys.code}>
              <button
                type="button"
                onClick={() => onSelectSystem(sys.code)}
                className={`w-full truncate rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                  active
                    ? 'bg-vault-accent/15 text-vault-text font-medium ring-1 ring-vault-accent/40'
                    : 'text-vault-muted hover:bg-vault-panel2 hover:text-vault-text'
                }`}
                title={sys.label}
              >
                {sys.label}
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
}: SidebarProps) {
  const home = SYSTEMS.filter((s) => s.category === 'home');
  const handheld = SYSTEMS.filter((s) => s.category === 'handheld');

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
        <SystemGroup
          title="Home"
          systems={home}
          selectedSystemCode={selectedSystemCode}
          onSelectSystem={onSelectSystem}
        />
        <SystemGroup
          title="Handheld"
          systems={handheld}
          selectedSystemCode={selectedSystemCode}
          onSelectSystem={onSelectSystem}
        />
      </div>
    </aside>
  );
}
