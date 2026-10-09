import { useRef, useState } from "react";
import { Button } from "../../design-system";
import type { GelezenBon } from "../../data/bon";
import { herkenBon } from "../../lib/bonHerkenning";
import { foutBericht } from "../../utils/fouten";

/** Meer dan vier pagina's met artikelen heeft een bon niet. */
const MAX_FOTOS = 4;

/**
 * Foto van de afleverbon → bonnummer, leverancier en regels.
 *
 * Neem een foto van elke pagina met artikelen (bij Swinkels meestal alleen
 * pagina 1), recht van boven en zo plat mogelijk. Het lezen gebeurt op de
 * telefoon zelf (src/lib/bonHerkenning.ts). Lukt het niet of mist er iets,
 * dan gaat de levering gewoon met de hand verder: niets hiervan is nodig om
 * te boeken.
 */
export function BonLezen({ onGelezen }: { onGelezen: (bon: GelezenBon) => void }) {
  const invoer = useRef<HTMLInputElement>(null);
  const [voortgang, setVoortgang] = useState<number | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const bezig = voortgang !== null;

  async function verwerk(bestanden: FileList | null) {
    if (!bestanden || bestanden.length === 0) return;
    if (bestanden.length > MAX_FOTOS) {
      setFout(`Hooguit ${MAX_FOTOS} foto's tegelijk.`);
      return;
    }
    setVoortgang(0);
    setFout(null);
    try {
      const bon = await herkenBon(Array.from(bestanden), setVoortgang);
      if (bon.regels.length === 0 && !bon.bonnummer) {
        setFout("Op deze foto is geen bon te lezen. Maak hem recht van boven, met genoeg licht, of vul de bon met de hand in.");
        return;
      }
      onGelezen(bon);
    } catch (err) {
      setFout(
        foutBericht(err)
          ? `Bon lezen lukt nu niet (${foutBericht(err)}). Vul hem met de hand in.`
          : "Bon lezen lukt nu niet. Vul hem met de hand in."
      );
    } finally {
      setVoortgang(null);
      if (invoer.current) invoer.current.value = "";
    }
  }

  return (
    <div className="bon-lezen">
      <input
        ref={invoer}
        className="visueel-verborgen"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        aria-label="Foto van de afleverbon"
        onChange={(e) => void verwerk(e.target.files)}
      />
      <Button icon={null} disabled={bezig} onClick={() => invoer.current?.click()}>
        {bezig ? `Bon wordt gelezen… ${Math.round((voortgang ?? 0) * 100)}%` : "Foto van de bon"}
      </Button>
      <span className="veld-toelichting">
        {bezig
          ? "Dit gebeurt op de telefoon zelf en kan tien à twintig seconden duren. De eerste keer langer."
          : "Recht van boven en zo plat mogelijk. Bonnummer en regels worden ingevuld; kijk ze na en tel zelf wat er werkelijk staat."}
      </span>
      {fout ? <p className="form-error">{fout}</p> : null}
    </div>
  );
}
