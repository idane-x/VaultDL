export interface MetaKeyBannerProps {
  onOpenSettings: () => void;
}

/**
 * Shown above the table/grid when metadata is enabled but no provider keys are set —
 * a single subtle hint instead of nagging on every row's placeholder cover.
 */
export default function MetaKeyBanner({ onOpenSettings }: MetaKeyBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-vault-border bg-vault-accent/10 px-4 py-2 text-xs text-vault-text">
      <span className="flex items-center gap-1.5">
        <span>🖼️</span>
        Add TheGamesDB &amp; RAWG API keys in Settings to show box art and scores.
      </span>
      <button
        type="button"
        onClick={onOpenSettings}
        className="shrink-0 rounded-md bg-vault-accent px-2.5 py-1 font-medium text-vault-bg hover:brightness-110"
      >
        Open Settings
      </button>
    </div>
  );
}
