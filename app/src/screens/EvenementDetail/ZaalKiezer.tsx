import { useState } from "react";
import { useAppState } from "../../context/AppStateContext";

/**
 * In welke zalen dit evenement zit.
 *
 * Dit heet met opzet zaal en geen locatie: er gaat geen drank naar HOS 1, er
 * staat een evenement in HOS 1. Waar het wél voor telt is de koffie en het
 * water — de machine staat in een zaal, en zo weet de app bij welk evenement
 * dat verbruik hoort.
 */
export function ZaalKiezer({ evenementId }: { evenementId: string }) {
  const { state, zetEvenementZalen } = useAppState();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const gekozen = new Set(
    state.evenementZalen.filter((ez) => ez.evenementId === evenementId).map((ez) => ez.zaalId)
  );

  async function wissel(zaalId: string) {
    const nieuw = new Set(gekozen);
    if (nieuw.has(zaalId)) nieuw.delete(zaalId);
    else nieuw.add(zaalId);

    setBezig(true);
    setFout(null);
    try {
      await zetEvenementZalen(evenementId, Array.from(nieuw));
    } catch {
      setFout("Opslaan is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  if (state.zalen.length === 0) {
    return <p className="kaart-tekst">Nog geen zalen ingericht.</p>;
  }

  return (
    <>
      <div className="zaal-keuze">
        {state.zalen
          .filter((z) => z.actief || gekozen.has(z.id))
          .map((zaal) => (
            <button
              key={zaal.id}
              type="button"
              disabled={bezig}
              className={["zaal-chip", gekozen.has(zaal.id) && "zaal-chip--actief"]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={gekozen.has(zaal.id)}
              onClick={() => void wissel(zaal.id)}
            >
              {zaal.naam}
            </button>
          ))}
      </div>
      {fout ? <p className="form-error">{fout}</p> : null}
    </>
  );
}
