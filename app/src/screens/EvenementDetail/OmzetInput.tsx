import { useEffect, useState } from "react";

/**
 * Omzet wordt pas opgeslagen wanneer het veld de focus verliest (of bij Enter),
 * niet bij elke toetsaanslag — dat scheelt een databaseschrijfactie per teken.
 */
export function OmzetInput({ value, onSave }: { value: number; onSave: (value: number) => void }) {
  const [lokaal, setLokaal] = useState(value === 0 ? "" : String(value));
  const [bewaard, setBewaard] = useState(false);

  useEffect(() => {
    setLokaal(value === 0 ? "" : String(value));
  }, [value]);

  function bewaar() {
    const nieuw = lokaal === "" ? 0 : Number(lokaal);
    if (Number.isNaN(nieuw) || nieuw === value) return;
    onSave(nieuw);
    setBewaard(true);
  }

  return (
    <div className="field-group">
      <label className="field-group__label" htmlFor="omzet">Omzet</label>
      <div className="omzet-veld">
        <span className="omzet-veld__euro" aria-hidden="true">€</span>
        <input
          id="omzet"
          className="omzet-veld__invoer"
          type="number"
          min={0}
          step="0.01"
          value={lokaal}
          placeholder="0,00"
          onFocus={(e) => {
            setBewaard(false);
            e.target.select();
          }}
          onChange={(e) => setLokaal(e.target.value)}
          onBlur={bewaar}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {bewaard ? <span className="omzet-veld__status">opgeslagen</span> : null}
      </div>
      <span className="kaart-kop__sub">Wordt bewaard bij verlaten van het veld.</span>
    </div>
  );
}
