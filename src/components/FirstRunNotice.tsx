export interface FirstRunNoticeProps {
  open: boolean;
  onAcknowledge: () => void;
}

/** One-time modal shown until the user acknowledges the usage notice. */
export default function FirstRunNotice({ open, onAcknowledge }: FirstRunNoticeProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-md rounded-lg border border-vault-border bg-vault-panel p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xl">ℹ️</span>
          <h2 className="text-sm font-semibold text-vault-text">Before you start</h2>
        </div>
        <div className="space-y-2 text-sm text-vault-muted">
          <p>
            This tool downloads files from Vimm's Vault. Only download games you already own and
            are legally entitled to back up, for personal archival and preservation purposes.
          </p>
          <p>
            Downloads run one at a time by default to keep load on the site reasonable — please
            avoid raising concurrency unless you understand the impact.
          </p>
          <p>You're responsible for how you use this tool in your jurisdiction.</p>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onAcknowledge}
            className="rounded-md bg-vault-accent px-4 py-1.5 text-sm font-medium text-vault-bg hover:brightness-110"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}
