import { Link as RouterLink } from "react-router-dom";
import { Icon } from "../../design-system";
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
export function LageVoorraadMelding({ locatieId }: { locatieId?: string }) {
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

  return (
    <div className="lage-voorraad" role="status">
      <Icon name="minus" size={20} className="lage-voorraad__icoon" />
      <div className="lage-voorraad__tekst">
        <strong>
          {regels.length === 1
            ? "Eén product zit onder het minimum"
            : `${regels.length} producten zitten onder het minimum`}
        </strong>
        <span className="lage-voorraad__lijst">
          {toon.map((regel) => {
            const naam = productNaam.get(regel.productId) ?? "onbekend product";
            const plek = locatieId ? "" : ` (${locatieNaam.get(regel.locatieId) ?? "onbekende locatie"})`;
            return (
              <span key={`${regel.locatieId}-${regel.productId}`}>
                {naam}{plek}: {regel.aantal} van {regel.minVoorraad}
              </span>
            );
          })}
          {rest > 0 ? <span>en nog {rest} {rest === 1 ? "product" : "producten"}</span> : null}
        </span>
      </div>
      {!locatieId ? (
        <RouterLink className="lage-voorraad__actie" to={ROUTES.magazijn}>
          Naar magazijn
        </RouterLink>
      ) : null}
    </div>
  );
}
