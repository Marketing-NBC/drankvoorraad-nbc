import { useEffect, useState } from "react";
import type { Consumpties } from "../../data/consumpties";
import type { ProductCategorie } from "../../data/types";
import { formatNumber } from "../../utils/format";

const categorieNaam: Record<ProductCategorie, string> = {
  bier: "Bier",
  wijn: "Wijn",
  fris: "Fris",
  "sterke drank": "Sterke drank",
  koffie: "Koffie en thee",
  water: "Water",
  overig: "Overig",
};

/** Eén decimaal: "2,4 per persoon" zegt meer dan "2". */
function perPersoon(n: number): string {
  return n.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Hoeveel er per gast gedronken is. Het aantal personen wordt bij het
 * aanmaken ingevuld en is hier bij te stellen; net als de omzet bewaart het
 * bij het verlaten van het veld.
 */
export function ConsumptieKaart({
  aantalPersonen,
  consumpties,
  onSave,
}: {
  aantalPersonen: number | undefined;
  consumpties: Consumpties;
  onSave: (aantal: number | undefined) => void;
}) {
  const [lokaal, setLokaal] = useState(aantalPersonen ? String(aantalPersonen) : "");
  const [bewaard, setBewaard] = useState(false);

  useEffect(() => {
    setLokaal(aantalPersonen ? String(aantalPersonen) : "");
  }, [aantalPersonen]);

  function bewaar() {
    const nieuw = lokaal.trim() === "" ? undefined : Number(lokaal);
    if (nieuw !== undefined && (!Number.isInteger(nieuw) || nieuw <= 0)) return;
    if (nieuw === aantalPersonen) return;
    onSave(nieuw);
    setBewaard(true);
  }

  return (
    <>
      <div className="field-group">
        <label className="field-group__label" htmlFor="aantal-personen">Aantal personen</label>
        <div className="omzet-veld">
          <input
            id="aantal-personen"
            className="omzet-veld__invoer"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={lokaal}
            placeholder="—"
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
      </div>

      <div className="regellijst">
        {consumpties.perCategorie.map((groep) => (
          <div className="regellijst__regel" key={groep.categorie}>
            <span>{categorieNaam[groep.categorie]}</span>
            <span>
              {groep.perPersoon !== undefined
                ? `${perPersoon(groep.perPersoon)} p.p.`
                : formatNumber(Math.round(groep.consumpties))}
            </span>
          </div>
        ))}
        <div className="regellijst__regel regellijst__regel--totaal">
          <span>Consumpties per persoon</span>
          <span>{consumpties.perPersoon !== undefined ? perPersoon(consumpties.perPersoon) : "—"}</span>
        </div>
      </div>
      <span className="kaart-kop__sub">
        {formatNumber(Math.round(consumpties.totaal))} consumpties in totaal. Een flesje is één consumptie;
        fust en wijn tellen in glazen van 25 cl.
        {consumpties.perPersoon === undefined ? " Vul het aantal personen in voor het cijfer per persoon." : ""}
      </span>
    </>
  );
}
