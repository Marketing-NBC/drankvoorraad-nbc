import { useEffect, useState } from "react";
import { Input } from "../../design-system";

/**
 * Omzet wordt pas opgeslagen wanneer het veld de focus verliest (of bij Enter),
 * niet bij elke toetsaanslag — dat scheelt een databaseschrijfactie per teken.
 */
export function OmzetInput({ value, onSave }: { value: number; onSave: (value: number) => void }) {
  const [lokaal, setLokaal] = useState(value === 0 ? "" : String(value));
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    setLokaal(value === 0 ? "" : String(value));
  }, [value]);

  function bewaar() {
    const nieuw = lokaal === "" ? 0 : Number(lokaal);
    if (Number.isNaN(nieuw) || nieuw === value) return;
    setBezig(true);
    onSave(nieuw);
    setBezig(false);
  }

  return (
    <div className="field-group">
      <label className="field-group__label" htmlFor="omzet">
        Omzet {bezig ? <span className="field-group__hint">opslaan…</span> : null}
      </label>
      <Input
        id="omzet"
        type="number"
        min={0}
        step="0.01"
        value={lokaal}
        placeholder="0,00"
        onFocus={(e) => e.target.select()}
        onChange={(e) => setLokaal(e.target.value)}
        onBlur={bewaar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}
