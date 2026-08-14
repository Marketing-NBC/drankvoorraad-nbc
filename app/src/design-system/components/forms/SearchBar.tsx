import { Icon, type IconName } from "../core/Icon";
import { IconButton } from "../core/IconButton";

export interface SearchBarProps {
  value: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  icon?: IconName;
  busy?: boolean;
  className?: string;
}

/**
 * Search / ask pill — leading icon, free-text input, filled submit
 * button.
 */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Zoeken…",
  icon = "search",
  busy = false,
  className = "",
}: SearchBarProps) {
  return (
    <form
      className={["nbc-searchbar", className].filter(Boolean).join(" ")}
      onSubmit={(e) => { e.preventDefault(); onSubmit && onSubmit(value); }}
    >
      <Icon name={icon} size={20} className="nbc-searchbar__icon" />
      <input
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
      />
      <IconButton icon="arrow-right" variant="filled" aria-label="Versturen" disabled={busy} />
      <style>{`
        .nbc-searchbar { display: flex; align-items: center; gap: 12px;
          background: var(--nbc-paper); border: 1px solid var(--nbc-stone-200);
          padding: 12px 12px 12px 24px; border-radius: var(--r-pill);
          box-shadow: var(--shadow-lg); }
        .nbc-searchbar__icon { color: var(--nbc-blue-dark); flex: none; }
        .nbc-searchbar input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
          font: 400 19px/1.4 var(--font-body); color: var(--fg-primary); padding: 16px 0; }
        .nbc-searchbar input::placeholder { color: var(--nbc-stone-500); }
      `}</style>
    </form>
  );
}
