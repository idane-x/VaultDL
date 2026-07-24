export interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Controlled text input for filtering the current listing by title. */
export default function SearchBox({ value, onChange, placeholder }: SearchBoxProps) {
  return (
    <div className="relative w-64">
      <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-vault-muted">
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search titles…'}
        className="w-full rounded-md border border-vault-border bg-vault-panel2 py-1.5 ps-8 pe-3 text-sm text-vault-text placeholder:text-vault-muted focus:border-vault-accent focus:outline-none focus:ring-1 focus:ring-vault-accent"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute inset-y-0 end-2 flex items-center text-vault-muted hover:text-vault-text"
        >
          ✕
        </button>
      )}
    </div>
  );
}
