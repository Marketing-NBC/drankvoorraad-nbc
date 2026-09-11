import { Link as RouterLink } from "react-router-dom";
import { useAppState } from "../../context/AppStateContext";
import { lageVoorraad } from "../../data/calculations";
import { ROUTES } from "../../routes/routes";

/**
 * Waarschuwing dat er producten onder hun minimum zitten.
 *
 * Bewust geen melding die je moet wegklikken: de voorraad is pas op orde als
 * er is bijbesteld, niet als iemand op een kruisje heeft gedrukt. Wegklikken
 * zou de melding stilzwijgend laten verdwijnen terwijl het probleem er nog is.
 */
export function LageVoorraadMelding({
  locatieId,
  locatieNaam: naamVanLocatie,
  onBijbestellen,
}: {
  locatieId?: string;
  /** Alleen voor de kop: "… onder de minimumvoorraad in Koelcel NBC". */
  locatieNaam?: string;
  /** Directe actie; zonder deze wijst de knop naar het magazijn. */
  onBijbestellen?: () => void;
}) {
  const { state } = useAppState();
  const regels = lageVoorraad(
    locatieId ? state.voorraad.filter((v) => v.locatieId === locatieId) : state.voorraad
  );

  if (regels.length === 0) return null;

  const productNaam = new Map(state.producten.map((p) => [p.id, p.naam]));
  const locatieNaam = new Map(state.locaties.map((l) => [l.id, l.naam]));

  // Meer dan een handvol namen leest niemand meer; dan is het aantal het bericht.
  const toon = regels.slice(0, 3);
  const rest = regels.length - toon.length;

  const kop =
    regels.length === 1
      ? "Eén product onder de minimumvoorraad"
      : `${regels.length} producten onder de minimumvoorraad`;

  return (
    <div className="lage-voorraad" role="status">
      <span className="lage-voorraad__titel">
        {kop}
        {naamVanLocatie ? ` in ${naamVanLocatie}` : ""}
      </span>
      <span className="lage-voorraad__lijst">
        {toon
          .map((regel) => {
            const naam = productNaam.get(regel.productId) ?? "onbekend product";
            const plek = locatieId ? "" : ` (${locatieNaam.get(regel.locatieId) ?? "onbekende locatie"})`;
            return `${naam}${plek} (${regel.aantal} van ${regel.minVoorraad})`;
          })
          .join(" · ")}
        {rest > 0 ? ` · en nog ${rest} ${rest === 1 ? "product" : "producten"}` : ""}
      </span>
      {onBijbestellen ? (
        <button type="button" className="lage-voorraad__actie" onClick={onBijbestellen}>
          Bijbestellen
        </button>
      ) : (
        <RouterLink className="lage-voorraad__actie" to={ROUTES.magazijn}>
          Naar magazijn
        </RouterLink>
      )}
    </div>
  );
}
