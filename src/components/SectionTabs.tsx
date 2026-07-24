import { SECTION_LETTERS } from '@shared/systems';

export interface SectionTabsProps {
  selectedLetter: string;
  onSelectLetter: (letter: string) => void;
}

/** A–Z + '#' letter tab strip for the currently selected system. */
export default function SectionTabs({ selectedLetter, onSelectLetter }: SectionTabsProps) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-vault-border bg-vault-panel px-3 py-2">
      {SECTION_LETTERS.map((letter) => {
        const active = letter === selectedLetter;
        return (
          <button
            key={letter}
            type="button"
            onClick={() => onSelectLetter(letter)}
            className={`h-7 min-w-[1.75rem] rounded-md px-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-vault-accent text-vault-bg'
                : 'text-vault-muted hover:bg-vault-panel2 hover:text-vault-text'
            }`}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
